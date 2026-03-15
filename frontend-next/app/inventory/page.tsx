"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Box,
  Button,
  Grid,
  Heading,
  Input,
  Select,
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
  Tabs,
  TabList,
  TabPanels,
  Tab,
  TabPanel,
} from "@chakra-ui/react";
import { AppHeader } from "@/app/components/AppHeader";
import { TopBar } from "@/app/components/TopBar";
import { EDGE_IPU_INVENTORY, sbHeaders } from "@/lib/config";

type Item = { id: number; name: string };
type Location = { id: number; name: string };
type AssetRow = {
  asset_number: string;
  location_id: number;
  items?: { name: string };
  locations?: { name: string };
};

export default function InventoryPage() {
  const toast = useToast();
  const [mode, setMode] = useState<"add" | "move" | "delete">("add");
  const [items, setItems] = useState<Item[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [locationMap, setLocationMap] = useState<Record<string, string>>({});
  const [addAsset, setAddAsset] = useState("");
  const [addItemId, setAddItemId] = useState("");
  const [addLocationId, setAddLocationId] = useState("");
  const [moveAsset, setMoveAsset] = useState("");
  const [moveLocationId, setMoveLocationId] = useState("");
  const [deleteAsset, setDeleteAsset] = useState("");
  const [assets, setAssets] = useState<AssetRow[]>([]);
  const [filteredCount, setFilteredCount] = useState(0);
  const [totalCount, setTotalCount] = useState(0);
  const [offset, setOffset] = useState(0);
  const [locationFilter, setLocationFilter] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const limit = 100;

  const callEdge = useCallback(async (payload: Record<string, unknown>) => {
    const res = await fetch(EDGE_IPU_INVENTORY, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...sbHeaders(),
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error((data.details || data.error || "Request failed") as string);
    return data;
  }, []);

  const loadItemsAndLocations = useCallback(async () => {
    const [itemsRes, locationsRes] = await Promise.all([
      callEdge({ action: "list_items" }),
      callEdge({ action: "list_locations" }),
    ]);
    const itemList = (itemsRes.items || []) as Item[];
    const locList = (locationsRes.locations || []) as Location[];
    setItems(itemList);
    setLocations(locList);
    const map: Record<string, string> = {};
    locList.forEach((l) => {
      map[String(l.id)] = l.name;
    });
    setLocationMap(map);
  }, [callEdge]);

  const loadTable = useCallback(async () => {
    const payload: Record<string, unknown> = {
      action: "search_assets",
      limit,
      offset,
    };
    if (locationFilter) payload.location_id = Number(locationFilter);
    const data = await callEdge(payload);
    setAssets((data.assets || []) as AssetRow[]);
    setFilteredCount(data.filtered_count || 0);
    setTotalCount(data.total_count || 0);
  }, [callEdge, offset, locationFilter]);

  const doAddAsset = async () => {
    if (!addAsset.trim() || !addItemId || !addLocationId) {
      toast({ title: "Missing fields", description: "Complete all fields.", status: "warning" });
      return;
    }
    try {
      const data = await callEdge({
        action: "create_asset",
        asset_number: addAsset.trim(),
        item_id: Number(addItemId),
        location_id: Number(addLocationId),
      });
      if (data.status === "asset_number_taken") {
        toast({ title: "Duplicate asset", description: "That asset already exists.", status: "warning" });
        return;
      }
      setAddAsset("");
      setAddItemId("");
      setAddLocationId("");
      toast({ title: "Asset added", description: addAsset, status: "success" });
      setOffset(0);
      await loadTable();
    } catch (err) {
      toast({ title: "Add failed", description: String(err), status: "error" });
    }
  };

  const doMoveAsset = async () => {
    if (!moveAsset.trim() || !moveLocationId) {
      toast({ title: "Missing fields", description: "Enter asset and location.", status: "warning" });
      return;
    }
    try {
      const existing = await callEdge({ action: "get_asset", asset_number: moveAsset.trim() });
      if (existing.status === "not_found" || !existing.asset) {
        toast({ title: "Not found", description: "Asset does not exist.", status: "warning" });
        return;
      }
      await callEdge({
        action: "move_asset",
        id: Number(existing.asset.id),
        location_id: Number(moveLocationId),
      });
      setMoveAsset("");
      setMoveLocationId("");
      toast({ title: "Asset moved", description: moveAsset, status: "success" });
      await loadTable();
    } catch (err) {
      toast({ title: "Move failed", description: String(err), status: "error" });
    }
  };

  const doDeleteAsset = async () => {
    if (!deleteAsset.trim()) {
      toast({ title: "Missing asset", description: "Enter asset number.", status: "warning" });
      return;
    }
    try {
      const existing = await callEdge({ action: "get_asset", asset_number: deleteAsset.trim() });
      if (existing.status === "not_found" || !existing.asset) {
        toast({ title: "Not found", description: "Asset does not exist.", status: "warning" });
        return;
      }
      await callEdge({ action: "delete_asset", id: Number(existing.asset.id) });
      setDeleteAsset("");
      toast({ title: "Asset deleted", description: deleteAsset, status: "success" });
      setOffset(0);
      await loadTable();
    } catch (err) {
      toast({ title: "Delete failed", description: String(err), status: "error" });
    }
  };

  const filteredAssets = searchQuery.trim()
    ? assets.filter((a) => {
        const q = searchQuery.toLowerCase();
        const an = (a.asset_number || "").toLowerCase();
        const iname = (a.items?.name || "").toLowerCase();
        return an.includes(q) || iname.includes(q);
      })
    : assets;

  const totalPages = Math.max(1, Math.ceil(filteredCount / limit));
  const currentPage = Math.floor(offset / limit) + 1;

  useEffect(() => {
    loadItemsAndLocations().catch((err) => toast({ title: "Init failed", description: String(err), status: "error" }));
  }, [loadItemsAndLocations, toast]);

  useEffect(() => {
    loadTable().catch((err) => {
      toast({ title: "Load failed", description: String(err), status: "error" });
    });
  }, [loadTable, toast]);

  return (
    <>
      <AppHeader
        sub="Inventory Management"
        tagline="Serialized assets · add · move · delete"
      />
      <Box as="main" maxW="1320px" mx="auto" px={3} pb={6}>
        <TopBar
          backHref="/admin"
          backLabel="Back to Admin"
          addrLine="Manage serialized assets across locations"
          rightAction={{ href: "/", label: "Choose IPU" }}
        />

        <Grid templateColumns={{ base: "1fr", lg: "380px 1fr" }} gap={3} align="start">
          <Card borderRadius="18px">
            <CardHeader display="flex" justifyContent="space-between">
              <Text fontWeight="bold">Asset Actions</Text>
              <Text fontSize="xs" color="gray.500">Create · move · remove</Text>
            </CardHeader>
            <CardBody>
              <Tabs
                index={mode === "add" ? 0 : mode === "move" ? 1 : 2}
                onChange={(i) => setMode(i === 0 ? "add" : i === 1 ? "move" : "delete")}
              >
                <TabList>
                  <Tab>Add Asset</Tab>
                  <Tab>Move Asset</Tab>
                  <Tab>Delete Asset</Tab>
                </TabList>
                <TabPanels>
                  <TabPanel>
                    <VStack align="stretch" gap={3}>
                      <Box>
                        <Text fontSize="xs" fontWeight="bold" mb={1}>Asset Number</Text>
                        <Input
                          value={addAsset}
                          onChange={(e) => setAddAsset(e.target.value)}
                          placeholder="Asset number"
                        />
                      </Box>
                      <Box>
                        <Text fontSize="xs" fontWeight="bold" mb={1}>Item Type</Text>
                        <Select
                          value={addItemId}
                          onChange={(e) => setAddItemId(e.target.value)}
                          placeholder="Select item"
                        >
                          {items.map((it) => (
                            <option key={it.id} value={it.id}>
                              {it.name}
                            </option>
                          ))}
                        </Select>
                      </Box>
                      <Box>
                        <Text fontSize="xs" fontWeight="bold" mb={1}>Location</Text>
                        <Select
                          value={addLocationId}
                          onChange={(e) => setAddLocationId(e.target.value)}
                          placeholder="Select location"
                        >
                          {locations.map((loc) => (
                            <option key={loc.id} value={loc.id}>
                              {loc.name}
                            </option>
                          ))}
                        </Select>
                      </Box>
                      <Button colorScheme="teal" w="full" onClick={doAddAsset}>
                        Add Asset
                      </Button>
                    </VStack>
                  </TabPanel>
                  <TabPanel>
                    <VStack align="stretch" gap={3}>
                      <Box>
                        <Text fontSize="xs" fontWeight="bold" mb={1}>Asset Number</Text>
                        <Input
                          value={moveAsset}
                          onChange={(e) => setMoveAsset(e.target.value)}
                          placeholder="Asset number"
                        />
                      </Box>
                      <Box>
                        <Text fontSize="xs" fontWeight="bold" mb={1}>New Location</Text>
                        <Select
                          value={moveLocationId}
                          onChange={(e) => setMoveLocationId(e.target.value)}
                          placeholder="Select location"
                        >
                          {locations.map((loc) => (
                            <option key={loc.id} value={loc.id}>
                              {loc.name}
                            </option>
                          ))}
                        </Select>
                      </Box>
                      <Button colorScheme="orange" w="full" onClick={doMoveAsset}>
                        Move Asset
                      </Button>
                    </VStack>
                  </TabPanel>
                  <TabPanel>
                    <VStack align="stretch" gap={3}>
                      <Box>
                        <Text fontSize="xs" fontWeight="bold" mb={1}>Asset Number</Text>
                        <Input
                          value={deleteAsset}
                          onChange={(e) => setDeleteAsset(e.target.value)}
                          placeholder="Asset number"
                        />
                      </Box>
                      <Button colorScheme="red" w="full" onClick={doDeleteAsset}>
                        Delete Asset
                      </Button>
                    </VStack>
                  </TabPanel>
                </TabPanels>
              </Tabs>
            </CardBody>
          </Card>

          <Card borderRadius="18px">
            <CardHeader display="flex" justifyContent="space-between">
              <Text fontWeight="bold">Asset Inventory</Text>
              <Text fontSize="xs" color="gray.500">
                {searchQuery.trim()
                  ? `${filteredAssets.length} of ${filteredCount} · total ${totalCount}`
                  : offset === 0 && filteredCount === totalCount && assets.length === totalCount
                  ? `${totalCount} of ${totalCount}`
                  : `${Math.min(offset + 1, filteredCount)}-${Math.min(offset + assets.length, filteredCount)} of ${filteredCount} · total ${totalCount}`}
              </Text>
            </CardHeader>
            <CardBody>
              <Flex gap={2} mb={3} flexWrap="wrap">
                <Input
                  placeholder="Search asset number"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  flex={1}
                  minW="120px"
                />
                <Select
                  value={locationFilter}
                  onChange={(e) => {
                    setLocationFilter(e.target.value);
                    setOffset(0);
                  }}
                  w="220px"
                >
                  <option value="">All locations</option>
                  {locations.map((loc) => (
                    <option key={loc.id} value={loc.id}>
                      {loc.name}
                    </option>
                  ))}
                </Select>
                <Button colorScheme="teal" onClick={() => loadTable()}>
                  Search
                </Button>
              </Flex>
              <TableContainer>
                <Table size="sm">
                  <Thead>
                    <Tr>
                      <Th>Asset Number</Th>
                      <Th>Item</Th>
                      <Th>Location</Th>
                      <Th>Location ID</Th>
                    </Tr>
                  </Thead>
                  <Tbody>
                    {filteredAssets.length === 0 ? (
                      <Tr>
                        <Td colSpan={4} textAlign="center" py={6}>
                          No assets found.
                        </Td>
                      </Tr>
                    ) : (
                      filteredAssets.map((a) => (
                        <Tr key={a.asset_number + a.location_id}>
                          <Td>{a.asset_number || ""}</Td>
                          <Td>{a.items?.name || ""}</Td>
                          <Td>
                            {a.locations?.name || locationMap[String(a.location_id)] || `Location ${a.location_id}`}
                          </Td>
                          <Td>{a.location_id ?? ""}</Td>
                        </Tr>
                      ))
                    )}
                  </Tbody>
                </Table>
              </TableContainer>
              <Flex justify="space-between" align="center" mt={3} pt={3} borderTopWidth="1px">
                <Text fontSize="xs" color="gray.500">
                  Page {currentPage} of {totalPages}
                </Text>
                <Flex gap={2}>
                  <Button
                    size="sm"
                    isDisabled={offset === 0}
                    onClick={() => setOffset((o) => Math.max(0, o - limit))}
                  >
                    Previous
                  </Button>
                  <Button
                    size="sm"
                    isDisabled={offset + limit >= filteredCount}
                    onClick={() => setOffset((o) => o + limit)}
                  >
                    Next
                  </Button>
                </Flex>
              </Flex>
            </CardBody>
          </Card>
        </Grid>
      </Box>
    </>
  );
}
