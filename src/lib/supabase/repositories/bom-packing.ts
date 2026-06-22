"use client";

import { createClient } from "@/lib/supabase/browser";
import type {
  MasterBom,
  MasterBomLine,
  PackingTemplateLine,
  PackingTemplateRecord
} from "@/lib/operations-store";

type SupabaseProblemTable =
  | "master_boms"
  | "master_bom_lines"
  | "packing_templates"
  | "packing_template_lines";

export type SupabaseOperationalErrorInfo = {
  table: SupabaseProblemTable;
  message: string;
  code?: string;
  details?: string;
  hint?: string;
};

export class SupabaseOperationalError extends Error {
  info: SupabaseOperationalErrorInfo;

  constructor(info: SupabaseOperationalErrorInfo) {
    super(info.message);
    this.name = "SupabaseOperationalError";
    this.info = info;
  }
}

type SupabaseErrorLike = {
  message?: string;
  code?: string;
  details?: string;
  hint?: string;
};

type MasterBomRow = {
  id: string;
  legacy_id: string | null;
  name: string;
  family: string;
  yield_qty: number | string;
  yield_unit: MasterBom["yieldUnit"];
  status: MasterBom["status"];
};

type MasterBomLineRow = {
  id: string;
  legacy_id: string | null;
  master_bom_id: string;
  line_type: MasterBomLine["lineType"];
  inventory_item_id: string | null;
  quantity_per_batch: number | string;
  unit: string;
  cost_override: number | string | null;
  notes: string | null;
};

type PackingTemplateRow = {
  id: string;
  legacy_id: string | null;
  name: string;
  capacity: number | string;
  basis: PackingTemplateRecord["basis"];
  status: PackingTemplateRecord["status"];
};

type PackingTemplateLineRow = {
  id: string;
  legacy_id: string | null;
  packing_template_id: string;
  inventory_item_id: string;
  qty: number | string;
  unit: PackingTemplateLine["unit"];
  usage_rule: PackingTemplateLine["usageRule"];
};

type InventoryRefRow = {
  id: string;
  legacy_id: string | null;
};

const masterBomSelect = "id, legacy_id, name, family, yield_qty, yield_unit, status";
const masterBomLineSelect = "id, legacy_id, master_bom_id, line_type, inventory_item_id, quantity_per_batch, unit, cost_override, notes";
const packingTemplateSelect = "id, legacy_id, name, capacity, basis, status";
const packingTemplateLineSelect = "id, legacy_id, packing_template_id, inventory_item_id, qty, unit, usage_rule";

export function formatSupabaseOperationalError(error: unknown) {
  if (error instanceof SupabaseOperationalError) {
    const { table, message, code, details, hint } = error.info;
    return [
      `Supabase ${table} failed.`,
      `Table: ${table}.`,
      `Message: ${message}`,
      code ? `Code: ${code}` : null,
      details ? `Details: ${details}` : null,
      hint ? `Hint: ${hint}` : null
    ].filter(Boolean).join(" ");
  }
  return error instanceof Error ? error.message : "Supabase operation failed.";
}

function throwOperationalError(table: SupabaseProblemTable, error: unknown): never {
  const source = error as SupabaseErrorLike;
  throw new SupabaseOperationalError({
    table,
    message: source.message || "Check database table or policy.",
    code: source.code,
    details: source.details,
    hint: source.hint
  });
}

async function loadInventoryRefs(supabase: ReturnType<typeof createClient>) {
  const { data, error } = await supabase.from("inventory_items").select("id, legacy_id");
  if (error) throwOperationalError("master_bom_lines", error);
  const uuidToAppId = new Map<string, string>();
  const appIdToUuid = new Map<string, string>();
  (data ?? []).forEach((row) => {
    const ref = row as InventoryRefRow;
    uuidToAppId.set(ref.id, ref.legacy_id ?? ref.id);
    appIdToUuid.set(ref.id, ref.id);
    if (ref.legacy_id) appIdToUuid.set(ref.legacy_id, ref.id);
  });
  return { uuidToAppId, appIdToUuid };
}

