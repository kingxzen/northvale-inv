"use client";

import { createClient } from "@/lib/supabase/browser";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import type { Product, ProductBomLine } from "@/types/domain";
import { isUuid } from "@/lib/utils";

export function isSupabaseConfigured() {
  return hasSupabaseConfig();
}

export async function listProductsFromSupabase(): Promise<{ products: Product[], bomLines: ProductBomLine[] }> {
  if (!isSupabaseConfigured()) throw new Error("Supabase is not configured");
  const supabase = createClient();
  
  // We fetch products and their UUIDs so we can map them back to legacy_ids
  const { data: productsData, error: productsError } = await supabase
    .from("products")
    .select("*, inventory_items!products_finished_good_item_id_fkey(legacy_id, id)")
    .order("created_at", { ascending: false });
    
  if (productsError) throw productsError;
  
  const { data: linesData, error: linesError } = await supabase
    .from("product_bom_lines")
    .select("*, products(legacy_id, id), inventory_items(legacy_id, id)")
    .order("created_at", { ascending: false });
    
  if (linesError) throw linesError;
  
  const products: Product[] = (productsData || []).map(row => {
    // Attempt to map finishedGoodItemId back to legacy ID if available
    const fgItem = Array.isArray(row.inventory_items) ? row.inventory_items[0] : row.inventory_items;
    const fgItemId = fgItem ? (fgItem.legacy_id || fgItem.id) : row.finished_good_item_id;

    return {
      id: row.legacy_id ?? row.id,
      sku: row.sku,
      name: row.name,
      outputUnit: row.output_unit as any,
      batchSize: Number(row.batch_size),
      finishedGoodItemId: fgItemId,
      brand: row.brand || undefined,
      scent: row.scent || undefined,
      family: row.family || undefined,
      category: row.category || undefined,
      notes: row.notes || undefined,
      isArchived: row.is_archived
    };
  });
  
  const bomLines: ProductBomLine[] = (linesData || []).map(row => {
    const prod = Array.isArray(row.products) ? row.products[0] : row.products;
    const prodId = prod ? (prod.legacy_id || prod.id) : row.product_id;
    
    const invItem = Array.isArray(row.inventory_items) ? row.inventory_items[0] : row.inventory_items;
    const invItemId = invItem ? (invItem.legacy_id || invItem.id) : row.inventory_item_id;

    return {
      id: row.legacy_id ?? row.id,
      productId: prodId,
      inventoryItemId: invItemId || undefined,
      quantityPerBatch: Number(row.quantity_per_batch),
      unit: row.unit,
      lineType: row.line_type as any,
      costOverride: row.cost_override === null ? undefined : Number(row.cost_override),
      wastagePercent: row.wastage_percent === null ? undefined : Number(row.wastage_percent),
      notes: row.notes || undefined
    };
  });

  return { products, bomLines };
}

export async function saveProductToSupabase(product: Product): Promise<Product> {
  if (!isSupabaseConfigured()) throw new Error("Supabase is not configured");
  const supabase = createClient();

  // We need the internal UUID for finished_good_item_id
  const fgItemId = product.finishedGoodItemId;
  const fgQuery = supabase.from("inventory_items").select("id");
  
  let invItem = null;
  for (let i = 0; i < 3; i++) {
    const { data } = await (isUuid(fgItemId)
      ? fgQuery.or(`id.eq.${fgItemId},legacy_id.eq.${fgItemId}`)
      : fgQuery.eq("legacy_id", fgItemId)
    ).maybeSingle();

    if (data) {
      invItem = data;
      break;
    }
    // Wait 500ms before retrying in case the inventory item is still being created asynchronously
    await new Promise(res => setTimeout(res, 500));
  }

  if (!invItem) throw new Error(`Finished good inventory item not found in Supabase (ID: ${fgItemId}).`);

  const payload = {
    legacy_id: product.id,
    sku: product.sku,
    name: product.name,
    output_unit: product.outputUnit,
    batch_size: product.batchSize,
    finished_good_item_id: invItem.id,
    brand: product.brand || null,
    scent: product.scent || null,
    family: product.family || null,
    category: product.category || null,
    notes: product.notes || null,
    is_archived: product.isArchived ?? false
  };

  const { data, error } = await supabase
    .from("products")
    .upsert(payload, { onConflict: "legacy_id" })
    .select("*")
    .single();

  if (error) throw new Error(`Product upsert error: ${error.message} - ${error.details || ''}`);
  
  return product;
}

export async function saveProductBomLinesToSupabase(productId: string, lines: ProductBomLine[]): Promise<void> {
  if (!isSupabaseConfigured()) throw new Error("Supabase is not configured");
  const supabase = createClient();

  // First, get the product's UUID
  const prodQuery = supabase.from("products").select("id");
  const { data: prod } = await (isUuid(productId)
    ? prodQuery.or(`id.eq.${productId},legacy_id.eq.${productId}`)
    : prodQuery.eq("legacy_id", productId)
  ).single();

  if (!prod) throw new Error("Product not found in Supabase.");

  // For inventory items, we need to map their legacy IDs to UUIDs
  const linePayloads = [];
  for (const line of lines) {
    let invItemId = null;
    if (line.inventoryItemId) {
      const itemQuery = supabase.from("inventory_items").select("id");
      const { data: inv, error: invError } = await (isUuid(line.inventoryItemId)
        ? itemQuery.or(`id.eq.${line.inventoryItemId},legacy_id.eq.${line.inventoryItemId}`)
        : itemQuery.eq("legacy_id", line.inventoryItemId)
      ).maybeSingle();
      if (invError) throw new Error(`BOM Line inventory lookup error: ${invError.message}`);
      if (inv) invItemId = inv.id;
    }

    linePayloads.push({
      legacy_id: line.id,
      product_id: prod.id,
      inventory_item_id: invItemId,
      quantity_per_batch: line.quantityPerBatch,
      unit: line.unit,
      line_type: line.lineType,
      cost_override: line.costOverride || null,
      wastage_percent: line.wastagePercent || null,
      notes: line.notes || null
    });
  }

  // Delete existing lines
  await supabase.from("product_bom_lines").delete().eq("product_id", prod.id);

  if (linePayloads.length > 0) {
    const { error } = await supabase.from("product_bom_lines").insert(linePayloads);
    if (error) throw new Error(`Product BOM lines insert error: ${error.message} - ${error.details || ''}`);
  }
}

export async function deleteProductFromSupabase(productId: string): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const supabase = createClient();

  const query = supabase.from("products").select("id");
  const { data: prod } = await (isUuid(productId)
    ? query.or(`id.eq.${productId},legacy_id.eq.${productId}`)
    : query.eq("legacy_id", productId)
  ).single();

  if (!prod) return;

  const { error } = await supabase.from("products").delete().eq("id", prod.id);
  if (error) throw error;
}
