"use client";

import { useParams, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Box,
  Button,
  Grid,
  Heading,
  Input,
  InputGroup,
  InputLeftElement,
  Text,
  VStack,
  useToast,
  Badge,
  Card,
  CardBody,
  CardHeader,
  Flex,
} from "@chakra-ui/react";
import { AppHeader } from "@/app/components/AppHeader";
import { TopBar } from "@/app/components/TopBar";
import {
  REST_BASE,
  EDGE_ASSET_MOVEMENT,
  SUPABASE_ANON_KEY,
  TOTALS_TABLE,
  CONTRACT,
  sbHeaders,
} from "@/lib/config";

const SLUG_TO_IPU: Record<string, { ipu_id: number; name: string }> = {
  dayton: { ipu_id: 1, name: "Dayton" },
  "butler-warren": { ipu_id: 2, name: "Butler Warren" },
  "miami-county": { ipu_id: 3, name: "Miami County" },
};

type TrackedItem = {
  item_id: number;
  item: string;
  onHand: number;
  par: number;
};

function statusType(onHand: number, par: number): "ok" | "warn" | "bad" {
  if (onHand === 0) return "bad";
  if (onHand >= par) return "ok";
  return "warn";
}

export default function IPUPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const slug = (params?.slug as string) || "dayton";
  const ipuIdFromQuery = searchParams?.get("ipu_id");
  const nameFromQuery = searchParams?.get("name");
  const resolved =
    SLUG_TO_IPU[slug] ||
    (ipuIdFromQuery && nameFromQuery
      ? { ipu_id: Number(ipuIdFromQuery), name: nameFromQuery }
      : SLUG_TO_IPU.dayton);
  const IPU_ID = resolved.ipu_id;
  const ipuName = resolved.name;

  const toast = useToast();
  const [assetInput, setAssetInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [trackedItems, setTrackedItems] = useState<TrackedItem[]>([]);
  const [lastScan, setLastScan] = useState<{
    label: string;
    item_name: string;
    asset_number: string;
    time: string;
  } | null>(null);

  const loadTotals = useCallback(async () => {
    const url = `${REST_BASE}/rest/v1/${TOTALS_TABLE}?select=item_id,total_quantity,par_quantity,items(name)&ipu_id=eq.${IPU_ID}&order=item_id.asc`;
    const res = await fetch(url, {
      headers: {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        Accept: "application/json",
      },
    });
    if (!res.ok) throw new Error("Could not load totals");
    const data = await res.json();
    setTrackedItems(
      data.map((r: { item_id: number; total_quantity: number; par_quantity: number; items?: { name: string } }) => ({
        item_id: r.item_id,
        item: r.items?.name ?? `Item ${r.item_id}`,
        onHand: Number(r.total_quantity ?? 0),
        par: Number(r.par_quantity ?? 0),
      }))
    );
  }, [IPU_ID]);

  const sendScan = useCallback(
    async (asset_number: string, scan_type: string) => {
      const res = await fetch(EDGE_ASSET_MOVEMENT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + SUPABASE_ANON_KEY,
          apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ asset_number, ipu_id: IPU_ID, scan_type }),
      });
      let data: { status?: string; message?: string; notice?: string } = {};
      try {
        data = await res.json();
      } catch {
        data = { status: "bad_json" };
      }
      if (!res.ok) return { status: data?.status || "http_error", message: data?.message, notice: data?.notice };
      return data;
    },
    [IPU_ID]
  );

  const handleSendScan = useCallback(
    async (scanType: "scan_out" | "scan_in") => {
      const asset = assetInput.trim();
      if (!asset) return;
      setLoading(true);
      try {
        const result = await sendScan(asset, scanType);
        const time = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
        if (result?.status === "success") {
          const detail =
            result?.notice === "already_on_hand"
              ? `${asset} already on hand`
              : asset;
          toast({
            title: `Scan · ${scanType === CONTRACT.scanTypes.OUT ? "Out" : "In"}`,
            description: detail,
            status: result.notice === "already_on_hand" ? "warning" : "success",
            duration: 4000,
          });
          setLastScan({
            label: "Last scanned",
            item_name: (result as { item_name?: string })?.item_name || "Item",
            asset_number: asset,
            time,
          });
          setAssetInput("");
          await loadTotals();
        } else {
          toast({
            title: "Scan failed",
            description: (result as { message?: string })?.message || "Unknown error",
            status: "error",
            duration: 4000,
          });
        }
      } catch (err) {
        toast({
          title: "Error",
          description: String(err),
          status: "error",
          duration: 4000,
        });
      } finally {
        setLoading(false);
      }
    },
    [assetInput, sendScan, loadTotals, toast]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      if (e.shiftKey) handleSendScan(CONTRACT.scanTypes.IN);
      else handleSendScan(CONTRACT.scanTypes.OUT);
    }
  };

  const manualTakeOne = async (idx: number) => {
    const row = trackedItems[idx];
    if (!row || row.onHand === 0) return;
    const newOnHand = Math.max(0, row.onHand - 1);
    try {
      const res = await fetch(
        `${REST_BASE}/rest/v1/${TOTALS_TABLE}?ipu_id=eq.${IPU_ID}&item_id=eq.${row.item_id}`,
        {
          method: "PATCH",
          headers: sbHeaders({ Prefer: "return=representation" }),
          body: JSON.stringify({
            total_quantity: newOnHand,
            par_quantity: row.par,
          }),
        }
      );
      if (!res.ok) throw new Error("Update failed");
      await loadTotals();
      const time = new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
      setLastScan({
        label: "Last action",
        item_name: row.item,
        asset_number: "Manual",
        time,
      });
      toast({ title: "Manual · Take 1", description: row.item, status: "success", duration: 3000 });
    } catch (err) {
      toast({ title: "Take 1 failed", description: String(err), status: "error" });
    }
  };

  useEffect(() => {
    loadTotals().catch((err) => {
      toast({ title: "Load failed", description: String(err), status: "error" });
    });
  }, [loadTotals, toast]);

  return (
    <>
      <AppHeader
        sub="Inventory Portal"
        tagline="Par levels, scan tools, & shortage reporting"
      />
      <Box as="main" maxW="1160px" mx="auto" px={3} pb={4} minH="calc(100vh - 168px)" display="flex" flexDirection="column" gap={2}>
        <TopBar
          backHref="/"
          backLabel="Choose location"
          addrLine={`324 Wilmington Ave, Dayton, OH 45420`}
          rightAction={{
            href: `/admin?ipu_id=${IPU_ID}&name=${encodeURIComponent(ipuName)}`,
            label: "Admin",
          }}
        />

        <Grid templateColumns={{ base: "1fr", lg: "1.1fr 0.28fr 0.9fr" }} gap={3} alignItems="center" px={1}>
          <Text fontWeight={900} color="rgba(15,23,42,0.58)" textAlign="center">
            Scan Out
          </Text>
          <Box />
          <Text fontWeight={900} color="rgba(15,23,42,0.58)" textAlign="center">
            Sign Out
          </Text>
        </Grid>

        <Grid templateColumns={{ base: "1fr", lg: "1.1fr 0.9fr" }} gap={3} flex={1} minH={0}>
          <VStack align="stretch" gap={3} minH={0} overflow="auto">
            <Card borderRadius="18px" borderWidth="1px" borderColor="rgba(243,112,33,0.22)" shadow="md">
              <CardHeader display="flex" justifyContent="space-between">
                <Heading size="sm">{ipuName} IPU</Heading>
                <Text fontSize="xs" color="gray.500">Scanner</Text>
              </CardHeader>
              <CardBody>
                <Flex gap={2} mb={2}>
                  <InputGroup>
                    <InputLeftElement pointerEvents="none" color="gray.400">
                      🔍
                    </InputLeftElement>
                    <Input
                      placeholder="Scan or type asset number…"
                      value={assetInput}
                      onChange={(e) => setAssetInput(e.target.value)}
                      onKeyDown={handleKeyDown}
                      borderRadius="14px"
                    />
                  </InputGroup>
                  <Button
                    colorScheme="teal"
                    onClick={() => handleSendScan(CONTRACT.scanTypes.OUT)}
                    isLoading={loading}
                    px={4}
                  >
                    Send
                  </Button>
                </Flex>
                <Text fontSize="xs" color="gray.500">
                  Enter = scan-out · Shift+Enter = scan-in
                </Text>
              </CardBody>
            </Card>

            <Card borderRadius="18px">
              <CardHeader display="flex" justifyContent="space-between">
                <Text fontWeight="bold">Last Scan</Text>
                <Text fontSize="xs" color="gray.500">Live</Text>
              </CardHeader>
              <CardBody>
                <Box
                  p={2}
                  borderRadius="14px"
                  borderWidth="1px"
                  borderColor="green.200"
                  bg="green.50"
                >
                  <Text fontWeight="bold">
                    {lastScan?.label ?? "Last scanned"} {lastScan?.item_name ?? "Awaiting scan"}
                  </Text>
                  <Text fontSize="sm" color="gray.600">
                    {lastScan?.asset_number ?? "—"} · {lastScan?.time ?? "—"} · {ipuName} IPU
                  </Text>
                </Box>
              </CardBody>
            </Card>

            <Card borderRadius="18px">
              <CardHeader display="flex" justifyContent="space-between">
                <Text fontWeight="bold">Movement History</Text>
                <Text fontSize="xs" color="gray.500">Session</Text>
              </CardHeader>
              <CardBody>
                <Button variant="outline" w="full" size="sm">
                  View recent movement history ›
                </Button>
              </CardBody>
            </Card>
          </VStack>

          <Card borderRadius="18px" overflow="hidden">
            <CardHeader display="flex" justifyContent="space-between">
              <VStack align="start" spacing={0}>
                <Heading size="sm">On-Hand Status</Heading>
                <Text fontSize="xs" color="gray.500">Live totals from database</Text>
              </VStack>
              <Text fontSize="xs" color="gray.500">{ipuName} IPU</Text>
            </CardHeader>
            <CardBody overflow="auto" maxH="50vh">
              {!trackedItems.length ? (
                <Text fontSize="sm" color="gray.500">No tracked totals for this IPU.</Text>
              ) : (
                <VStack align="stretch" gap={2}>
                  {trackedItems.map((row, i) => {
                    const st = statusType(row.onHand, row.par);
                    return (
                      <Flex
                        key={row.item_id}
                        align="center"
                        justify="space-between"
                        p={2}
                        borderRadius="14px"
                        bg="white"
                        borderWidth="1px"
                        borderColor="gray.100"
                      >
                        <Text fontWeight={800} fontSize="sm" noOfLines={1}>
                          {row.item}
                        </Text>
                        <Badge
                          colorScheme={st === "ok" ? "green" : st === "warn" ? "yellow" : "red"}
                          mr={2}
                        >
                          {row.onHand} / {row.par}
                        </Badge>
                        <Button
                          size="sm"
                          colorScheme="orange"
                          isDisabled={row.onHand === 0}
                          onClick={() => manualTakeOne(i)}
                        >
                          Take 1 ›
                        </Button>
                      </Flex>
                    );
                  })}
                </VStack>
              )}
            </CardBody>
          </Card>
        </Grid>
      </Box>
      <Box as="footer" textAlign="center" py={2} fontSize="xs" color="gray.500">
        © OHI • Innovative Care Solutions — Internal use only
      </Box>
    </>
  );
}
