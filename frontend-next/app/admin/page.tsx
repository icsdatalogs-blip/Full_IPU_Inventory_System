"use client";

import { useSearchParams } from "next/navigation";
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
  Table,
  Thead,
  Tbody,
  Tr,
  Th,
  Td,
  Card,
  CardBody,
  CardHeader,
  Flex,
  TableContainer,
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

type TrackedRow = {
  item_id: number;
  name: string;
  on: number;
  par: number;
};

type QueueEntry =
  | { id: string; kind: "adjust"; item_id: number; name: string; delta: number }
  | {
      id: string;
      kind: "scan";
      status: string;
      asset_number: string;
      item_name: string;
      note: string;
      icon: string;
      title: string;
    };

const uid = () => Math.random().toString(16).slice(2) + Date.now().toString(16);

export default function AdminPage() {
  const searchParams = useSearchParams();
  const ipuId = Number(searchParams?.get("ipu_id") || 1);
  const ipuName = searchParams?.get("name") || "Dayton";

  const toast = useToast();
  const [assetInput, setAssetInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [trackedItems, setTrackedItems] = useState<TrackedRow[]>([]);
  const [queue, setQueue] = useState<QueueEntry[]>([]);

  const loadItems = useCallback(async () => {
    const url = `${REST_BASE}/rest/v1/${TOTALS_TABLE}?select=item_id,total_quantity,par_quantity,items(name)&ipu_id=eq.${ipuId}&order=item_id.asc`;
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
        name: r.items?.name ?? `Item ${r.item_id}`,
        on: Number(r.total_quantity ?? 0),
        par: Number(r.par_quantity ?? 0),
      }))
    );
  }, [ipuId]);

  const sendScan = useCallback(
    async (asset_number: string, scan_type: string) => {
      const res = await fetch(EDGE_ASSET_MOVEMENT, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer " + SUPABASE_ANON_KEY,
          apikey: SUPABASE_ANON_KEY,
        },
        body: JSON.stringify({ asset_number, ipu_id: ipuId, scan_type }),
      });
      let data: { status?: string; message?: string; notice?: string; item_name?: string } = {};
      try {
        data = await res.json();
      } catch {
        data = { status: "bad_json" };
      }
      if (!res.ok) return { status: data?.status || "http_error", message: data?.message, ...data };
      return data;
    },
    [ipuId]
  );

  const addOrMergeAdjustment = (item_id: number, name: string, delta: number) => {
    setQueue((prev) => {
      const existing = prev.find((e) => e.kind === "adjust" && e.item_id === item_id) as
        | { id: string; kind: "adjust"; item_id: number; name: string; delta: number }
        | undefined;
      if (existing) {
        const newDelta = existing.delta + delta;
        if (newDelta === 0) return prev.filter((e) => e.id !== existing.id);
        return prev.map((e) =>
          e.id === existing.id ? { ...e, delta: newDelta } : e
        );
      }
      return [{ id: uid(), kind: "adjust" as const, item_id, name, delta }, ...prev];
    });
  };

  const adjustQty = (idx: number, delta: number) => {
    const item = trackedItems[idx];
    if (!item) return;
    setTrackedItems((prev) =>
      prev.map((r, i) =>
        i === idx ? { ...r, on: Math.max(0, r.on + delta) } : r
      )
    );
    addOrMergeAdjustment(item.item_id, item.name, delta);
  };

  const removeQueueEntry = (id: string) => {
    setQueue((prev) => prev.filter((e) => e.id !== id));
  };

  const runScan = async (scan_type: "scan_in" | "scan_out") => {
    const asset = assetInput.trim();
    if (!asset) return;
    setLoading(true);
    try {
      const result = await sendScan(asset, scan_type);
      if (result?.status === "success") {
        const msg =
          result?.notice === "already_on_hand"
            ? `${asset} · Already on hand`
            : asset;
        toast({
          title: "Scan recorded",
          description: msg,
          status: "success",
          duration: 3200,
        });
        setQueue((prev) => [
          {
            id: uid(),
            kind: "scan",
            status: "ok",
            asset_number: asset,
            item_name: result?.item_name || "",
            note: result?.notice === "already_on_hand" ? "Already on hand" : "Moved",
            icon: "✓",
            title: `Scan-in: ${asset}`,
          },
          ...prev,
        ]);
        setAssetInput("");
        await loadItems();
      } else {
        toast({
          title: "Scan failed",
          description: (result as { message?: string })?.message || "Unknown",
          status: "error",
        });
        setQueue((prev) => [
          {
            id: uid(),
            kind: "scan",
            status: "bad",
            asset_number: asset,
            item_name: "",
            note: (result as { message?: string })?.message || "Not found",
            icon: "✕",
            title: `Unknown: ${asset}`,
          },
          ...prev,
        ]);
      }
    } catch (err) {
      toast({ title: "Network error", description: String(err), status: "error" });
    } finally {
      setLoading(false);
    }
  };

  const confirmQueue = async () => {
    const adjustEntries = queue.filter((e): e is QueueEntry & { kind: "adjust" } => e.kind === "adjust");
    if (adjustEntries.length === 0) {
      toast({ title: "Nothing to save", description: "No quantity changes queued.", status: "warning" });
      return;
    }
    try {
      const touchedIds = [...new Set(adjustEntries.map((e) => e.item_id))];
      const payload = touchedIds.map((item_id) => {
        const item = trackedItems.find((x) => x.item_id === item_id);
        return {
          ipu_id: ipuId,
          item_id,
          total_quantity: Number(item?.on ?? 0),
          par_quantity: Number(item?.par ?? 0),
        };
      });
      const res = await fetch(
        `${REST_BASE}/rest/v1/${TOTALS_TABLE}?on_conflict=ipu_id,item_id`,
        {
          method: "POST",
          headers: sbHeaders({
            Prefer: "resolution=merge-duplicates,return=representation",
          }),
          body: JSON.stringify(payload),
        }
      );
      if (!res.ok) throw new Error(await res.text());
      setQueue((prev) => prev.filter((e) => e.kind !== "adjust"));
      toast({ title: "Saved", description: "Totals updated.", status: "success" });
      await loadItems();
    } catch (err) {
      toast({ title: "Save failed", description: String(err), status: "error" });
    }
  };

  const readyAdjustments = queue.filter((e) => e.kind === "adjust").length;

  useEffect(() => {
    loadItems().catch((err) => toast({ title: "Load failed", description: String(err), status: "error" }));
  }, [loadItems, toast]);

  return (
    <>
      <AppHeader
        sub="Admin Control Panel"
        tagline="Scan in · quick adjustments · management tools"
      />
      <Box as="main" maxW="1320px" mx="auto" px={3} pb={4} minH="calc(100vh - 136px)" display="flex" flexDirection="column" gap={2}>
        <TopBar
          backHref={`/ipu/${ipuName.toLowerCase().replace(/\s+/g, "-")}?ipu_id=${ipuId}&name=${encodeURIComponent(ipuName)}`}
          backLabel="Back to IPU"
          addrLine="Admin tools for IPU inventory control"
          rightAction={{ href: "/", label: "Choose IPU" }}
        />

        <Grid templateColumns={{ base: "1fr", lg: "1.35fr 1fr" }} gap={3} flex={1} minH={0}>
          <VStack align="stretch" gap={3}>
            <Card borderRadius="18px" borderColor="orange.200" borderWidth="1px">
              <CardHeader display="flex" justifyContent="space-between">
                <Text fontWeight="bold">Scan In</Text>
                <Text fontSize="xs" color="gray.500">Serialized assets</Text>
              </CardHeader>
              <CardBody>
                <Flex gap={2}>
                  <InputGroup>
                    <InputLeftElement>🔍</InputLeftElement>
                    <Input
                      placeholder="Scan barcode…"
                      value={assetInput}
                      onChange={(e) => setAssetInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") runScan(e.shiftKey ? CONTRACT.scanTypes.OUT : CONTRACT.scanTypes.IN);
                      }}
                    />
                  </InputGroup>
                  <Button
                    colorScheme="teal"
                    onClick={() => runScan(CONTRACT.scanTypes.IN)}
                    isLoading={loading}
                  >
                    Send
                  </Button>
                </Flex>
                <Text fontSize="xs" color="gray.500" mt={2}>
                  Enter = Scan-in · Shift+Enter = Scan-out
                </Text>
              </CardBody>
            </Card>

            <Card borderRadius="18px">
              <CardHeader display="flex" justifyContent="space-between">
                <Text fontWeight="bold">Quick Adjustments</Text>
                <Text fontSize="xs" color="gray.500">On / Par</Text>
              </CardHeader>
              <CardBody>
                <TableContainer>
                  <Table size="sm">
                    <Thead>
                      <Tr>
                        <Th>Item</Th>
                        <Th isNumeric>On</Th>
                        <Th isNumeric>Par</Th>
                        <Th>Actions</Th>
                      </Tr>
                    </Thead>
                    <Tbody>
                      {trackedItems.map((r, idx) => (
                        <Tr key={r.item_id}>
                          <Td fontWeight={800}>{r.name}</Td>
                          <Td isNumeric color={r.on >= r.par ? "green.600" : "red.600"}>
                            {r.on}
                          </Td>
                          <Td isNumeric>{r.par}</Td>
                          <Td>
                            <Button size="xs" mr={1} onClick={() => adjustQty(idx, -1)}>
                              −
                            </Button>
                            <Button size="xs" onClick={() => adjustQty(idx, 1)}>
                              +
                            </Button>
                          </Td>
                        </Tr>
                      ))}
                    </Tbody>
                  </Table>
                </TableContainer>
              </CardBody>
            </Card>
          </VStack>

          <VStack align="stretch" gap={3}>
            <Card borderRadius="18px">
              <CardHeader display="flex" justifyContent="space-between">
                <Text fontWeight="bold">Management</Text>
                <Text fontSize="xs" color="gray.500">Tools</Text>
              </CardHeader>
              <CardBody>
                <VStack align="stretch" gap={3}>
                  <Button
                    as={Link}
                    href="/inventory"
                    w="full"
                    variant="outline"
                    justifyContent="space-between"
                    rightIcon={<span>›</span>}
                  >
                    <Box textAlign="left">
                      <Text fontWeight="bold">Inventory Management</Text>
                      <Text fontSize="xs" color="gray.500">
                        Add/edit serialized assets · item mapping
                      </Text>
                    </Box>
                  </Button>
                  <Button
                    w="full"
                    variant="outline"
                    justifyContent="space-between"
                    rightIcon={<span>›</span>}
                    onClick={() => toast({ title: "Not wired", description: "Par Level Management (wire later)", status: "info" })}
                  >
                    <Box textAlign="left">
                      <Text fontWeight="bold">Par Level Management</Text>
                      <Text fontSize="xs" color="gray.500">
                        Set targets per IPU · track shortages
                      </Text>
                    </Box>
                  </Button>
                  <Button
                    w="full"
                    variant="outline"
                    justifyContent="space-between"
                    rightIcon={<span>›</span>}
                    onClick={() => toast({ title: "Not wired", description: "History (wire later)", status: "info" })}
                  >
                    <Box textAlign="left">
                      <Text fontWeight="bold">History</Text>
                      <Text fontSize="xs" color="gray.500">
                        Movement log · filters · audit trail
                      </Text>
                    </Box>
                  </Button>
                </VStack>
              </CardBody>
            </Card>

            <Card borderRadius="18px">
              <CardHeader display="flex" justifyContent="space-between">
                <Text fontWeight="bold">Changes Queue</Text>
                <Text fontSize="xs" color="gray.500">{queue.length} pending</Text>
              </CardHeader>
              <CardBody>
                <VStack align="stretch" gap={2} maxH="200px" overflow="auto">
                  {queue.length === 0 ? (
                    <Text fontSize="sm" color="gray.500">
                      No pending changes. Use +/− to queue updates or scan assets.
                    </Text>
                  ) : (
                    queue.map((e) => (
                      <Flex
                        key={e.id}
                        justify="space-between"
                        align="center"
                        p={2}
                        borderRadius="12px"
                        borderWidth="1px"
                        borderColor="gray.200"
                        bg="gray.50"
                      >
                        <Box>
                          {e.kind === "adjust" ? (
                            <>
                              <Text fontWeight="bold">Adjustment: {e.name}</Text>
                              <Text fontSize="xs">Delta: {e.delta > 0 ? "+" : ""}{e.delta} (queued)</Text>
                            </>
                          ) : (
                            <>
                              <Text fontWeight="bold">{e.title}</Text>
                              <Text fontSize="xs">{e.note}</Text>
                            </>
                          )}
                        </Box>
                        <Button size="xs" variant="ghost" onClick={() => removeQueueEntry(e.id)}>
                          Remove
                        </Button>
                      </Flex>
                    ))
                  )}
                </VStack>
                <Text fontSize="xs" color="gray.500" mt={2}>
                  Unrecognized: {queue.filter((e) => e.kind === "scan" && e.status === "bad").length} · Ready: {readyAdjustments}
                </Text>
                <Button
                  mt={2}
                  w="full"
                  colorScheme="teal"
                  isDisabled={readyAdjustments === 0}
                  onClick={confirmQueue}
                >
                  Confirm / Update
                </Button>
              </CardBody>
            </Card>
          </VStack>
        </Grid>
      </Box>
    </>
  );
}
