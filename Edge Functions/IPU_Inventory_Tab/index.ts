// ============================================================
// SUPABASE EDGE FUNCTION — INVENTORY ADMIN
// supports:
// - list_items
// - list_locations
// - search_assets
// - get_asset
// - create_asset
// - update_asset
// - move_asset
// - delete_asset
// ============================================================

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function cleanString(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function toPositiveInt(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function badRequest(message: string) {
  return json({ status: "error", error: message }, 400);
}

async function getAssetByIdOrNumber(params: {
  id?: unknown;
  asset_number?: unknown;
}) {
  const id = toPositiveInt(params.id);
  const asset_number = cleanString(params.asset_number);

  if (!id && !asset_number) {
    return { error: "Missing asset_number or id", asset: null };
  }

  let query = supabase
    .from("assets")
    .select(`
      id,
      item_id,
      asset_number,
      serial_number,
      location_id,
      items ( id, name ),
      locations ( id, name )
    `);

  if (id) {
    query = query.eq("id", id);
  } else {
    query = query.eq("asset_number", asset_number);
  }

  const { data, error } = await query.maybeSingle();

  if (error) throw new Error(error.message);

  return { error: null, asset: data ?? null };
}

Deno.serve(async (req: Request) => {
  try {
    if (req.method === "OPTIONS") {
      return new Response("ok", { headers: corsHeaders });
    }

    if (req.method !== "POST") {
      return json({ status: "error", error: "Method not allowed" }, 405);
    }

    let body: Record<string, unknown> = {};
    try {
      body = await req.json();
    } catch {
      return badRequest("Invalid JSON body");
    }

    const action = cleanString(body.action);

    if (!action) {
      return badRequest("Missing action");
    }

    // ======================================================
    // LIST ITEMS
    // ======================================================
    if (action === "list_items") {
      const { data, error } = await supabase
        .from("items")
        .select("id, name")
        .order("name", { ascending: true });

      if (error) throw new Error(error.message);

      return json({
        status: "success",
        items: data ?? [],
      });
    }

    // ======================================================
    // LIST LOCATIONS
    // ======================================================
    if (action === "list_locations") {
      const { data, error } = await supabase
        .from("locations")
        .select("id, name")
        .order("id", { ascending: true });

      if (error) throw new Error(error.message);

      return json({
        status: "success",
        locations: data ?? [],
      });
    }

    // ======================================================
    // SEARCH ASSETS
    // FULL backend search + pagination
    // - location filter in backend
    // - q search in backend
    // - returns filtered_count + total_count
    // ======================================================
    if (action === "search_assets") {
      const location_id = toPositiveInt(body.location_id);
      const q = cleanString(body.q);

      const limit = toPositiveInt(body.limit) ?? 100;
      const rawOffset = Number(body.offset);
      const offset =
        Number.isFinite(rawOffset) && rawOffset >= 0 ? Math.floor(rawOffset) : 0;

      let query = supabase
        .from("assets")
        .select(
          `
          id,
          item_id,
          asset_number,
          serial_number,
          location_id,
          items:items!assets_item_id_fkey ( id, name ),
          locations:locations!assets_location_id_fkey ( id, name )
        `,
          { count: "exact" }
        );

      if (location_id) {
        query = query.eq("location_id", location_id);
      }

      if (q) {
        query = query.or(`asset_number.ilike.%${q}%,items.name.ilike.%${q}%`);
      }

      const { data, count: filteredCount, error } = await query
        .order("asset_number", { ascending: true })
        .range(offset, offset + limit - 1);

      if (error) throw new Error(error.message);

      const { count: totalCount, error: totalError } = await supabase
        .from("assets")
        .select("*", { count: "exact", head: true });

      if (totalError) throw new Error(totalError.message);

      return json({
        status: "success",
        assets: data ?? [],
        filtered_count: filteredCount ?? 0,
        total_count: totalCount ?? 0,
        returned_count: Array.isArray(data) ? data.length : 0,
        offset,
        limit,
      });
    }
    // ======================================================
    // CREATE ASSET
    // ======================================================
    if (action === "create_asset") {
      const asset_number = cleanString(body.asset_number);
      const serial_number = cleanString(body.serial_number);
      const item_id = toPositiveInt(body.item_id);
      const location_id = toPositiveInt(body.location_id);

      if (!asset_number || !item_id || !location_id) {
        return badRequest("Missing required fields");
      }

      const { data: existing, error: checkError } = await supabase
        .from("assets")
        .select("id")
        .eq("asset_number", asset_number)
        .maybeSingle();

      if (checkError) throw new Error(checkError.message);

      if (existing) {
        return json({
          status: "asset_number_taken",
          error: "That asset number already exists",
        });
      }

      const insertPayload: Record<string, unknown> = {
        asset_number,
        item_id,
        location_id,
      };

      if (serial_number) {
        insertPayload.serial_number = serial_number;
      }

      const { data, error } = await supabase
        .from("assets")
        .insert(insertPayload)
        .select(`
          id,
          item_id,
          asset_number,
          serial_number,
          location_id,
          items ( id, name ),
          locations ( id, name )
        `)
        .single();

      if (error) throw new Error(error.message);

      return json({
        status: "success",
        asset: data,
      });
    }

    // ======================================================
    // UPDATE ASSET
    // ======================================================
    if (action === "update_asset") {
      const id = toPositiveInt(body.id);
      const asset_number = cleanString(body.asset_number);
      const serial_number = cleanString(body.serial_number);
      const item_id = toPositiveInt(body.item_id);
      const location_id = toPositiveInt(body.location_id);

      if (!id || !asset_number || !item_id || !location_id) {
        return badRequest("Missing required fields");
      }

      const { data: existing, error: existingError } = await supabase
        .from("assets")
        .select("id")
        .eq("id", id)
        .maybeSingle();

      if (existingError) throw new Error(existingError.message);

      if (!existing) {
        return json({ status: "not_found", asset: null }, 200);
      }

      const { data: dupe, error: dupeError } = await supabase
        .from("assets")
        .select("id")
        .eq("asset_number", asset_number)
        .neq("id", id)
        .maybeSingle();

      if (dupeError) throw new Error(dupeError.message);

      if (dupe) {
        return json({
          status: "asset_number_taken",
          error: "That asset number already exists",
        });
      }

      const updatePayload: Record<string, unknown> = {
        asset_number,
        item_id,
        location_id,
        serial_number: serial_number || null,
      };

      const { data, error } = await supabase
        .from("assets")
        .update(updatePayload)
        .eq("id", id)
        .select(`
          id,
          item_id,
          asset_number,
          serial_number,
          location_id,
          items ( id, name ),
          locations ( id, name )
        `)
        .single();

      if (error) throw new Error(error.message);

      return json({
        status: "success",
        asset: data,
      });
    }

    // ======================================================
    // MOVE ASSET
    // ======================================================
    if (action === "move_asset") {
      const location_id = toPositiveInt(body.location_id);

      if (!location_id) {
        return badRequest("Missing location_id");
      }

      const result = await getAssetByIdOrNumber({
        id: body.id,
        asset_number: body.asset_number,
      });

      if (result.error) {
        return badRequest(result.error);
      }

      if (!result.asset) {
        return json({ status: "not_found", asset: null }, 200);
      }

      const { data, error } = await supabase
        .from("assets")
        .update({ location_id })
        .eq("id", result.asset.id)
        .select(`
          id,
          item_id,
          asset_number,
          serial_number,
          location_id,
          items ( id, name ),
          locations ( id, name )
        `)
        .single();

      if (error) throw new Error(error.message);

      return json({
        status: "success",
        asset: data,
      });
    }

    // ======================================================
    // DELETE ASSET
    // ======================================================
    if (action === "delete_asset") {
      const result = await getAssetByIdOrNumber({
        id: body.id,
        asset_number: body.asset_number,
      });

      if (result.error) {
        return badRequest(result.error);
      }

      if (!result.asset) {
        return json({ status: "not_found", asset: null }, 200);
      }

      const { error } = await supabase
        .from("assets")
        .delete()
        .eq("id", result.asset.id);

      if (error) throw new Error(error.message);

      return json({
        status: "success",
        deleted_id: result.asset.id,
        deleted_asset_number: result.asset.asset_number,
      });
    }

    return badRequest("Unknown action");
  } catch (err) {
    return json(
      {
        status: "error",
        error: "Server error",
        details: err instanceof Error ? err.message : String(err),
      },
      500
    );
  }
});