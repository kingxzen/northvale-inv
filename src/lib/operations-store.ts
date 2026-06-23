import type { InventoryItem, InventoryUnit, ProductBomLine } from "@/types/domain";
import { convertQuantityForInventory } from "@/lib/units";

export type MasterBomLine = {
  id: string;
  lineType: ProductBomLine["lineType"];
  inventoryItemId?: string;
  quantityPerBatch: number;
  unit: string;
  costOverride?: number;
  notes?: string;
};

export type MasterBom = {
  id: string;
  name: string;
  family: string;
  yieldQty: number;
  yieldUnit: InventoryUnit;
  status: "active" | "archived";
  lines: MasterBomLine[];
};

export type ProductBomAssignment = {
  productId: string;
  bomId?: string;
  type: "linked" | "custom" | "none";
  customLines?: MasterBomLine[];
};

export type PackingTemplateLine = {
  id: string;
  inventoryItemId: string;
  qty: number;
  unit: InventoryUnit;
  usageRule: "per_order" | "per_item" | "per_set";
};

export type PackingTemplateRecord = {
  id: string;
  name: string;
  capacity: number;
  basis: "per_order" | "per_item" | "per_set";
  status: "active" | "archived";
  materials: PackingTemplateLine[];
};

export type QuickOrderRecord = {
  id: string;
  status: "draft" | "processed" | "packed" | "completed" | "cancelled" | "released";
  platform: string;
  referenceNo: string;
  targetShipDate?: string;
  preparedBy: string;
  processedBy?: string;
  completedBy?: string;
  notes?: string;
  otherExpense?: number;
  lines: { id?: string; productId: string; quantity: number; notes?: string }[];
  groups: { id: string; templateId: string; assignedLineIds: string[]; manualSets: string; notes?: string }[];
  materials: { name: string; inventoryItemId?: string; required: number; unit: InventoryUnit; cost?: number }[];
  logs?: { text: string; actor: string; createdAt: string }[];
  createdAt: string;
  processedAt?: string;
  packedAt?: string;
  completedAt?: string;
  inventoryDeducted?: boolean;
};

const BOM_KEY = "prodstock_master_boms";
const ASSIGN_KEY = "prodstock_product_bom_assignments";
const TEMPLATE_KEY = "prodstock_packing_templates";
const QUICK_ORDER_KEY = "prodstock_quick_orders";
const DEMO_DATA_ENABLED = process.env.NEXT_PUBLIC_ENABLE_DEMO_DATA === "true";

export const defaultMasterBoms: MasterBom[] = [
  {
    id: "bom-air-freshener-38l",
    name: "Air Freshener Base 3.8L",
    family: "Air Care",
    yieldQty: 3.8,
    yieldUnit: "liter",
    status: "active",
    lines: [
      { id: "mbom-sles", lineType: "raw_material", inventoryItemId: "item-sles", quantityPerBatch: 0.35, unit: "kg" },
      { id: "mbom-fragrance", lineType: "raw_material", inventoryItemId: "item-fragrance", quantityPerBatch: 0.08, unit: "liter" },
      { id: "mbom-bottle", lineType: "packaging", inventoryItemId: "item-gal-white-round-bottle", quantityPerBatch: 1, unit: "pcs" },
      { id: "mbom-labor", lineType: "manpower", quantityPerBatch: 1, unit: "pcs", costOverride: 45, notes: "Filling labor" }
    ]
  }
];

