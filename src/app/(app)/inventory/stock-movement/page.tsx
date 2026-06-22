"use client";

import { useSearchParams, useRouter } from "next/navigation";
import { Suspense, useState, useMemo } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/forms/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useApp } from "@/context/app-context";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { stockMovementSchema, type StockMovementInput } from "@/lib/validation";
import { ArrowLeft, Save, TrendingUp, TrendingDown, TriangleAlert } from "lucide-react";
import { cn } from "@/lib/utils";

function StockMovementContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const paramType = searchParams.get("type"); // in, out, adjustment
  const paramItemId = searchParams.get("item") || searchParams.get("itemId") || searchParams.get("id");

  const { inventoryItems, updateInventoryItem, addStockTransaction, addActivityLog } = useApp();

  // Map paramType to schema type
  const defaultType = 
    paramType === "in" || paramType === "stock_in"
      ? "stock_in"
      : paramType === "out" || paramType === "stock_out"
      ? "stock_out"
      : "adjustment";

  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Find the selected item or default to first non-archived item
  const activeItems = useMemo(() => inventoryItems.filter(i => !i.isArchived), [inventoryItems]);
  const initialItem = useMemo(() => {
    if (paramItemId) {
      return inventoryItems.find((item) => item.id === paramItemId || item.id === `item-${paramItemId}`) || activeItems[0];
    }
    return activeItems[0];
  }, [paramItemId, inventoryItems, activeItems]);

  const form = useForm<StockMovementInput>({
    resolver: zodResolver(stockMovementSchema),
    defaultValues: {
      inventoryItemId: initialItem?.id ?? "",
      type: defaultType,
      quantity: 0,
      unit: initialItem?.unit ?? "kg",
      reason: ""
    }
  });

  const selectedItemId = useWatch({ control: form.control, name: "inventoryItemId" });
  const movementType = useWatch({ control: form.control, name: "type" });
  const inputQuantity = useWatch({ control: form.control, name: "quantity" }) || 0;

  const selectedItem = useMemo(() => 
    inventoryItems.find((item) => item.id === selectedItemId),
    [inventoryItems, selectedItemId]
  );

  // Sync unit when item changes
  useMemo(() => {
    if (selectedItem) {
      form.setValue("unit", selectedItem.unit);
    }
  }, [selectedItem, form]);

  const previewDetails = useMemo(() => {
    if (!selectedItem) return null;
    const current = selectedItem.quantityOnHand;
    const qty = Number(inputQuantity) || 0;
    
    let change = 0;
    if (movementType === "stock_in") {
      change = qty;
    } else if (movementType === "stock_out") {
      change = -qty;
    } else if (movementType === "adjustment") {
      change = -qty; // adjustment defaults to subtraction here, but user can state reason
    }

    const forecast = Math.max(0, current + change);
    return {
      current,
      change,
      forecast,
      unit: selectedItem.unit
    };
  }, [selectedItem, movementType, inputQuantity]);

  const onSubmit = (data: StockMovementInput) => {
    const item = inventoryItems.find(i => i.id === data.inventoryItemId);
    if (!item) return;

    const qty = Number(data.quantity);
    let change = 0;
    if (data.type === "stock_in") {
      change = qty;
    } else {
      change = -qty;
    }

    const newQty = Math.max(0, item.quantityOnHand + change);
    
    // 1. Update item quantity in AppContext
    updateInventoryItem(item.id, { quantityOnHand: newQty });

    // 2. Add Stock Transaction
    addStockTransaction({
      inventoryItemId: item.id,
      type: data.type,
      quantity: qty,
      unit: item.unit,
      reason: data.reason || `Manual ${data.type.replace("_", " ")}`
    });

    // 3. Add Activity Audit Log
    addActivityLog({
      actorName: "Mara Santos",
      action: `Recorded stock ${data.type.replace("_", " ")} of ${qty} ${item.unit} for ${item.name}`,
      entityType: "inventory_item",
      entityId: item.id
    });

    setSuccessMessage("Stock movement recorded successfully!");
    
    setTimeout(() => {
      router.push(`/inventory/${item.id}`);
    }, 1500);
  };

  return (
    <div className="relative pb-10">
      {successMessage && (
        <div className="fixed top-10 left-1/2 -translate-x-1/2 z-50 bg-success text-black font-semibold px-6 py-3 rounded-full shadow-glow animate-bounce">
          {successMessage}
        </div>
      )}

      {/* Top Header */}
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full">
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <h2 className="text-headline-md font-bold text-primary">Stock movement</h2>
      </div>

      {/* Live Preview Card */}
      {previewDetails && (
        <section className="glass-panel p-6 rounded-xl border border-outline-variant/30 bg-surface-container relative overflow-hidden mb-6">
          <div className="absolute top-0 right-0 p-6 opacity-10">
            <TrendingUp className="h-16 w-16 text-primary" />
          </div>
          <h3 className="text-label-md text-on-surface-variant uppercase tracking-wider mb-4 font-semibold">Live Preview</h3>
          <div className="grid grid-cols-3 gap-4 items-center text-center">
            <div className="flex flex-col gap-1">
              <span className="text-body-sm text-on-surface-variant">Current</span>
              <span className="text-headline-md font-bold text-white">
                {previewDetails.current.toFixed(2)} <span className="text-body-sm font-normal text-on-surface-variant">{previewDetails.unit}</span>
              </span>
            </div>
            
            <div className="flex flex-col items-center">
              <div className={cn(
                "w-8 h-8 rounded-full flex items-center justify-center mb-1 text-white",
                movementType === "stock_in" ? "bg-success/80" : "bg-error/80"
              )}>
                {movementType === "stock_in" ? (
                  <TrendingUp className="h-4 w-4" />
                ) : (
                  <TrendingDown className="h-4 w-4" />
                )}
              </div>
              <span className={cn("font-bold text-label-md", movementType === "stock_in" ? "text-success" : "text-error")}>
                {movementType === "stock_in" ? "+" : "-"}
                {Math.abs(previewDetails.change).toFixed(2)} {previewDetails.unit}
              </span>
            </div>

            <div className="flex flex-col gap-1 border-l border-outline-variant/30">
              <span className="text-body-sm text-on-surface-variant">Forecast</span>
              <span className="text-headline-md font-bold text-primary">
                {previewDetails.forecast.toFixed(2)} <span className="text-body-sm font-normal text-on-surface-variant">{previewDetails.unit}</span>
              </span>
            </div>
          </div>
          <div className="h-2 w-full bg-surface-container-highest rounded-full overflow-hidden mt-4">
            <div 
              className={cn(
                "h-full rounded-full transition-all duration-300",
                movementType === "stock_in" ? "bg-gradient-to-r from-secondary-container to-primary" : "bg-gradient-to-r from-error/65 to-error"
              )}
              style={{
                width: `${Math.min(
                  (previewDetails.forecast / (((selectedItem?.reorderPoint ?? 0) * 2) || 1)) * 100,
                  100
                )}%`
              }}
            />
          </div>
        </section>
      )}

      {/* Main Form */}
      <Card className="p-6">
        <form className="space-y-6" onSubmit={form.handleSubmit(onSubmit)}>
          {/* Movement Type Toggle */}
          <div className="space-y-2">
            <label className="text-label-md text-on-surface-variant font-medium ml-1">Movement Type</label>
            <div className="flex p-1 bg-surface-container-low rounded-xl border border-outline-variant/30">
              {(["stock_in", "stock_out", "adjustment"] as const).map((t) => {
                const isActive = movementType === t;
                const label = t === "stock_in" ? "Stock In" : t === "stock_out" ? "Stock Out" : "Adjustment";
                return (
                  <button
                    key={t}
                    type="button"
                    onClick={() => form.setValue("type", t)}
                    className={cn(
                      "flex-1 py-3 px-2 rounded-lg font-label-md text-label-sm transition-all text-center",
                      isActive
                        ? "bg-secondary-container text-on-secondary-container shadow-md font-semibold"
                        : "text-on-surface-variant hover:bg-surface-container-high/50"
                    )}
                  >
                    {label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Item Selector */}
          <Field id="inventoryItemId" label="Item Selector" error={form.formState.errors.inventoryItemId?.message}>
            <select
              id="inventoryItemId"
              className="focus-ring h-12 w-full rounded-md border border-outline-variant bg-surface-container-low px-4 text-on-surface"
              {...form.register("inventoryItemId")}
            >
              {activeItems.map((item) => (
                <option key={item.id} value={item.id}>
                  {item.name} ({item.sku})
                </option>
              ))}
            </select>
          </Field>

          {/* Quantity Input */}
          <Field id="quantity" label="Quantity" error={form.formState.errors.quantity?.message}>
            <div className="relative">
              <Input
                id="quantity"
                type="number"
                step="0.01"
                placeholder="0.00"
                className="pr-16"
                {...form.register("quantity")}
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2 px-2.5 py-0.5 bg-surface-container-highest rounded text-label-sm text-on-surface-variant uppercase font-bold">
                {selectedItem?.unit ?? "KG"}
              </div>
            </div>
          </Field>

          {/* Adjustment Warning */}
          {movementType === "adjustment" && (
            <div className="flex items-start gap-3 p-4 bg-error-container/20 border border-error/30 rounded-xl">
              <TriangleAlert className="h-5 w-5 text-error mt-0.5" />
              <p className="text-body-sm text-error font-medium">
                Inventory adjustments require a detailed reason for audit trail compliance.
              </p>
            </div>
          )}

          {/* Reason/Notes */}
          <Field id="reason" label="Reason / Notes" error={form.formState.errors.reason?.message}>
            <Textarea
              id="reason"
              placeholder={
                movementType === "adjustment"
                  ? "Enter adjustment reason (e.g. spillage, damaged goods)..."
                  : "Enter supplier reference, batch number or notes..."
              }
              rows={3}
              {...form.register("reason")}
            />
          </Field>

          {/* Action Area */}
          <div className="pt-2 flex flex-col gap-3">
            <Button className="w-full py-6 text-label-md font-bold" type="submit">
              <Save className="h-5 w-5" />
              Save movement
            </Button>
            <Button
              type="button"
              variant="ghost"
              className="w-full py-4 text-label-sm border border-secondary/30"
              onClick={() => router.push("/inventory")}
            >
              Discard changes
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

export default function StockMovementPage() {
  return (
    <AppShell>
      <Suspense fallback={<div className="text-on-surface-variant text-body-md">Loading stock movement...</div>}>
        <StockMovementContent />
      </Suspense>
    </AppShell>
  );
}
