"use client";

import { useMemo, useState, useRef, useEffect } from "react";
import { useRouter as useNextRouter } from "next/navigation";
import { CalendarPlus, Trash2, Plus, AlertTriangle, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useApp } from "@/context/app-context";
import { formatMoney, cn } from "@/lib/utils";
import { convertQuantityForInventory } from "@/lib/units";
import type { Product, ProductBomLine, InventoryItem, ProductionStatus } from "@/types/domain";

function ProductLineRow({
  line,
  idx,
  activeProducts,
  bomLabel,
  lineCostDetails,
  onUpdate,
  onRemove,
  canRemove
}: any) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const wrapperRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const matchedProd = activeProducts.find((p: any) => p.id === line.productId);
  const displayValue = matchedProd ? `${matchedProd.name} (${matchedProd.sku})` : "Select a product...";
  const filtered = activeProducts.filter((p: any) =>
    p.name.toLowerCase().includes(search.toLowerCase()) ||
    p.sku.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-outline-variant/15 bg-surface-container-low p-2.5">
      <div className="relative" ref={wrapperRef}>
        <label className="sr-only">Product Search</label>
        <div 
          className="flex h-9 w-full cursor-pointer items-center rounded-md border border-outline bg-surface-container px-2.5 text-[15px] font-semibold text-white"
          onClick={() => setOpen(true)}
        >
          <Search className="mr-2 h-4 w-4 shrink-0 text-outline" />
          <span className="flex-1 truncate">{displayValue}</span>
        </div>
        
        {open && (
          <div className="absolute left-0 right-0 top-10 z-50 max-h-60 overflow-y-auto rounded-md border border-outline-variant bg-surface p-2 shadow-glow">
            <input 
              autoFocus
              placeholder="Type to search..." 
              value={search}
              onChange={e => setSearch(e.target.value)}
              className="flex h-10 w-full rounded-md border border-outline bg-surface-container px-3 text-body-sm text-white mb-2 focus:outline-none focus:ring-1 focus:ring-secondary"
            />
            {filtered.length === 0 ? (
              <p className="text-body-sm text-on-surface-variant p-2">No products found.</p>
            ) : (
              <div className="flex flex-col gap-1">
                {filtered.map((p: any) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => {
                      onUpdate(idx, "productId", p.id);
                      setSearch("");
                      setOpen(false);
                    }}
                    className="text-left px-3 py-2 hover:bg-surface-container-high rounded-md text-body-sm text-white flex justify-between items-center"
                  >
                    <span className="font-semibold">{p.name}</span>
                    <span className="text-on-surface-variant text-[10px]">{p.sku}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex w-full flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <label className="text-[12px] text-on-surface-variant">Batches</label>
          <input
            type="number"
            min={1}
            value={line.plannedBatchQty}
            onChange={e => onUpdate(idx, "plannedBatchQty", e.target.value)}
            className="flex h-8 w-14 rounded-md border border-outline bg-surface-container px-2 text-right text-[13px] text-white focus:outline-none"
          />
        </div>
        <div className="flex min-w-0 flex-1 items-center justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-[12px] text-on-surface-variant">Unit:</span>
              <span className="text-[12.5px] font-semibold">{matchedProd ? matchedProd.outputUnit : "-"}</span>
            </div>
            <div className="hidden">
              <span className="text-[12px] text-on-surface-variant">Cost:</span>
              <span className="text-[12.5px] font-semibold text-secondary">
                {lineCostDetails.hasMissingCost ? (
                  <span className="text-warning text-[11px]">⚠️ Missing</span>
                ) : (
                  formatMoney(lineCostDetails.cost)
                )}
              </span>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className={cn(
              "inline-block text-[10px] font-bold uppercase px-2 py-0.5 rounded border tracking-wider",
              bomLabel === "BOM complete"
                ? "bg-success/15 border-success/20 text-success"
                : bomLabel === "Partial BOM"
                ? "bg-warning/15 border-warning/20 text-warning"
                : "bg-error/15 border-error/20 text-error"
            )}>
              {bomLabel}
            </span>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              disabled={!canRemove}
              onClick={() => onRemove(idx)}
              className={cn("h-8 w-8 rounded-full text-error hover:bg-error/5", !canRemove && "hidden")}
            >
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

export interface ProductionPlanFormProps {
  products: Product[];
  bomLines: ProductBomLine[];
  inventoryItems: InventoryItem[];
}

export function ProductionPlanForm({ products, bomLines, inventoryItems }: ProductionPlanFormProps) {
  const router = useNextRouter();
  const { addProductionJob } = useApp();
  
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [preparedDate, setPreparedDate] = useState(() => toDateTimeLocal(new Date().toISOString()));
  const [dueDate, setDueDate] = useState("");
  const [purpose, setPurpose] = useState<"stock" | "order" | "custom">("stock");
  const [orderReferenceNo, setOrderReferenceNo] = useState("");
  const [preparedBy, setPreparedBy] = useState("");
  const [notes, setNotes] = useState("");

  // Product lines state: multiple products in one plan
  const [productLines, setProductLines] = useState<{ productId: string; plannedBatchQty: number }[]>([
    { productId: products[0]?.id ?? "", plannedBatchQty: 1 }
  ]);

  // Filter out archived items and products
  const activeProducts = useMemo(() => products.filter(p => !p.isArchived), [products]);
  const activeItems = useMemo(() => inventoryItems.filter(i => !i.isArchived), [inventoryItems]);

  useEffect(() => {
    if (!activeProducts.length) return;
    setProductLines(prev => prev.map(line => (
      line.productId ? line : { ...line, productId: activeProducts[0].id }
    )));
  }, [activeProducts]);

  // BOM status helper
  const getProductBomStatus = (productId: string) => {
    const lines = bomLines.filter(l => l.productId === productId);
    if (lines.length === 0) return "No BOM yet";
    const hasRaw = lines.some(l => l.lineType === "raw_material");
    const hasPkg = lines.some(l => l.lineType === "packaging");
    if (hasRaw && hasPkg) return "BOM complete";
    return "Partial BOM";
  };

  // Add Product Line
  const handleAddProductLine = () => {
    setProductLines(prev => [...prev, { productId: activeProducts[0]?.id ?? "", plannedBatchQty: 1 }]);
  };

  // Remove Product Line
  const handleRemoveProductLine = (index: number) => {
    setProductLines(prev => prev.filter((_, i) => i !== index));
  };

  // Update Product Line fields
  const handleUpdateProductLine = (index: number, field: "productId" | "plannedBatchQty", value: any) => {
    const updated = [...productLines];
    if (field === "productId") {
      updated[index].productId = value;
    } else {
      updated[index].plannedBatchQty = Math.max(1, Number(value) || 1);
    }
    setProductLines(updated);
  };

  // Handlers for additional materials removed for compactness

  // Calculate Aggregated BOM & Material Requirements
  const aggregatedRequirements = useMemo(() => {
    const map: Record<string, { required: number; unit: string; lineType: string; costOverrides: number[] }> = {};

    // 1. Accumulate BOM lines from all product lines
    productLines.forEach(line => {
      const prodBoms = bomLines.filter(b => b.productId === line.productId);
      prodBoms.forEach(bom => {
        if (!bom.inventoryItemId) return;
        const item = activeItems.find(i => i.id === bom.inventoryItemId);
        const requiredQty = bom.quantityPerBatch * line.plannedBatchQty;
        const wastageMult = bom.wastagePercent ? (1 + bom.wastagePercent / 100) : 1;
        const finalQty = item ? convertQuantityForInventory(requiredQty * wastageMult, bom.unit, item.unit) : requiredQty * wastageMult;

        if (!map[bom.inventoryItemId]) {
          map[bom.inventoryItemId] = {
            required: 0,
            unit: item?.unit ?? bom.unit ?? "kg",
            lineType: bom.lineType,
            costOverrides: []
          };
        }
        map[bom.inventoryItemId].required += finalQty;
        if (bom.costOverride !== undefined) {
          map[bom.inventoryItemId].costOverrides.push(bom.costOverride);
        }
      });
    });

    // 3. Compile rows with stock levels
    return Object.entries(map).map(([itemId, data]) => {
      const item = activeItems.find(i => i.id === itemId);
      const available = item ? item.quantityOnHand : 0;
      const shortage = Math.max(0, data.required - available);
      
      // Determine cost to use (average override, or default item unit cost)
      let unitCost = item?.unitCost ?? 0;
      if (data.costOverrides.length > 0) {
        // Use average of overrides
        unitCost = data.costOverrides.reduce((s, c) => s + c, 0) / data.costOverrides.length;
      }

      return {
        itemId,
        name: item?.name ?? "Unknown Material",
        sku: item?.sku ?? "N/A",
        required: data.required,
        available,
        shortage,
        unit: data.unit,
        lineType: data.lineType,
        unitCost,
        hasCost: item?.unitCost !== undefined || data.costOverrides.length > 0
      };
    });
  }, [productLines, bomLines, activeItems]);

  // Calculate Cost Estimates per Product Line
  const productLineCosts = useMemo(() => {
    return productLines.map(line => {
      const prodBoms = bomLines.filter(b => b.productId === line.productId);
      let missingCostCount = 0;
      
      const cost = prodBoms.reduce((sum, bom) => {
        let uCost = 0;
        if (bom.costOverride !== undefined) {
          uCost = bom.costOverride;
        } else if (bom.inventoryItemId) {
          const item = activeItems.find(i => i.id === bom.inventoryItemId);
          if (item?.unitCost !== undefined) {
            uCost = item.unitCost;
          } else {
            missingCostCount++;
          }
        }
        const wastageMult = bom.wastagePercent ? (1 + bom.wastagePercent / 100) : 1;
        return sum + (uCost * bom.quantityPerBatch * line.plannedBatchQty * wastageMult);
      }, 0);

      return {
        cost,
        hasMissingCost: missingCostCount > 0
      };
    });
  }, [productLines, bomLines, activeItems]);

  // Total Plan Cost Estimate
  const totalCostEstimate = useMemo(() => {
    return productLineCosts.reduce((s, item) => s + item.cost, 0);
  }, [productLineCosts]);

  // Check if any product has "No BOM yet"
  const hasNoBOMWarning = useMemo(() => {
    return productLines.some(line => getProductBomStatus(line.productId) === "No BOM yet");
  }, [productLines]);

  // Check if any material is missing costs
  const hasMissingCostsWarning = useMemo(() => {
    return productLineCosts.some(c => c.hasMissingCost);
  }, [productLineCosts]);

  const hasShortages = useMemo(() => {
    return aggregatedRequirements.some(req => req.shortage > 0);
  }, [aggregatedRequirements]);

  const materialSummary = useMemo(() => {
    const short = aggregatedRequirements.filter(req => req.shortage > 0).length;
    return {
      total: aggregatedRequirements.length,
      ok: aggregatedRequirements.length - short,
      short
    };
  }, [aggregatedRequirements]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSubmitting) return;
    if (productLines.length === 0) return;
    setIsSubmitting(true);
    
    // Save the plan as a single ProductionJob in the AppContext
    addProductionJob({
      productId: productLines[0].productId, // Compatibility fallback
      plannedBatchQty: productLines[0].plannedBatchQty, // Compatibility fallback
      productLines,
      additionalMaterials: [],
      status: "draft" as ProductionStatus,
      scheduledFor: parseOperationalDate(dueDate),
      createdAt: parseOperationalDate(preparedDate),
      dueDate: parseOperationalDate(dueDate),
      purpose,
      referenceNote: orderReferenceNo.trim() || undefined,
      preparedBy: preparedBy.trim() || undefined,
      notes: notes || "Saved as draft. Inventory has not been deducted."
    });

    setSuccessMessage("Production plan saved as draft.");
    setTimeout(() => {
      router.push("/production");
    }, 1500);
  };

  return (
    <div className="relative">
      {/* Toast Alert */}
      {successMessage && (
        <div className="fixed top-10 left-1/2 -translate-x-1/2 z-[100] bg-success text-black font-semibold px-6 py-3 rounded-full shadow-glow animate-bounce">
          {successMessage}
        </div>
      )}

      <form className="space-y-6" onSubmit={handleSubmit}>
        {/* Products List Section */}
        <div className="space-y-4">
          <div className="flex justify-between items-center pb-2 border-b border-outline-variant/20">
            <h3 className="text-body-md font-bold text-white uppercase tracking-wider">Products to Produce</h3>
            <Button type="button" size="sm" variant="secondary" onClick={handleAddProductLine}>
              <Plus className="h-4 w-4 mr-1" /> Add Product
            </Button>
          </div>

          <div className="space-y-3">
            {productLines.map((line, idx) => {
              const bomLabel = getProductBomStatus(line.productId);
              const lineCostDetails = productLineCosts[idx];

              return (
                <ProductLineRow
                  key={idx}
                  line={line}
                  idx={idx}
                  activeProducts={activeProducts}
                  bomLabel={bomLabel}
                  lineCostDetails={lineCostDetails}
                  onUpdate={handleUpdateProductLine}
                  onRemove={handleRemoveProductLine}
                  canRemove={productLines.length > 1}
                />
              );
            })}
          </div>
        </div>

        {/* Warnings Alert Blocks */}
        {hasNoBOMWarning && (
          <div className="p-4 bg-error-container/20 border border-error/30 rounded-xl flex items-start gap-2 text-error">
            <AlertTriangle className="h-5 w-5 mt-0.5 shrink-0" />
            <p className="text-body-xs font-semibold">
              Warning: Some selected product lines have no BOM defined yet. You can still save as a Draft production run.
            </p>
          </div>
        )}

        {hasMissingCostsWarning && (
          <div className="p-4 bg-warning-container/20 border border-warning/30 rounded-xl flex items-start gap-2 text-warning">
            <AlertTriangle className="h-5 w-5 mt-0.5 shrink-0" />
            <p className="text-body-xs font-semibold">
              Note: Some component unit costs are missing. Estimated cost summary will skip them. Saving is still allowed.
            </p>
          </div>
        )}

        {/* Aggregated Material Requirements Block */}
        <div className="space-y-2 rounded-lg border border-outline-variant/30 bg-surface-container p-3">
          <div className="border-b border-outline-variant/15 pb-2">
            <h3 className="text-[15px] font-semibold text-white">Material requirements</h3>
            <p className="mt-0.5 text-[12px] text-on-surface-variant">
              {materialSummary.total} materials {"\u2022"} {materialSummary.ok} OK {"\u2022"} {materialSummary.short} short
            </p>
          </div>
          
          {aggregatedRequirements.length === 0 ? (
            <p className="text-body-sm text-on-surface-variant italic py-2">
              No products or materials configured. Add product lines above.
            </p>
          ) : (
            <div className="space-y-1.5 pt-1">
              {aggregatedRequirements.map((req) => (
                <div 
                  key={req.itemId} 
                  className={cn(
                    "flex min-h-[58px] items-center justify-between gap-3 rounded-md border bg-surface-container-low px-2.5 py-2",
                    req.shortage > 0 ? "border-error/25" : "border-outline-variant/10"
                  )}
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[14.5px] font-semibold leading-5 text-white">{req.name}</p>
                    <p className="mt-0.5 truncate text-[12.5px] leading-4 text-on-surface-variant">
                      Need {req.required.toFixed(1)} {req.unit} {"\u2022"} Have {req.available.toFixed(1)} {req.unit}
                    </p>
                  </div>
                  {req.shortage > 0 ? (
                    <span className="shrink-0 rounded-full border border-error/25 bg-error/10 px-2 py-0.5 text-[12px] font-semibold text-error">
                      Short {req.shortage.toFixed(1)} {req.unit}
                    </span>
                  ) : (
                    <span className="shrink-0 rounded-full border border-success/20 bg-success/10 px-2 py-0.5 text-[12px] font-semibold text-success">
                      OK
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Additional Manual Materials block removed */}

        {/* General Planning settings */}
        <div className="space-y-3 rounded-lg border border-outline-variant/30 bg-surface-container p-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-[11px] font-bold uppercase text-outline">Prepared date / Draft date</label>
              <Input
                type="datetime-local"
                value={preparedDate}
                onChange={e => setPreparedDate(e.target.value)}
                onInput={e => {
                  const value = e.currentTarget.value;
                  setPreparedDate(value);
                }}
                className="h-10 text-[13px]"
              />
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-bold uppercase text-outline">Target date optional</label>
              <Input
                type="datetime-local"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                onInput={e => {
                  const value = e.currentTarget.value;
                  setDueDate(value);
                }}
                className="h-10 text-[13px]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <label className="text-[11px] font-bold uppercase text-outline">Purpose</label>
              <select
                value={purpose}
                onChange={e => setPurpose(e.target.value as "stock" | "order" | "custom")}
                className="flex h-10 w-full rounded-md border border-outline bg-surface-container px-3 text-[13px] text-white focus:outline-none"
              >
                <option value="stock">For stock</option>
                <option value="order">For order</option>
                <option value="custom">Custom</option>
              </select>
            </div>
            <div className="space-y-1">
              <label className="text-[11px] font-bold uppercase text-outline">Reference no. optional</label>
              <Input
                type="text"
                placeholder="e.g. Custom order #001"
                value={orderReferenceNo}
                onChange={e => setOrderReferenceNo(e.target.value)}
                className="h-10 text-[13px]"
              />
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold uppercase text-outline">Prepared by / Processed by</label>
            <Input
              type="text"
              placeholder="e.g. Admin"
              value={preparedBy}
              onChange={e => setPreparedBy(e.target.value)}
              className="h-10 text-[13px]"
            />
          </div>

          <div className="space-y-1">
            <label className="text-[11px] font-bold uppercase text-outline">Production notes</label>
            <Input
              type="text"
              placeholder="e.g. Floor Line 2 formulation check"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              className="h-10 text-[13px]"
            />
          </div>
        </div>

        {/* Summary Card and Submit buttons */}
        <Card className="sticky bottom-20 z-30 mt-5 flex flex-col gap-3 border border-outline-variant/35 bg-surface-container/95 p-3 shadow-glow backdrop-blur-md">
          <div>
            <p className="text-label-sm text-on-surface-variant uppercase font-bold">Estimated cost</p>
            <h3 className="mt-0.5 text-headline-sm font-bold text-white">
              {formatMoney(totalCostEstimate)}
            </h3>
            <span className="text-body-xs text-on-surface-variant">Draft only. No inventory deduction.</span>
          </div>

          <div className="flex w-full gap-2">
            <Button
              type="button"
              variant="ghost"
              className="h-11 flex-1 border border-outline-variant/30 text-on-surface"
              onClick={() => router.push("/production")}
            >
              Cancel
            </Button>
            <Button className="h-11 flex-1" type="submit" disabled={isSubmitting}>
              <CalendarPlus className="h-5 w-5 mr-1" />
              {isSubmitting ? "Saving..." : "Save Draft"}
            </Button>
          </div>
        </Card>
      </form>
    </div>
  );
}

function parseOperationalDate(value: string) {
  if (!value.trim()) return undefined;
  const normalized = value.trim().replace(" ", "T");
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function toDateTimeLocal(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offsetMs = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}
