import type {
  InventoryItem,
  InventoryUnit,
  Product,
  ProductBomLine,
  ProductionJob,
  StockTransaction
} from "@/types/domain";
import { convertUnit } from "@/lib/units";

interface CompletionInput {
  job: ProductionJob;
  product: Product;
  bomLines: ProductBomLine[];
  inventoryItems: InventoryItem[];
}

export interface CompletionPreview {
  canComplete: boolean;
  shortages: Array<{ itemName: string; required: number; available: number; unit: string }>;
  missingCostWarnings: string[];
  estimatedCost: number;
  transactions: StockTransaction[];
}

export function previewProductionCompletion(input: CompletionInput): CompletionPreview {
  if (input.job.status === "draft" || input.job.status === "planned") {
    return {
      canComplete: false,
      shortages: [],
      missingCostWarnings: [],
      estimatedCost: 0,
      transactions: []
    };
  }

  const shortages: CompletionPreview["shortages"] = [];
  const missingCostWarnings: string[] = [];
  const transactions: StockTransaction[] = [];
  let estimatedCost = 0;

  for (const line of input.bomLines) {
    const item = input.inventoryItems.find((candidate) => candidate.id === line.inventoryItemId);
    if (!item) {
      continue;
    }

    const requiredInLineUnit = line.quantityPerBatch * input.job.plannedBatchQty;
    const requiredInItemUnit = convertUnit(requiredInLineUnit, (line.unit || item.unit) as InventoryUnit, item.unit);

    if (item.quantityOnHand < requiredInItemUnit) {
      shortages.push({
        itemName: item.name,
        required: requiredInItemUnit,
        available: item.quantityOnHand,
        unit: item.unit
      });
    }

    if (typeof item.unitCost !== "number") {
      missingCostWarnings.push(`${item.name} has no unit cost`);
    } else {
      estimatedCost += requiredInItemUnit * item.unitCost;
    }

    transactions.push({
      id: `txn-consume-${line.id}`,
      inventoryItemId: item.id,
      type: "production_consume",
      quantity: requiredInItemUnit,
      unit: item.unit,
      productionJobId: input.job.id,
      createdAt: new Date().toISOString()
    });
  }

  transactions.push({
    id: `txn-output-${input.job.id}`,
    inventoryItemId: input.product.finishedGoodItemId,
    type: "production_output",
    quantity: input.product.batchSize * input.job.plannedBatchQty,
    unit: input.product.outputUnit,
    productionJobId: input.job.id,
    createdAt: new Date().toISOString()
  });

  return {
    canComplete: shortages.length === 0,
    shortages,
    missingCostWarnings,
    estimatedCost,
    transactions
  };
}