export const defaultPackingTemplates: PackingTemplateRecord[] = [
  template("pouch-small", "Pouch small", 1, [["item-pkg-black-pouch-medium", 1, "per_set"], ["item-pkg-bubble-wrap", 1, "per_set"]]),
  template("pouch-medium", "Pouch medium", 2, [["item-pkg-black-pouch-medium", 1, "per_set"], ["item-pkg-bubble-wrap", 2, "per_set"]]),
  template("box-single", "Box single", 1, [["item-pkg-single-box", 1, "per_set"], ["item-pkg-bubble-wrap", 1, "per_set"], ["item-pkg-fragile-tape", 1, "per_order"]]),
  template("box-4", "Box by 4", 4, [["item-pkg-box-by-4", 1, "per_set"], ["item-pkg-bubble-wrap", 4, "per_set"], ["item-pkg-fragile-tape", 1, "per_set"], ["item-pkg-clear-tape", 0.05, "per_set"]]),
  template("box-12", "Box by 12", 12, [["item-pkg-box-by-4", 3, "per_set"], ["item-pkg-bubble-wrap", 12, "per_set"], ["item-pkg-clear-tape", 0.08, "per_set"]]),
  template("mixed-box", "Mixed box", 6, [["item-pkg-box-by-4", 2, "per_set"], ["item-pkg-bubble-wrap", 6, "per_set"]]),
  template("bulk-gallon", "Bulk gallon", 4, [["item-pkg-box-by-4", 1, "per_set"], ["item-pkg-bubble-wrap", 4, "per_set"], ["item-pkg-clear-tape", 0.06, "per_set"]]),
  template("fragile-box", "Fragile box", 2, [["item-pkg-single-box", 2, "per_set"], ["item-pkg-bubble-wrap", 4, "per_set"], ["item-pkg-fragile-tape", 2, "per_set"]])
];

function template(id: string, name: string, capacity: number, rows: [string, number, PackingTemplateLine["usageRule"]][]): PackingTemplateRecord {
  return {
    id,
    name,
    capacity,
    basis: "per_set",
    status: "active",
    materials: rows.map(([inventoryItemId, qty, usageRule], index) => ({
      id: `${id}-line-${index}`,
      inventoryItemId,
      qty,
      unit: "pcs",
      usageRule
    }))
  };
}

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const stored = window.localStorage.getItem(key);
    return stored ? JSON.parse(stored) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function getMasterBoms() {
  return readJson(BOM_KEY, DEMO_DATA_ENABLED ? defaultMasterBoms : []);
}

export function saveMasterBoms(boms: MasterBom[]) {
  writeJson(BOM_KEY, boms);
}

export function getProductBomAssignments() {
  return readJson<ProductBomAssignment[]>(ASSIGN_KEY, []);
}

export function saveProductBomAssignments(assignments: ProductBomAssignment[]) {
  writeJson(ASSIGN_KEY, assignments);
}

export function getPackingTemplates() {
  return readJson(TEMPLATE_KEY, DEMO_DATA_ENABLED ? defaultPackingTemplates : []);
}

export function savePackingTemplates(templates: PackingTemplateRecord[]) {
  writeJson(TEMPLATE_KEY, templates);
}

export function getQuickOrders() {
  return readJson<QuickOrderRecord[]>(QUICK_ORDER_KEY, []);
}

export function saveQuickOrders(orders: QuickOrderRecord[]) {
  writeJson(QUICK_ORDER_KEY, orders);
}

export function makeOpId(prefix: string) {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

export function estimateBomCost(lines: MasterBomLine[], inventoryItems: InventoryItem[]) {
  let missingCost = false;
  const total = lines.reduce((sum, line) => {
    if (line.lineType === "manpower" || line.lineType === "other_cost") {
      if (typeof line.costOverride !== "number") missingCost = true;
      return sum + (line.costOverride ?? 0) * line.quantityPerBatch;
    }
    const item = inventoryItems.find(entry => entry.id === line.inventoryItemId);
    if (typeof item?.unitCost !== "number") missingCost = true;
    const quantity = item ? convertQuantityForInventory(line.quantityPerBatch, line.unit, item.unit) : line.quantityPerBatch;
    return sum + (item?.unitCost ?? 0) * quantity;
  }, 0);
  return { total, missingCost };
}

export function estimatePackingTemplateCost(templateRecord: PackingTemplateRecord, inventoryItems: InventoryItem[]) {
  let missingCost = false;
  const total = templateRecord.materials.reduce((sum, line) => {
    const item = inventoryItems.find(entry => entry.id === line.inventoryItemId && entry.category === "packaging");
    if (typeof item?.unitCost !== "number") missingCost = true;
    const quantity = item ? convertQuantityForInventory(line.qty, line.unit, item.unit) : line.qty;
    return sum + (item?.unitCost ?? 0) * quantity;
  }, 0);
  return { total, missingCost };
}

export function appendOrderLog(order: QuickOrderRecord, text: string, actor: string) {
  return {
    ...order,
    logs: [
      { text, actor, createdAt: new Date().toISOString() },
      ...(order.logs ?? [])
    ]
  };
}
