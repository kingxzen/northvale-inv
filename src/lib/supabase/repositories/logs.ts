"use client";

import { createClient } from "@/lib/supabase/browser";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import type { StockTransaction, ActivityLog } from "@/types/domain";
import { isUuid } from "@/lib/utils";

export function isSupabaseConfigured() {
  return hasSupabaseConfig();
}

export async function listStockTransactionsFromSupabase(): Promise<StockTransaction[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = createClient();
  
  const { data, error } = await supabase
    .from("stock_transactions")
    .select("*, inventory_items!stock_transactions_inventory_item_id_fkey(legacy_id, id), quick_orders(legacy_id, id)");
    
  if (error) throw error;
  
  return (data || []).map(row => {
    const inv = Array.isArray(row.inventory_items) ? row.inventory_items[0] : row.inventory_items;
    const invId = inv ? (inv.legacy_id || inv.id) : row.inventory_item_id;
    
    const qo = Array.isArray(row.quick_orders) ? row.quick_orders[0] : row.quick_orders;
    const qoId = qo ? (qo.legacy_id || qo.id) : row.quick_order_id;
    
    return {
      id: row.legacy_id ?? row.id,
      inventoryItemId: invId,
      type: row.type as any,
      quantity: Number(row.quantity),
      unit: row.unit as any,
      reason: row.reason || undefined,
      createdAt: row.created_at,
      reference: row.reference || undefined,
      beforeQuantity: row.before_quantity === null ? undefined : Number(row.before_quantity),
      afterQuantity: row.after_quantity === null ? undefined : Number(row.after_quantity)
    };
  });
}

export async function saveStockTransactionToSupabase(txn: StockTransaction): Promise<StockTransaction> {
  if (!isSupabaseConfigured()) return txn;
  const supabase = createClient();

  let invId = null;
  if (txn.inventoryItemId) {
    const query = supabase.from("inventory_items").select("id");
    const { data: i } = await (isUuid(txn.inventoryItemId)
      ? query.or(`id.eq.${txn.inventoryItemId},legacy_id.eq.${txn.inventoryItemId}`)
      : query.eq("legacy_id", txn.inventoryItemId)
    ).single();
    if (i) invId = i.id;
  }
  
  const payload = {
    legacy_id: txn.id,
    inventory_item_id: invId,
    type: txn.type,
    quantity: txn.quantity,
    unit: txn.unit,
    reason: txn.reason || null,
    created_at: txn.createdAt || new Date().toISOString(),
    reference: txn.reference || null,
    before_quantity: txn.beforeQuantity ?? null,
    after_quantity: txn.afterQuantity ?? null
  };

  const { error } = await supabase.from("stock_transactions").upsert(payload, { onConflict: "legacy_id" });
  if (error) throw error;
  
  return txn;
}

export async function listActivityLogsFromSupabase(): Promise<ActivityLog[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = createClient();
  
  const { data, error } = await supabase
    .from("activity_logs")
    .select("*")
    .order("created_at", { ascending: false });
    
  if (error) throw error;
  
  return (data || []).map(row => ({
    id: row.legacy_id ?? row.id,
    actorName: row.actor_name || row.actor_id || "System",
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_legacy_id || row.entity_id || "",
    createdAt: row.created_at
  }));
}

export async function saveActivityLogToSupabase(log: ActivityLog): Promise<ActivityLog> {
  if (!isSupabaseConfigured()) return log;
  const supabase = createClient();

  const payload = {
    legacy_id: log.id,
    actor_name: log.actorName,
    action: log.action,
    entity_type: log.entityType,
    entity_legacy_id: log.entityId,
    created_at: log.createdAt || new Date().toISOString()
  };

  const { error } = await supabase.from("activity_logs").upsert(payload, { onConflict: "legacy_id" });
  if (error) throw error;
  
  return log;
}
