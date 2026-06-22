export type UserRole = "admin" | "staff";

export type InventoryCategory = "raw" | "packaging" | "finished" | "asset";

export type InventoryUnit = "ml" | "liter" | "g" | "kg" | "gallon" | "pcs";

export type StockStatus = "critical" | "low" | "good" | "active";

export type ProductionStatus = "draft" | "to_process" | "planned" | "ready" | "blocked" | "completed" | "cancelled";

export type StockTransactionType =
  | "stock_in"
  | "stock_out"
  | "adjustment"
  | "production_release"
  | "production_consume"
  | "production_output"
  | "quick_order_finished_good_out"
  | "quick_order_packing_material_out";

export interface Profile {
  id: string;
  fullName: string;
  role: UserRole;
}

export interface Location {
  id: string;
  name: string;
  code: string;
}

export interface InventoryItem {
  id: string;
  sku: string;
  name: string;
  category: InventoryCategory;
  unit: InventoryUnit;
  quantityOnHand: number;
  reorderPoint: number;
  locationId: string;
  unitCost?: number;
  status: StockStatus;
  isArchived?: boolean;
}

export interface Product {
  id: string;
  sku: string;
  name: string;
  outputUnit: InventoryUnit;
  batchSize: number;
  finishedGoodItemId: string;
  brand?: string;
  scent?: string;
  family?: string;
  category?: string;
  notes?: string;
  isArchived?: boolean;
}

export interface ProductBomLine {
  id: string;
  productId: string;
  inventoryItemId?: string;
  quantityPerBatch: number;
  unit?: string;
  lineType: "raw_material" | "packaging" | "manpower" | "other_cost";
  costOverride?: number;
  wastagePercent?: number;
  notes?: string;
}

export interface ProductionJob {
  id: string;
  jobNumber: string;
  productId: string;
  plannedBatchQty: number;
  status: ProductionStatus;
  scheduledFor?: string;
  dueDate?: string;
  purpose?: "stock" | "order" | "custom";
  referenceNote?: string;
  preparedBy?: string;
  notes?: string;
  completedAt?: string;
  createdAt?: string;
  startedAt?: string;
  isNew?: boolean;
  isArchived?: boolean;
  productLines?: { productId: string; plannedBatchQty: number }[];
  additionalMaterials?: { inventoryItemId: string; quantity: number; unit: string; reason?: string }[];
}

export interface ProductionJobLine {
  id: string;
  productionJobId: string;
  inventoryItemId: string;
  plannedQty: number;
  actualQty?: number;
  unit: InventoryUnit;
}

export interface StockTransaction {
  id: string;
  inventoryItemId: string;
  type: StockTransactionType;
  quantity: number;
  unit: InventoryUnit;
  reason?: string;
  productionJobId?: string;
  reference?: string;
  beforeQuantity?: number;
  afterQuantity?: number;
  createdAt: string;
}

export interface ActivityLog {
  id: string;
  actorName: string;
  action: string;
  entityType: string;
  entityId: string;
  createdAt: string;
}
