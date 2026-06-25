"use client";

import { createClient } from "@/lib/supabase/browser";
import { hasSupabaseConfig } from "@/lib/supabase/config";
import type { ProductionJob } from "@/types/domain";
import { isUuid } from "@/lib/utils";

export function isSupabaseConfigured() {
  return hasSupabaseConfig();
}

export async function listProductionJobsFromSupabase(): Promise<ProductionJob[]> {
  if (!isSupabaseConfigured()) throw new Error("Supabase is not configured");
  const supabase = createClient();
  
  const { data: jobs, error } = await supabase
    .from("production_jobs")
    .select(`
      *,
      products!production_jobs_product_id_fkey(legacy_id, id),
      production_product_lines(*, products!production_product_lines_product_id_fkey(legacy_id, id)),
      production_additional_materials(*, inventory_items!production_additional_materials_inventory_item_id_fkey(legacy_id, id))
    `);
    
  if (error) throw error;
  
  return (jobs || []).map(row => {
    const prod = Array.isArray(row.products) ? row.products[0] : row.products;
    const prodId = prod ? (prod.legacy_id || prod.id) : row.product_id;

    return {
      id: row.legacy_id ?? row.id,
      jobNumber: row.job_number,
      productId: prodId,
      plannedBatchQty: Number(row.planned_batch_qty),
      status: row.status as any,
      scheduledFor: row.scheduled_for || undefined,
      dueDate: row.due_date || undefined,
      purpose: row.purpose || undefined,
      referenceNote: row.reference_note || undefined,
      preparedBy: row.prepared_by || undefined,
      notes: row.notes || undefined,
      completedAt: row.completed_at || undefined,
      createdAt: row.created_at || undefined,
      startedAt: row.started_at || undefined,
      isNew: row.is_new ?? false,
      isArchived: row.is_archived ?? false,
      productLines: (row.production_product_lines || []).map((line: any) => {
         const p = Array.isArray(line.products) ? line.products[0] : line.products;
         return {
           productId: p ? (p.legacy_id || p.id) : line.product_id,
           plannedBatchQty: Number(line.planned_batch_qty)
         };
      }),
      additionalMaterials: (row.production_additional_materials || []).map((mat: any) => {
         const i = Array.isArray(mat.inventory_items) ? mat.inventory_items[0] : mat.inventory_items;
         return {
           inventoryItemId: i ? (i.legacy_id || i.id) : mat.inventory_item_id,
           quantity: Number(mat.quantity),
           unit: mat.unit,
           reason: mat.reason || undefined
         };
      })
    };
  });
}

export async function saveProductionJobToSupabase(job: ProductionJob): Promise<ProductionJob> {
  if (!isSupabaseConfigured()) throw new Error("Supabase is not configured");
  const supabase = createClient();

  // Get product UUID
  let prodUuid = null;
  if (job.productId) {
    const query = supabase.from("products").select("id");
    const { data: p } = await (isUuid(job.productId)
      ? query.or(`id.eq.${job.productId},legacy_id.eq.${job.productId}`)
      : query.eq("legacy_id", job.productId)
    ).single();
    if (p) prodUuid = p.id;
  }
  
  if (!prodUuid) throw new Error("Product not found in Supabase.");

  const payload = {
    legacy_id: job.id,
    job_number: job.jobNumber,
    product_id: prodUuid,
    planned_batch_qty: job.plannedBatchQty,
    status: job.status,
    scheduled_for: job.scheduledFor || null,
    due_date: job.dueDate || null,
    purpose: job.purpose || null,
    reference_note: job.referenceNote || null,
    prepared_by: job.preparedBy || null,
    notes: job.notes || null,
    completed_at: job.completedAt || null,
    created_at: job.createdAt || new Date().toISOString(),
    started_at: job.startedAt || null,
    is_new: job.isNew ?? false,
    is_archived: job.isArchived ?? false
  };

  const { data, error } = await supabase
    .from("production_jobs")
    .upsert(payload, { onConflict: "legacy_id" })
    .select("id")
    .single();

  if (error) throw error;
  
  const jobId = data.id;

  // Manage lines
  if (job.productLines) {
    await supabase.from("production_product_lines").delete().eq("production_job_id", jobId);
    const linePayloads = [];
    for (const line of job.productLines) {
      const query = supabase.from("products").select("id");
      const { data: lp } = await (isUuid(line.productId)
        ? query.or(`id.eq.${line.productId},legacy_id.eq.${line.productId}`)
        : query.eq("legacy_id", line.productId)
      ).single();
      if (lp) {
        linePayloads.push({
          production_job_id: jobId,
          product_id: lp.id,
          planned_batch_qty: line.plannedBatchQty
        });
      }
    }
    if (linePayloads.length > 0) await supabase.from("production_product_lines").insert(linePayloads);
  }

  if (job.additionalMaterials) {
    await supabase.from("production_additional_materials").delete().eq("production_job_id", jobId);
    const matPayloads = [];
    for (const mat of job.additionalMaterials) {
      const query = supabase.from("inventory_items").select("id");
      const { data: li } = await (isUuid(mat.inventoryItemId)
        ? query.or(`id.eq.${mat.inventoryItemId},legacy_id.eq.${mat.inventoryItemId}`)
        : query.eq("legacy_id", mat.inventoryItemId)
      ).single();
      if (li) {
        matPayloads.push({
          production_job_id: jobId,
          inventory_item_id: li.id,
          quantity: mat.quantity,
          unit: mat.unit,
          reason: mat.reason || null
        });
      }
    }
    if (matPayloads.length > 0) await supabase.from("production_additional_materials").insert(matPayloads);
  }

  return job;
}
