const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://sosyqdgeqgfuclffmzgl.supabase.co";
export const REST_BASE = SUPABASE_URL;
export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InNvc3lxZGdlcWdmdWNsZmZtemdsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk3ODA0MjgsImV4cCI6MjA4NTM1NjQyOH0.quknRUYbRqvLMpsCKjlytN38hek5sk1v1o6KJEwTCxQ";
const FUNCTIONS_BASE = SUPABASE_URL.replace(/\/$/, "") + "/functions/v1";
export const EDGE_ASSET_MOVEMENT = `${FUNCTIONS_BASE}/asset-movement`;
export const EDGE_IPU_INVENTORY = `${FUNCTIONS_BASE}/IPU_Inventory`;

export const TOTALS_TABLE = "ipu_item_totals";
export const CONTRACT = {
  scanTypes: { OUT: "scan_out", IN: "scan_in", VERIFY: "verify" } as const,
};

export const sbHeaders = (extra: Record<string, string> = {}) => ({
  apikey: SUPABASE_ANON_KEY,
  Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  "Content-Type": "application/json",
  Accept: "application/json",
  ...extra,
});