function rowToMasterBom(row: MasterBomRow, lines: MasterBomLineRow[], uuidToAppId: Map<string, string>): MasterBom {
  return {
    id: row.legacy_id ?? row.id,
    name: row.name,
    family: row.family,
    yieldQty: Number(row.yield_qty),
    yieldUnit: row.yield_unit,
    status: row.status,
    lines: lines.map((line) => ({
      id: line.legacy_id ?? line.id,
      lineType: line.line_type,
      inventoryItemId: line.inventory_item_id ? uuidToAppId.get(line.inventory_item_id) ?? line.inventory_item_id : undefined,
      quantityPerBatch: Number(line.quantity_per_batch),
      unit: line.unit,
      costOverride: line.cost_override === null ? undefined : Number(line.cost_override),
      notes: line.notes ?? undefined
    }))
  };
}

function rowToPackingTemplate(
  row: PackingTemplateRow,
  lines: PackingTemplateLineRow[],
  uuidToAppId: Map<string, string>
): PackingTemplateRecord {
  return {
    id: row.legacy_id ?? row.id,
    name: row.name,
    capacity: Number(row.capacity),
    basis: row.basis,
    status: row.status,
    materials: lines.map((line) => ({
      id: line.legacy_id ?? line.id,
      inventoryItemId: uuidToAppId.get(line.inventory_item_id) ?? line.inventory_item_id,
      qty: Number(line.qty),
      unit: line.unit,
      usageRule: line.usage_rule
    }))
  };
}

export async function listMasterBomsFromSupabase() {
  const supabase = createClient();
  const refs = await loadInventoryRefs(supabase);

  const { data: bomRows, error: bomError } = await supabase
    .from("master_boms")
    .select(masterBomSelect)
    .order("name", { ascending: true });
  if (bomError) throwOperationalError("master_boms", bomError);

  const { data: lineRows, error: lineError } = await supabase
    .from("master_bom_lines")
    .select(masterBomLineSelect)
    .order("created_at", { ascending: true });
  if (lineError) throwOperationalError("master_bom_lines", lineError);

  return ((bomRows ?? []) as MasterBomRow[]).map((bom) =>
    rowToMasterBom(
      bom,
      ((lineRows ?? []) as MasterBomLineRow[]).filter((line) => line.master_bom_id === bom.id),
      refs.uuidToAppId
    )
  );
}

export async function saveMasterBomToSupabase(bom: MasterBom) {
  const supabase = createClient();
  const refs = await loadInventoryRefs(supabase);
  const bomPayload = {
    legacy_id: bom.id,
    name: bom.name,
    family: bom.family,
    yield_qty: Math.max(0.0001, bom.yieldQty),
    yield_unit: bom.yieldUnit,
    status: bom.status
  };

  const { data: existingBom, error: existingBomError } = await supabase
    .from("master_boms")
    .select(masterBomSelect)
    .eq("legacy_id", bom.id)
    .maybeSingle();
  if (existingBomError) throwOperationalError("master_boms", existingBomError);

  const bomWrite = existingBom
    ? supabase.from("master_boms").update(bomPayload).eq("id", (existingBom as MasterBomRow).id).select(masterBomSelect).single()
    : supabase.from("master_boms").insert(bomPayload).select(masterBomSelect).single();
  const { data: savedBom, error: bomError } = await bomWrite;
  if (bomError) throwOperationalError("master_boms", bomError);

  for (const line of bom.lines) {
    const inventoryUuid = line.inventoryItemId ? refs.appIdToUuid.get(line.inventoryItemId) ?? null : null;
    const linePayload = {
      legacy_id: line.id,
      master_bom_id: (savedBom as MasterBomRow).id,
      line_type: line.lineType,
      inventory_item_id: inventoryUuid,
      quantity_per_batch: Math.max(0.0001, line.quantityPerBatch),
      unit: line.unit,
      cost_override: line.costOverride ?? null,
      notes: line.notes ?? null
    };
    const { data: existingLine, error: existingLineError } = await supabase
      .from("master_bom_lines")
      .select(masterBomLineSelect)
      .eq("legacy_id", line.id)
      .maybeSingle();
    if (existingLineError) throwOperationalError("master_bom_lines", existingLineError);

    const lineWrite = existingLine
      ? supabase.from("master_bom_lines").update(linePayload).eq("id", (existingLine as MasterBomLineRow).id)
      : supabase.from("master_bom_lines").insert(linePayload);
    const { error: lineError } = await lineWrite;
    if (lineError) throwOperationalError("master_bom_lines", lineError);
  }

  return { ...bom };
}

