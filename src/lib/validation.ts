import { z } from "zod";

export const inventoryCategorySchema = z.enum(["raw", "packaging", "finished", "asset"]);
export const inventoryUnitSchema = z.enum(["ml", "liter", "g", "kg", "gallon", "pcs"]);

export const inventoryItemSchema = z.object({
  sku: z.string().min(2, "SKU is required"),
  name: z.string().min(2, "Name is required"),
  category: inventoryCategorySchema,
  unit: inventoryUnitSchema,
  quantityOnHand: z.coerce.number().min(0, "Quantity cannot be negative"),
  reorderPoint: z.coerce.number().min(0, "Reorder point cannot be negative"),
  locationId: z.string().min(1, "Location is required"),
  unitCost: z.coerce.number().min(0).optional().or(z.literal(""))
});

export const stockMovementSchema = z.object({
  inventoryItemId: z.string().min(1, "Item is required"),
  type: z.enum(["stock_in", "stock_out", "adjustment"]),
  quantity: z.coerce.number().positive("Quantity must be greater than zero"),
  unit: inventoryUnitSchema,
  reason: z.string().optional()
}).superRefine((value, ctx) => {
  if (value.type === "adjustment" && !value.reason?.trim()) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["reason"],
      message: "Manual adjustment requires a reason"
    });
  }
});

export const productionPlanSchema = z.object({
  productId: z.string().min(1, "Product is required"),
  plannedBatchQty: z.coerce.number().int().positive("At least one batch is required"),
  scheduledFor: z.string().optional(),
  notes: z.string().max(500).optional()
});

export type InventoryItemInput = z.infer<typeof inventoryItemSchema>;
export type StockMovementInput = z.infer<typeof stockMovementSchema>;
export type ProductionPlanInput = z.infer<typeof productionPlanSchema>;
