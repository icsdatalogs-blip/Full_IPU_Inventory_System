// ============================================================
// SUPABASE EDGE FUNCTION — QUICK PEEK
// Returns shortage cards for all IPUs
// ============================================================

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  try {
    if (req.method === "OPTIONS") {
      return new Response("ok", { headers: corsHeaders });
    }

    if (req.method !== "GET") {
      return json({ error: "Method not allowed" }, 405);
    }

    const { data, error } = await supabase
      .from("ipu_item_totals")
      .select(`
        ipu_id,
        item_id,
        par_quantity,
        total_quantity,
        items!ipu_item_totals_item_id_fkey (
          id,
          name
        ),
        locations!ipu_item_totals_ipu_id_fkey (
          id,
          name
        )
      `)
      .in("ipu_id", [1, 2, 3])
      .order("ipu_id", { ascending: true });

    if (error) {
      throw new Error(error.message);
    }

    const ipuMap: Record<number, {
      ipu_id: number;
      ipu_name: string;
      address: string;
      needed_items: { item_name: string; qty_needed: number }[];
    }> = {
      1: {
        ipu_id: 1,
        ipu_name: "Dayton IPU",
        address: "324 Wilmington Ave, Dayton, OH",
        needed_items: []
      },
      2: {
        ipu_id: 2,
        ipu_name: "Butler Warren IPU",
        address: "5940 Long Meadow Dr, Middletown, OH",
        needed_items: []
      },
      3: {
        ipu_id: 3,
        ipu_name: "Miami County IPU",
        address: "3230 N County Rd 25A, Troy, OH",
        needed_items: []
      }
    };

    for (const row of data ?? []) {
      const qtyNeeded = Math.max(0, (row.par_quantity ?? 0) - (row.total_quantity ?? 0));

      if (qtyNeeded <= 0) continue;

      if (!ipuMap[row.ipu_id]) {
        ipuMap[row.ipu_id] = {
          ipu_id: row.ipu_id,
          ipu_name: row.locations?.name ?? `IPU ${row.ipu_id}`,
          address: "",
          needed_items: []
        };
      }

      ipuMap[row.ipu_id].needed_items.push({
        item_name: row.items?.name ?? `Item ${row.item_id}`,
        qty_needed: qtyNeeded
      });
    }

    const result = Object.values(ipuMap).sort((a, b) => a.ipu_id - b.ipu_id);

    return json(result);
  } catch (err) {
    return json(
      { error: "Server error", details: String(err) },
      500
    );
  }
});
