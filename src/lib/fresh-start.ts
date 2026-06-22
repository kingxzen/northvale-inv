"use client";

import { createClient } from "@/lib/supabase/browser";
import { isSupabaseConfigured, listInventoryItemsFromSupabase } from "@/lib/supabase/repositories/inventory";
import type { InventoryItem } from "@/types/domain";

export type FreshStartResult = {
  cleared: true;
  items: (InventoryItem & { isArchived?: boolean })[];
};

const APP_LOCAL_STORAGE_KEYS = [
  "prodstock_inventory",
  "prodstock_products",
  "prodstock_bom",
  "prodstock_jobs",
  "prodstock_txns",
  "prodstock_logs",
  "prodstock_master_boms",
  "prodstock_product_bom_assignments",
  "prodstock_packing_templates",
  "prodstock_quick_orders"
];

const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

export function clearFreshStartLocalData() {
  APP_LOCAL_STORAGE_KEYS.forEach((key) => window.localStorage.removeItem(key));
}

async function archiveRemainingInventoryRows() {
  const current = await listInventoryItemsFromSupabase();
  if (!current.configured) return [];

  const supabase = createClient();
  for (const item of current.items) {
    let query = supabase
      .from("inventory_items")
      .update({
        is_archived: true
      })
      .select("id");

    query = isUuid(item.id) ? query.eq("id", item.id) : query.eq("legacy_id", item.id);
    const { error } = await query;

    if (error) throw new Error(`inventory_items: ${error.message}${error.code ? ` (${error.code})` : ""}${error.hint ? ` Hint: ${error.hint}` : ""}`);
  }

  const refreshed = await listInventoryItemsFromSupabase();
  return refreshed.items;
}

async function archiveSupabaseTable(table: string) {
  const supabase = createClient();
  const { error } = await supabase
    .from(table)
    .update({ status: "archived" })
    .neq("status", "archived");

  if (!error) return;

  const missingTable = error.code === "PGRST205" || error.code === "42P01";
  if (missingTable) return;

  throw new Error(`${table}: ${error.message}${error.code ? ` (${error.code})` : ""}${error.hint ? ` Hint: ${error.hint}` : ""}`);
}

async function archiveSupabaseBusinessTables() {
  await archiveSupabaseTable("master_boms");
  await archiveSupabaseTable("packing_templates");
}

export async function runFreshStartReset(): Promise<FreshStartResult> {
  clearFreshStartLocalData();

  if (!isSupabaseConfigured()) {
    return { cleared: true, items: [] };
  }

  await archiveSupabaseBusinessTables();
  const items = await archiveRemainingInventoryRows();

  return { cleared: true, items };
}
