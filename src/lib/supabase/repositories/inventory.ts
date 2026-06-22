"use client";

import { createClient } from "@/lib/supabase/browser";
import type { InventoryItem } from "@/types/domain";

type InventoryRow = {
  id: string;
  legacy_id: string | null;
  sku: string;
  name: string;
  category: InventoryItem["category"];
  unit: InventoryItem["unit"];
  quantity_on_hand: number | string;
  reorder_point: number | string;
  location_legacy_id: string | null;
  unit_cost: number | string | null;
  status: InventoryItem["status"];
  is_archived: boolean;
};

export type InventoryImportSummary = {
  added: number;
  skipped: number;
  updated: number;
};

export type InventorySupabaseErrorInfo = {
  table: "inventory_items";
  message: string;
  code?: string;
  details?: string;
  hint?: string;
};

export class InventorySupabaseError extends Error {
  info: InventorySupabaseErrorInfo;

  constructor(info: InventorySupabaseErrorInfo) {
    super(info.message);
    this.name = "InventorySupabaseError";
    this.info = info;
  }
}

export function isSupabaseConfigured() {
  return Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}

const isUuid = (value: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

function rowToInventoryItem(row: InventoryRow): InventoryItem & { isArchived?: boolean } {
  return {
    id: row.legacy_id ?? row.id,
    sku: row.sku,
    name: row.name,
    category: row.category,
    unit: row.unit,
    quantityOnHand: Number(row.quantity_on_hand),
    reorderPoint: Number(row.reorder_point),
    locationId: row.location_legacy_id ?? "",
    unitCost: row.unit_cost === null ? undefined : Number(row.unit_cost),
    status: row.status,
    isArchived: row.is_archived
  };
}

function inventoryItemToInsert(item: InventoryItem & { isArchived?: boolean }) {
  return {
    legacy_id: item.id,
    sku: item.sku,
    name: item.name,
    category: item.category,
    unit: item.unit,
    quantity_on_hand: item.quantityOnHand,
    reorder_point: item.reorderPoint,
    location_legacy_id: item.locationId,
    unit_cost: item.unitCost ?? null,
    status: item.status,
    is_archived: item.isArchived ?? false
  };
}

function inventoryItemToUpdate(updates: Partial<InventoryItem & { isArchived?: boolean }>) {
  const payload: Record<string, unknown> = {};
  if (updates.sku !== undefined) payload.sku = updates.sku;
  if (updates.name !== undefined) payload.name = updates.name;
  if (updates.category !== undefined) payload.category = updates.category;
  if (updates.unit !== undefined) payload.unit = updates.unit;
  if (updates.quantityOnHand !== undefined) payload.quantity_on_hand = updates.quantityOnHand;
  if (updates.reorderPoint !== undefined) payload.reorder_point = updates.reorderPoint;
  if (updates.locationId !== undefined) payload.location_legacy_id = updates.locationId;
  if (updates.unitCost !== undefined) payload.unit_cost = updates.unitCost ?? null;
  if (updates.status !== undefined) payload.status = updates.status;
  if (updates.isArchived !== undefined) payload.is_archived = updates.isArchived;
  return payload;
}

function throwInventoryError(error: unknown): never {
  const source = error as { message?: string; code?: string; details?: string; hint?: string };
  throw new InventorySupabaseError({
    table: "inventory_items",
    message: source.message || "Supabase inventory failed to load. Check database table or policy.",
    code: source.code,
    details: source.details,
    hint: source.hint
  });
}

export async function listInventoryItemsFromSupabase() {
  if (!isSupabaseConfigured()) return { configured: false as const, items: [] };

  const supabase = createClient();
  const { data, error } = await supabase
    .from("inventory_items")
    .select("id, legacy_id, sku, name, category, unit, quantity_on_hand, reorder_point, location_legacy_id, unit_cost, status, is_archived")
    .order("name", { ascending: true });

  if (error) throwInventoryError(error);
  return { configured: true as const, items: (data ?? []).map((row) => rowToInventoryItem(row as InventoryRow)) };
}

export async function createInventoryItemInSupabase(item: InventoryItem & { isArchived?: boolean }) {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("inventory_items")
    .insert(inventoryItemToInsert(item))
    .select("id, legacy_id, sku, name, category, unit, quantity_on_hand, reorder_point, location_legacy_id, unit_cost, status, is_archived")
    .single();

  if (error) throwInventoryError(error);
  return rowToInventoryItem(data as InventoryRow);
}

export async function updateInventoryItemInSupabase(id: string, updates: Partial<InventoryItem & { isArchived?: boolean }>) {
  const supabase = createClient();
  let updateQuery = supabase
    .from("inventory_items")
    .update(inventoryItemToUpdate(updates))
    .select("id, legacy_id, sku, name, category, unit, quantity_on_hand, reorder_point, location_legacy_id, unit_cost, status, is_archived");
  updateQuery = isUuid(id) ? updateQuery.eq("id", id) : updateQuery.eq("legacy_id", id);
  const { data, error } = await updateQuery.single();

  if (error) throwInventoryError(error);
  return rowToInventoryItem(data as InventoryRow);
}

export async function importLocalInventoryToSupabase(items: (InventoryItem & { isArchived?: boolean })[]): Promise<InventoryImportSummary> {
  const current = await listInventoryItemsFromSupabase();
  if (!current.configured) throw new Error("Supabase is not configured.");

  const existingKeys = new Set(
    current.items.flatMap((item) => [
      item.sku.trim().toLowerCase(),
      item.name.trim().toLowerCase()
    ])
  );

  let added = 0;
  let skipped = 0;

  for (const item of items) {
    const skuKey = item.sku.trim().toLowerCase();
    const nameKey = item.name.trim().toLowerCase();
    if (existingKeys.has(skuKey) || existingKeys.has(nameKey)) {
      skipped += 1;
      continue;
    }

    await createInventoryItemInSupabase(item);
    existingKeys.add(skuKey);
    existingKeys.add(nameKey);
    added += 1;
  }

  return { added, skipped, updated: 0 };
}

export async function restoreInventoryToSupabase(
  items: (InventoryItem & { isArchived?: boolean })[],
  mode: "safe-merge" | "full-after-fresh-start"
): Promise<InventoryImportSummary & { items: (InventoryItem & { isArchived?: boolean })[] }> {
  const current = await listInventoryItemsFromSupabase();
  if (!current.configured) throw new Error("Supabase is not configured.");

  const byKey = new Map<string, InventoryItem & { isArchived?: boolean }>();
  current.items.forEach((item) => {
    byKey.set(item.id.trim().toLowerCase(), item);
    byKey.set(item.sku.trim().toLowerCase(), item);
    byKey.set(item.name.trim().toLowerCase(), item);
  });

  let added = 0;
  let skipped = 0;
  let updated = 0;

  for (const item of items) {
    const match = byKey.get(item.id.trim().toLowerCase())
      ?? byKey.get(item.sku.trim().toLowerCase())
      ?? byKey.get(item.name.trim().toLowerCase());

    if (match && mode === "safe-merge") {
      skipped += 1;
      continue;
    }

    if (match) {
      await updateInventoryItemInSupabase(match.id, item);
      updated += 1;
      continue;
    }

    await createInventoryItemInSupabase(item);
    added += 1;
  }

  const refreshed = await listInventoryItemsFromSupabase();
  return { added, skipped, updated, items: refreshed.items };
}
