// ============================================================
// SUPABASE EDGE FUNCTION — ASSET MOVEMENT + TOTAL SYNC
// ============================================================

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const OUT_LOCATION_ID = 4;

const SCAN_TYPE_OUT = "scan_out";
const SCAN_TYPE_IN = "scan_in";
const SCAN_TYPE_VERIFY = "verify";
const SCAN_TYPE_UNDO = "undo";

const RESULT_SUCCESS = "success";
const RESULT_UNKNOWN_ASSET = "unknown_asset";
const RESULT_INVALID_SCAN_TYPE = "invalid_scan_type";
const RESULT_MISSING_FIELDS = "missing_fields";
const RESULT_ALREADY_ON_HAND = "already_on_hand";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
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

async function insertHistory(payload: any) {
  const { error } = await supabase.from("scan_history").insert(payload);
  if (error) throw new Error(error.message);
}

async function adjustTotals(ipu_id: number, item_id: number, delta: number) {
  const { data } = await supabase
    .from("ipu_item_totals")
    .select("total_quantity")
    .eq("ipu_id", ipu_id)
    .eq("item_id", item_id)
    .maybeSingle();

  if (data) {
    await supabase
      .from("ipu_item_totals")
      .update({ total_quantity: Math.max(0, data.total_quantity + delta) })
      .eq("ipu_id", ipu_id)
      .eq("item_id", item_id);
  } else {
    await supabase
      .from("ipu_item_totals")
      .insert({
        ipu_id,
        item_id,
        total_quantity: Math.max(0, delta),
        par_quantity: 0
      });
  }
}

Deno.serve(async (req: Request) => {
  try {

    if (req.method === "OPTIONS") {
      return new Response("ok", { headers: corsHeaders });
    }

    if (req.method !== "POST") {
      return json({ error: "Method not allowed" }, 405);
    }

    const body = await req.json();
    const asset_number = body?.asset_number?.trim?.();
    const ipu_id = body?.ipu_id;
    const scan_type = body?.scan_type;

    if (!asset_number || !ipu_id || !scan_type) {
      return json({ status: RESULT_MISSING_FIELDS }, 400);
    }

    if (![SCAN_TYPE_OUT, SCAN_TYPE_IN, SCAN_TYPE_VERIFY, SCAN_TYPE_UNDO].includes(scan_type)) {
      return json({ status: RESULT_INVALID_SCAN_TYPE }, 400);
    }

    // ✅ Lookup asset WITH item name
    const { data: asset } = await supabase
      .from("assets")
      .select("id, location_id, item_id, items(name)")
      .eq("asset_number", asset_number)
      .maybeSingle();

    if (!asset) {
      await insertHistory({
        asset_id: null,
        ipu_id,
        scan_type,
        result: RESULT_UNKNOWN_ASSET,
        notes: asset_number
      });

      return json({ status: RESULT_UNKNOWN_ASSET });
    }

    const item_name = asset.items?.name ?? null;

    const undo_target = body?.undo_target;

if (scan_type === SCAN_TYPE_UNDO) {
  if (![SCAN_TYPE_OUT, SCAN_TYPE_IN].includes(undo_target)) {
    return json({ status: RESULT_INVALID_SCAN_TYPE }, 400);
  }

  if (undo_target === SCAN_TYPE_OUT) {
    // undo a prior scan_out = move asset back into this IPU
    if (asset.location_id !== OUT_LOCATION_ID) {
      await insertHistory({
        asset_id: asset.id,
        ipu_id,
        scan_type: SCAN_TYPE_UNDO,
        result: RESULT_SUCCESS,
        notes: `undo requested for scan_out but asset not at out location`
      });

      return json({
        status: RESULT_SUCCESS,
        item_name,
        notice: "nothing_to_undo"
      });
    }

    await supabase
      .from("assets")
      .update({ location_id: ipu_id })
      .eq("id", asset.id);

    await adjustTotals(ipu_id, asset.item_id, +1);

    await insertHistory({
      asset_id: asset.id,
      ipu_id,
      scan_type: SCAN_TYPE_UNDO,
      result: RESULT_SUCCESS,
      notes: "undid scan_out"
    });

    return json({
      status: RESULT_SUCCESS,
      item_name,
      notice: "undid_scan_out"
    });
  }

  if (undo_target === SCAN_TYPE_IN) {
    // undo a prior scan_in = move asset back out of this IPU
    if (asset.location_id !== ipu_id) {
      await insertHistory({
        asset_id: asset.id,
        ipu_id,
        scan_type: SCAN_TYPE_UNDO,
        result: RESULT_SUCCESS,
        notes: `undo requested for scan_in but asset not currently in ipu`
      });

      return json({
        status: RESULT_SUCCESS,
        item_name,
        notice: "nothing_to_undo"
      });
    }

    await supabase
      .from("assets")
      .update({ location_id: OUT_LOCATION_ID })
      .eq("id", asset.id);

    await adjustTotals(ipu_id, asset.item_id, -1);

    await insertHistory({
      asset_id: asset.id,
      ipu_id,
      scan_type: SCAN_TYPE_UNDO,
      result: RESULT_SUCCESS,
      notes: "undid scan_in"
    });

    return json({
      status: RESULT_SUCCESS,
      item_name,
      notice: "undid_scan_in"
    });
  }
}

    // ======================================================
    // SCAN OUT
    // ======================================================
    if (scan_type === SCAN_TYPE_OUT) {

      const original_location = asset.location_id;

      await supabase
        .from("assets")
        .update({ location_id: OUT_LOCATION_ID })
        .eq("id", asset.id);

      await adjustTotals(original_location, asset.item_id, -1);

      await insertHistory({
        asset_id: asset.id,
        ipu_id,
        scan_type,
        result: RESULT_SUCCESS,
        notes: null
      });

      return json({
        status: RESULT_SUCCESS,
        item_name
      });
    }

    // ======================================================
    // SCAN IN
    // ======================================================
    if (scan_type === SCAN_TYPE_IN) {

     // inside SCAN IN
if (asset.location_id === ipu_id) {
  await adjustTotals(ipu_id, asset.item_id, +1); // ✅ only change: count++

  await insertHistory({
    asset_id: asset.id,
    ipu_id,
    scan_type,
    result: RESULT_SUCCESS,
    notes: "already on hand; incremented count"
  });

  return json({
    status: RESULT_SUCCESS,                 // ✅ front-end shows success
    item_name,
    notice: RESULT_ALREADY_ON_HAND          // ✅ tells you why it was “special”
  });
}

      const original_location = asset.location_id;

      await supabase
        .from("assets")
        .update({ location_id: ipu_id })
        .eq("id", asset.id);

      await adjustTotals(ipu_id, asset.item_id, +1);
      await adjustTotals(original_location, asset.item_id, -1);

      await insertHistory({
        asset_id: asset.id,
        ipu_id,
        scan_type,
        result: RESULT_SUCCESS,
        notes: null
      });

      return json({
        status: RESULT_SUCCESS,
        item_name
      });
    }

    // ======================================================
    // VERIFY
    // ======================================================
    return json({
      status: RESULT_SUCCESS,
      item_name
    });

  } catch (err) {
    return json(
      { error: "Server error", details: String(err) },
      500
    );
  }
});