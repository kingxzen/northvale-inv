"use client";

import { createClient } from "@/lib/supabase/browser";
import { createInventoryItemInSupabase, isSupabaseConfigured, listInventoryItemsFromSupabase } from "@/lib/supabase/repositories/inventory";
import type { InventoryItem, InventoryUnit } from "@/types/domain";

export type FreshStartResult = {
  packagingCount: number;
  rawCount: number;
  added: number;
  skipped: number;
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

const NIL_UUID = "00000000-0000-0000-0000-000000000000";

const PACKAGING_ITEMS = [
  "Jerry Can Bottle 4L Gal White",
  "3.8L Gal White Round Bottle",
  "8oz Gal Natural White Round Bottle",
  "Tubular Bottle Clear 500ml with Flipcap Clear",
  "Tubular Bottle Clear 150ml with Back Sprayer",
  "Petone Bottle 65ml Natural White",
  "DIY Plastic",
  "Curl Quad AH Sticker",
  "Stretch Film Black",
  "Clear Tape",
  "Fragile Tape",
  "Bubble Wrap",
  "Air Column",
  "Black Pouch Medium",
  "Black Pouch XXL",
  "Box By 4",
  "Single Box"
];

const RAW_ITEMS = [
  "Potassium Hydroxide",
  "Xanthan Gum",
  "Bicarbonate",
  "Calcium Hypochlorite",
  "Colorant Orange Shade",
  "Colorant Strawberry Red",
  "Colorant Green Shade",
  "Colorant Lemon Yellow",
  "Colorant Violet Ube",
  "Colorant Blue Shade",
  "Fragrance Lemon",
  "Fragrance Compating",
  "Fragrance Lavender",
  "Fragrance Baby Powder",
  "Fragrance Chamomile",
  "Fragrance Passion",
  "Fragrance Bombshell",
  "Surfactant SLES",
  "Refined Salt",
  "Solar Salt",
  "CDEA",
  "NP10",
  "DPG",
  "Glycerine",
  "Betaine",
  "Preservatives",
  "Methanol",
  "Ethyl Alcohol",
  "Hydrogen Peroxide 50%",
  "Falcon Beads",
  "Kahl Wax",
  "Caustic Pearl",
  "AOS Powder",
  "CMC A+ Tinson",
  "CMC Chem",
  "CMC Illyon",
  "Sodium Gluconate",
  "Soda Ash",
  "Citric Acid",
  "Titanium"
];

const LITER_RAW_NAMES = new Set([
  "CDEA",
  "NP10",
  "DPG",
  "Glycerine",
  "Betaine",
  "Preservatives",
  "Methanol",
  "Ethyl Alcohol",
  "Hydrogen Peroxide 50%"
]);

export function clearFreshStartLocalData() {
  APP_LOCAL_STORAGE_KEYS.forEach((key) => window.localStorage.removeItem(key));
}

export function getFreshStartMasterCounts() {
  return { packagingCount: PACKAGING_ITEMS.length, rawCount: RAW_ITEMS.length };
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function rawUnit(name: string): InventoryUnit {
  if (name.startsWith("Fragrance ") || name.startsWith("Colorant ") || LITER_RAW_NAMES.has(name)) return "liter";
  return "kg";
}

function masterItem(name: string, category: InventoryItem["category"], index: number): InventoryItem & { isArchived?: boolean } {
  const prefix = category === "packaging" ? "pkg" : "raw";
  return {
    id: `item-${prefix}-${slugify(name)}`,
    sku: `${prefix.toUpperCase()}-${String(index + 1).padStart(3, "0")}-${slugify(name).slice(0, 24).toUpperCase()}`,
    name,
    category,
    unit: category === "packaging" ? "pcs" : rawUnit(name),
    quantityOnHand: 0,
    reorderPoint: 0,
    locationId: category === "packaging" ? "loc-a2" : "loc-a1",
    unitCost: undefined,
    status: "active",
    isArchived: false
  };
}

export function buildFreshStartInventoryMasterList() {
  return [
    ...PACKAGING_ITEMS.map((name, index) => masterItem(name, "packaging", index)),
    ...RAW_ITEMS.map((name, index) => masterItem(name, "raw", index))
  ];
}

async function deleteAllRows(table: string) {
  const supabase = createClient();
  const { error } = await supabase.from(table).delete().neq("id", NIL_UUID);
  if (error) throw new Error(`${table}: ${error.message}${error.code ? ` (${error.code})` : ""}${error.hint ? ` Hint: ${error.hint}` : ""}`);
}

async function clearSupabaseBusinessTables() {
  const orderedTables = [
    "quick_order_logs",
    "quick_order_materials",
    "quick_order_packing_groups",
    "quick_order_lines",
    "quick_orders",
    "stock_transactions",
    "production_additional_materials",
    "production_product_lines",
    "production_job_lines",
    "production_jobs",
    "product_bom_assignments",
    "packing_template_lines",
    "packing_templates",
    "master_bom_lines",
    "master_boms",
    "product_bom_lines",
    "products",
    "activity_logs",
    "inventory_items"
  ];

  for (const table of orderedTables) {
    await deleteAllRows(table);
  }
}

async function importInventoryMasterList() {
  const masterItems = buildFreshStartInventoryMasterList();
  const current = await listInventoryItemsFromSupabase();
  if (!current.configured) throw new Error("Supabase is not configured.");

  const existingKeys = new Set(
    current.items.flatMap((item) => [item.name.trim().toLowerCase(), item.sku.trim().toLowerCase()])
  );

  let added = 0;
  let skipped = 0;

  for (const item of masterItems) {
    const nameKey = item.name.trim().toLowerCase();
    const skuKey = item.sku.trim().toLowerCase();
    if (existingKeys.has(nameKey) || existingKeys.has(skuKey)) {
      skipped += 1;
      continue;
    }

    await createInventoryItemInSupabase(item);
    existingKeys.add(nameKey);
    existingKeys.add(skuKey);
    added += 1;
  }

  const refreshed = await listInventoryItemsFromSupabase();
  return { added, skipped, items: refreshed.items };
}

export async function runFreshStartResetAndImport(): Promise<FreshStartResult> {
  if (!isSupabaseConfigured()) throw new Error("Supabase is not configured.");

  clearFreshStartLocalData();
  await clearSupabaseBusinessTables();
  const imported = await importInventoryMasterList();
  const counts = getFreshStartMasterCounts();

  return {
    ...counts,
    added: imported.added,
    skipped: imported.skipped,
    items: imported.items
  };
}
