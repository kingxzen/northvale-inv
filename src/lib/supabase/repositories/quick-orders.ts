"use client";

import { createClient } from "@/lib/supabase/browser";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import type { QuickOrderRecord } from "@/lib/operations-store";
import { isUuid } from "@/lib/utils";

export function isSupabaseConfigured() {
  return hasSupabaseConfig();
}

export async function listQuickOrdersFromSupabase(): Promise<QuickOrderRecord[]> {
  if (!isSupabaseConfigured()) throw new Error("Supabase is not configured");
  const supabase = createClient();
  
  const { data: orders, error } = await supabase
    .from("quick_orders")
    .select(`
      *,
      quick_order_lines(*, products!quick_order_lines_product_id_fkey(legacy_id, id)),
      quick_order_packing_groups(*, packing_templates!quick_order_packing_groups_packing_template_id_fkey(legacy_id, id)),
      quick_order_materials(*, inventory_items!quick_order_materials_inventory_item_id_fkey(legacy_id, id)),
      quick_order_logs(*)
    `);
    
  if (error) throw error;
  
  return (orders || []).map(row => {
    return {
      id: row.legacy_id ?? row.id,
      status: row.status as any,
      platform: row.platform,
      referenceNo: row.reference_no || "",
      targetShipDate: row.target_ship_date || undefined,
      preparedBy: row.prepared_by || "",
      processedBy: row.processed_by || undefined,
      completedBy: row.completed_by || undefined,
      notes: row.notes || undefined,
      createdAt: row.created_at,
      processedAt: row.processed_at || undefined,
      packedAt: row.packed_at || undefined,
      completedAt: row.completed_at || undefined,
      inventoryDeducted: row.inventory_deducted ?? false,
      otherExpense: undefined, // Add logic if needed
      lines: (row.quick_order_lines || []).map((line: any) => {
         const p = Array.isArray(line.products) ? line.products[0] : line.products;
         return {
           id: line.legacy_id ?? line.id,
           productId: p ? (p.legacy_id || p.id) : line.product_id,
           quantity: Number(line.quantity),
           notes: line.notes || undefined
         };
      }),
      groups: (row.quick_order_packing_groups || []).map((group: any) => {
         const pt = Array.isArray(group.packing_templates) ? group.packing_templates[0] : group.packing_templates;
         return {
           id: group.legacy_id ?? group.id,
           templateId: pt ? (pt.legacy_id || pt.id) : group.packing_template_id,
           assignedLineIds: group.assigned_line_ids || [],
           manualSets: group.manual_sets || "",
           notes: group.notes || undefined
         };
      }),
      materials: (row.quick_order_materials || []).map((mat: any) => {
         const i = Array.isArray(mat.inventory_items) ? mat.inventory_items[0] : mat.inventory_items;
         return {
           inventoryItemId: i ? (i.legacy_id || i.id) : mat.inventory_item_id,
           name: mat.name,
           required: Number(mat.required),
           unit: mat.unit,
           cost: mat.cost === null ? undefined : Number(mat.cost)
         };
      }),
      logs: (row.quick_order_logs || []).map((log: any) => ({
         text: log.text,
         actor: log.actor,
         createdAt: log.created_at
      }))
    };
  });
}

export async function saveQuickOrderToSupabase(order: QuickOrderRecord): Promise<QuickOrderRecord> {
  if (!isSupabaseConfigured()) throw new Error("Supabase is not configured");
  const supabase = createClient();

  const payload = {
    legacy_id: order.id,
    status: order.status,
    platform: order.platform,
    reference_no: order.referenceNo,
    target_ship_date: order.targetShipDate || null,
    prepared_by: order.preparedBy,
    processed_by: order.processedBy || null,
    completed_by: order.completedBy || null,
    notes: order.notes || null,
    inventory_deducted: order.inventoryDeducted ?? false,
    processed_at: order.processedAt || null,
    packed_at: order.packedAt || null,
    completed_at: order.completedAt || null,
    created_at: order.createdAt || new Date().toISOString()
  };

  const { data, error } = await supabase
    .from("quick_orders")
    .upsert(payload, { onConflict: "legacy_id" })
    .select("id")
    .single();

  if (error) throw error;
  
  const orderId = data.id;

  // Save lines
  if (order.lines) {
    await supabase.from("quick_order_lines").delete().eq("quick_order_id", orderId);
    const linePayloads = [];
    for (const line of order.lines) {
      const query = supabase.from("products").select("id");
      const { data: lp } = await (isUuid(line.productId)
        ? query.or(`id.eq.${line.productId},legacy_id.eq.${line.productId}`)
        : query.eq("legacy_id", line.productId)
      ).single();
      if (lp) {
        linePayloads.push({
          legacy_id: line.id,
          quick_order_id: orderId,
          product_id: lp.id,
          quantity: line.quantity,
          notes: line.notes || null
        });
      }
    }
    if (linePayloads.length > 0) await supabase.from("quick_order_lines").insert(linePayloads);
  }

  // Save groups
  if (order.groups) {
    await supabase.from("quick_order_packing_groups").delete().eq("quick_order_id", orderId);
    const groupPayloads = [];
    for (const group of order.groups) {
      let tId = null;
      if (group.templateId) {
        const query = supabase.from("packing_templates").select("id");
        const { data: pt } = await (isUuid(group.templateId)
          ? query.or(`id.eq.${group.templateId},legacy_id.eq.${group.templateId}`)
          : query.eq("legacy_id", group.templateId)
        ).single();
        if (pt) tId = pt.id;
      }
      groupPayloads.push({
        legacy_id: group.id,
        quick_order_id: orderId,
        packing_template_id: tId,
        assigned_line_ids: group.assignedLineIds || [],
        manual_sets: group.manualSets || "",
        notes: group.notes || null
      });
    }
    if (groupPayloads.length > 0) await supabase.from("quick_order_packing_groups").insert(groupPayloads);
  }

  // Save materials
  if (order.materials) {
    await supabase.from("quick_order_materials").delete().eq("quick_order_id", orderId);
    const matPayloads = [];
    for (const mat of order.materials) {
      let invId = null;
      if (mat.inventoryItemId) {
        const query = supabase.from("inventory_items").select("id");
        const { data: li } = await (isUuid(mat.inventoryItemId)
          ? query.or(`id.eq.${mat.inventoryItemId},legacy_id.eq.${mat.inventoryItemId}`)
          : query.eq("legacy_id", mat.inventoryItemId)
        ).single();
        if (li) invId = li.id;
      }
      matPayloads.push({
        quick_order_id: orderId,
        inventory_item_id: invId,
        name: mat.name,
        required: mat.required,
        unit: mat.unit,
        cost: mat.cost || null
      });
    }
    if (matPayloads.length > 0) await supabase.from("quick_order_materials").insert(matPayloads);
  }

  // Save logs
  if (order.logs) {
    await supabase.from("quick_order_logs").delete().eq("quick_order_id", orderId);
    const logPayloads = order.logs.map(log => ({
      quick_order_id: orderId,
      text: log.text,
      actor: log.actor,
      created_at: log.createdAt || new Date().toISOString()
    }));
    if (logPayloads.length > 0) await supabase.from("quick_order_logs").insert(logPayloads);
  }

  return order;
}