export async function archiveMasterBomInSupabase(bom: MasterBom) {
  return saveMasterBomToSupabase({ ...bom, status: "archived" });
}

export async function listPackingTemplatesFromSupabase() {
  const supabase = createClient();
  const refs = await loadInventoryRefs(supabase);

  const { data: templateRows, error: templateError } = await supabase
    .from("packing_templates")
    .select(packingTemplateSelect)
    .order("name", { ascending: true });
  if (templateError) throwOperationalError("packing_templates", templateError);

  const { data: lineRows, error: lineError } = await supabase
    .from("packing_template_lines")
    .select(packingTemplateLineSelect)
    .order("created_at", { ascending: true });
  if (lineError) throwOperationalError("packing_template_lines", lineError);

  return ((templateRows ?? []) as PackingTemplateRow[]).map((template) =>
    rowToPackingTemplate(
      template,
      ((lineRows ?? []) as PackingTemplateLineRow[]).filter((line) => line.packing_template_id === template.id),
      refs.uuidToAppId
    )
  );
}

export async function savePackingTemplateToSupabase(template: PackingTemplateRecord) {
  const supabase = createClient();
  const refs = await loadInventoryRefs(supabase);
  const templatePayload = {
    legacy_id: template.id,
    name: template.name,
    capacity: Math.max(1, template.capacity),
    basis: template.basis,
    status: template.status
  };

  const { data: existingTemplate, error: existingTemplateError } = await supabase
    .from("packing_templates")
    .select(packingTemplateSelect)
    .eq("legacy_id", template.id)
    .maybeSingle();
  if (existingTemplateError) throwOperationalError("packing_templates", existingTemplateError);

  const templateWrite = existingTemplate
    ? supabase.from("packing_templates").update(templatePayload).eq("id", (existingTemplate as PackingTemplateRow).id).select(packingTemplateSelect).single()
    : supabase.from("packing_templates").insert(templatePayload).select(packingTemplateSelect).single();
  const { data: savedTemplate, error: templateError } = await templateWrite;
  if (templateError) throwOperationalError("packing_templates", templateError);

  for (const line of template.materials) {
    const inventoryUuid = refs.appIdToUuid.get(line.inventoryItemId);
    if (!inventoryUuid) continue;

    const linePayload = {
      legacy_id: line.id,
      packing_template_id: (savedTemplate as PackingTemplateRow).id,
      inventory_item_id: inventoryUuid,
      qty: Math.max(0.0001, line.qty),
      unit: line.unit,
      usage_rule: line.usageRule
    };
    const { data: existingLine, error: existingLineError } = await supabase
      .from("packing_template_lines")
      .select(packingTemplateLineSelect)
      .eq("legacy_id", line.id)
      .maybeSingle();
    if (existingLineError) throwOperationalError("packing_template_lines", existingLineError);

    const lineWrite = existingLine
      ? supabase.from("packing_template_lines").update(linePayload).eq("id", (existingLine as PackingTemplateLineRow).id)
      : supabase.from("packing_template_lines").insert(linePayload);
    const { error: lineError } = await lineWrite;
    if (lineError) throwOperationalError("packing_template_lines", lineError);
  }

  return { ...template };
}

export async function archivePackingTemplateInSupabase(template: PackingTemplateRecord) {
  return savePackingTemplateToSupabase({ ...template, status: "archived" });
}
