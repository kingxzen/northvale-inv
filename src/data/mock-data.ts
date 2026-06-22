import type {
  ActivityLog,
  InventoryItem,
  InventoryUnit,
  Location,
  Product,
  ProductBomLine,
  ProductionJob,
  StockTransaction
} from "@/types/domain";

export const locations: Location[] = [
  { id: "loc-a1", name: "Warehouse A", code: "A1" },
  { id: "loc-a2", name: "Packaging Bay", code: "A2" },
  { id: "loc-a3", name: "Finished Goods", code: "A3" },
  { id: "loc-a4", name: "Production Floor", code: "A4" }
];

const packagingNames = [
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

const rawMaterialNames = [
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

const literRawNames = new Set([
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

const slug = (value: string) => value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const rawUnit = (name: string): InventoryUnit => (
  name.startsWith("Fragrance ") || name.startsWith("Colorant ") || literRawNames.has(name) ? "liter" : "kg"
);

const packagingItems: InventoryItem[] = packagingNames.map((name) => ({
  id: name === "3.8L Gal White Round Bottle" ? "item-gal-white-round-bottle" : `item-pkg-${slug(name)}`,
  sku: name === "3.8L Gal White Round Bottle" ? "PKG-GAL-WHT-3-8L" : `PKG-${slug(name).slice(0, 18).toUpperCase()}`,
  name,
  category: "packaging",
  unit: "pcs",
  quantityOnHand: name === "3.8L Gal White Round Bottle" ? 50 : 0,
  reorderPoint: 10,
  locationId: "loc-a2",
  status: name === "3.8L Gal White Round Bottle" ? "good" : "critical"
}));

const rawMaterialItems: InventoryItem[] = rawMaterialNames.map((name) => ({
  id: name === "Surfactant SLES" ? "item-sles" : name === "Fragrance Lavender" ? "item-fragrance" : `item-raw-${slug(name)}`,
  sku: name === "Surfactant SLES" ? "RM-SLES" : name === "Fragrance Lavender" ? "RM-LAV-OIL" : `RM-${slug(name).slice(0, 18).toUpperCase()}`,
  name,
  category: "raw",
  unit: rawUnit(name),
  quantityOnHand: name === "Surfactant SLES" ? 12 : 0,
  reorderPoint: name === "Surfactant SLES" ? 25 : 10,
  locationId: "loc-a1",
  unitCost: name === "Surfactant SLES" ? 393.33 : undefined,
  status: "critical"
}));

export const inventoryItems: InventoryItem[] = [
  {
    id: "item-bottle-500",
    sku: "PKG-BOT-500",
    name: "500ml Bottle",
    category: "packaging",
    unit: "pcs",
    quantityOnHand: 0,
    reorderPoint: 10,
    locationId: "loc-a2",
    status: "critical"
  },
  {
    id: "item-lavender",
    sku: "FG-LAV-GAL",
    name: "Keeva Airzen Lavender",
    category: "finished",
    unit: "gallon",
    quantityOnHand: 42,
    reorderPoint: 18,
    locationId: "loc-a3",
    status: "good"
  },
  {
    id: "item-carton",
    sku: "PKG-CTN-12",
    name: "12-pack Carton",
    category: "packaging",
    unit: "pcs",
    quantityOnHand: 0,
    reorderPoint: 10,
    locationId: "loc-a2",
    status: "critical"
  },
  {
    id: "item-filler",
    sku: "AST-FILL-01",
    name: "Filling Machine",
    category: "asset",
    unit: "pcs",
    quantityOnHand: 1,
    reorderPoint: 1,
    locationId: "loc-a4",
    status: "active"
  },
  ...rawMaterialItems,
  ...packagingItems
];

export const products: Product[] = [
  {
    id: "prod-lavender-gal",
    sku: "FG-LAV-GAL",
    name: "Keeva Airzen Lavender",
    outputUnit: "gallon",
    batchSize: 100,
    finishedGoodItemId: "item-lavender"
  },
  {
    id: "prod-ocean-250",
    sku: "FG-OCN-250",
    name: "Keeva Airzen Ocean",
    outputUnit: "pcs",
    batchSize: 250,
    finishedGoodItemId: "item-bottle-500"
  }
];

export const productBomLines: ProductBomLine[] = [
  {
    id: "bom-sles",
    productId: "prod-lavender-gal",
    inventoryItemId: "item-sles",
    quantityPerBatch: 25,
    unit: "kg",
    lineType: "raw_material"
  },
  {
    id: "bom-fragrance",
    productId: "prod-lavender-gal",
    inventoryItemId: "item-fragrance",
    quantityPerBatch: 2,
    unit: "liter",
    lineType: "raw_material"
  },
  {
    id: "bom-carton",
    productId: "prod-lavender-gal",
    inventoryItemId: "item-carton",
    quantityPerBatch: 20,
    unit: "pcs",
    lineType: "packaging"
  }
];

export const productionJobs: ProductionJob[] = [
  {
    id: "job-901",
    jobNumber: "PRD-2023-901",
    productId: "prod-lavender-gal",
    plannedBatchQty: 1,
    status: "blocked",
    scheduledFor: "2026-06-24T08:00:00+08:00",
    notes: "Cannot produce due to raw material shortage in Warehouse B."
  },
  {
    id: "job-904",
    jobNumber: "PRD-2023-904",
    productId: "prod-ocean-250",
    plannedBatchQty: 1,
    status: "ready",
    scheduledFor: "2026-06-25T09:30:00+08:00"
  },
  {
    id: "job-889",
    jobNumber: "PRD-2023-889",
    productId: "prod-lavender-gal",
    plannedBatchQty: 2,
    status: "draft",
    notes: "Awaiting formulation approval."
  }
];

export const stockTransactions: StockTransaction[] = [
  {
    id: "txn-1",
    inventoryItemId: "item-bottle-500",
    type: "stock_in",
    quantity: 200,
    unit: "pcs",
    reason: "Restocked from receiving",
    createdAt: "2026-06-21T09:12:00+08:00"
  },
  {
    id: "txn-2",
    inventoryItemId: "item-sles",
    type: "production_consume",
    quantity: 12,
    unit: "kg",
    productionJobId: "job-904",
    createdAt: "2026-06-20T15:40:00+08:00"
  },
  {
    id: "txn-3",
    inventoryItemId: "item-carton",
    type: "stock_out",
    quantity: 12,
    unit: "pcs",
    reason: "Line issue replacement",
    createdAt: "2026-06-20T13:22:00+08:00"
  }
];

export const activityLogs: ActivityLog[] = [
  {
    id: "act-1",
    actorName: "Mara Santos",
    action: "Created production plan",
    entityType: "production_job",
    entityId: "job-901",
    createdAt: "2026-06-21T08:30:00+08:00"
  },
  {
    id: "act-2",
    actorName: "Admin",
    action: "Adjusted stock with reason",
    entityType: "inventory_item",
    entityId: "item-bottle-500",
    createdAt: "2026-06-20T17:30:00+08:00"
  },
  {
    id: "act-seed-import",
    actorName: "Admin",
    action: "Inventory seed/import added",
    entityType: "inventory_item",
    entityId: "inventory-seed-import",
    createdAt: "2026-06-22T10:00:00+08:00"
  }
];

export const reportSeries = [
  { day: "Mon", cost: 2400 },
  { day: "Tue", cost: 3100 },
  { day: "Wed", cost: 1800 },
  { day: "Thu", cost: 4200 },
  { day: "Fri", cost: 3550 },
  { day: "Sat", cost: 2100 },
  { day: "Sun", cost: 1300 }
];
