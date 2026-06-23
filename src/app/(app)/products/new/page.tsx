"use client";

import { useState, useMemo } from "react";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { PageBackButton } from "@/components/layout/page-back-button";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ArrowRight, Save, Plus, Trash2 } from "lucide-react";
import { useApp } from "@/context/app-context";
import { cn } from "@/lib/utils";

import type { InventoryUnit } from "@/types/domain";

interface BOMLine {
  inventoryItemId: string;
  quantityPerBatch: number;
  unit: InventoryUnit;
  lineType: "raw_material" | "packaging";
}

export default function NewProductPage() {
  const router = useRouter();
  const { inventoryItems, addProduct } = useApp();
  const [step, setStep] = useState(1);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Active items for selecting BOM ingredients
  const activeItems = useMemo(() => inventoryItems.filter(item => !item.isArchived), [inventoryItems]);

  // Product Info state
  const [brand, setBrand] = useState("Keeva");
  const [productCode, setProductCode] = useState("KV-AIR-01");
  const [name, setName] = useState("Airzen");
  const [scent, setScent] = useState("Lavender");
  const [family, setFamily] = useState("Floral");
  const [category, setCategory] = useState("Air Care");
  const [defaultBatchSize, setDefaultBatchSize] = useState(500);
  const [outputUnit, setOutputUnit] = useState("Bottles (250ml)");
  const [notes, setNotes] = useState("");

  // BOM lines state
  const [bomLines, setBomLines] = useState<BOMLine[]>([
    { inventoryItemId: "item-sles", quantityPerBatch: 25, unit: "kg", lineType: "raw_material" },
    { inventoryItemId: "item-fragrance", quantityPerBatch: 2, unit: "liter", lineType: "raw_material" },
    { inventoryItemId: "item-carton", quantityPerBatch: 20, unit: "pcs", lineType: "packaging" }
  ]);

  // Adding BOM line state
  const [newLineItem, setNewLineItem] = useState(activeItems[0]?.id ?? "");
  const [newLineQty, setNewLineQty] = useState(1);

  const handleAddLine = () => {
    const selectedItem = inventoryItems.find((i) => i.id === newLineItem);
    if (!selectedItem) return;

    const lineType = selectedItem.category === "packaging" ? "packaging" : "raw_material";
    setBomLines([
      ...bomLines,
      {
        inventoryItemId: newLineItem,
        quantityPerBatch: Number(newLineQty) || 1,
        unit: selectedItem.unit,
        lineType
      }
    ]);
  };

  const handleRemoveLine = (index: number) => {
    setBomLines(bomLines.filter((_, i) => i !== index));
  };

  const handleSave = () => {
    const fullName = `${brand} ${name} ${scent}`.trim();
    
    // Save to context
    addProduct({
      sku: productCode,
      name: fullName,
      outputUnit: (outputUnit.includes("Bottle") ? "pcs" : "gallon") as any, // fallback matching unit cost unit
      batchSize: defaultBatchSize,
      finishedGoodItemId: "" // Context handles creating a finished good item automatically if empty
    }, bomLines);

    setSuccessMessage("Product and BOM configuration saved successfully!");
    setTimeout(() => {
      router.push("/products");
    }, 1500);
  };

  return (
    <AppShell>
      {/* Success Notification */}
      {successMessage && (
        <div className="fixed top-10 left-1/2 -translate-x-1/2 z-50 bg-success text-black font-semibold px-6 py-3 rounded-full shadow-glow animate-bounce">
          {successMessage}
        </div>
      )}

      {/* Top Header */}
      <div className="flex items-center gap-3 mb-6">
        <PageBackButton fallbackHref="/products" className="h-9 px-2" />
        <h2 className="text-headline-md font-bold text-primary">
          {step === 1 ? "Add product" : "Define BOM Lines"}
        </h2>
      </div>

      {/* Progress Indicators */}
      <div className="flex items-center justify-between mb-8 max-w-md mx-auto">
        <div className="flex flex-col items-center flex-1">
          <div className={cn(
            "w-10 h-10 rounded-full flex items-center justify-center font-bold mb-1 shadow-md transition-colors",
            step === 1 ? "bg-secondary-container text-on-secondary-container" : "bg-primary text-on-primary"
          )}>
            1
          </div>
          <span className="text-label-sm text-on-surface">Product info</span>
        </div>
        <div className="h-[2px] flex-1 bg-outline-variant/30 mx-4 mb-5" />
        <div className={cn("flex flex-col items-center flex-1 transition-opacity", step < 2 && "opacity-40")}>
          <div className={cn(
            "w-10 h-10 rounded-full flex items-center justify-center font-bold mb-1 transition-colors",
            step === 2 ? "bg-secondary-container text-on-secondary-container" : "bg-surface-variant text-on-surface-variant"
          )}>
            2
          </div>
          <span className="text-label-sm text-on-surface">BOM Entry</span>
        </div>
      </div>

      <Card className="p-6">
        {step === 1 ? (
          /* Step 1: Product info */
          <div className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-label-md text-on-surface-variant font-medium">Brand</label>
                <Input value={brand} onChange={(e) => setBrand(e.target.value)} placeholder="e.g. Keeva" />
              </div>
              <div className="space-y-2">
                <label className="text-label-md text-on-surface-variant font-medium">Product Code</label>
                <Input value={productCode} onChange={(e) => setProductCode(e.target.value)} placeholder="e.g. KV-001" />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-label-md text-on-surface-variant font-medium">Product Name</label>
              <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Airzen" />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-label-md text-on-surface-variant font-medium">Scent</label>
                <Input value={scent} onChange={(e) => setScent(e.target.value)} placeholder="e.g. Lavender" />
              </div>
              <div className="space-y-2">
                <label className="text-label-md text-on-surface-variant font-medium">Family</label>
                <select 
                  value={family} 
                  onChange={(e) => setFamily(e.target.value)} 
                  className="focus-ring h-12 w-full rounded-md border border-outline-variant bg-surface-container-low px-4 text-on-surface"
                >
                  <option>Floral</option>
                  <option>Woody</option>
                  <option>Citrus</option>
                  <option>Fresh</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-label-md text-on-surface-variant font-medium">Category</label>
              <div className="flex gap-2">
                {["Air Care", "Personal Care", "Home Fragrance"].map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategory(cat)}
                    className={cn(
                      "px-4 py-2 rounded-full text-label-sm transition font-medium border",
                      category === cat
                        ? "bg-secondary-container/20 border-secondary-container text-on-secondary-container"
                        : "bg-surface-container border-outline-variant/30 text-on-surface-variant hover:bg-surface-container-high"
                    )}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-label-md text-on-surface-variant font-medium">Default Batch Size</label>
                <div className="relative">
                  <Input type="number" value={defaultBatchSize} onChange={(e) => setDefaultBatchSize(Number(e.target.value))} />
                  <span className="absolute right-4 top-1/2 -translate-y-1/2 text-on-surface-variant font-semibold text-label-sm">Kg</span>
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-label-md text-on-surface-variant font-medium">Output Unit</label>
                <select 
                  value={outputUnit} 
                  onChange={(e) => setOutputUnit(e.target.value)} 
                  className="focus-ring h-12 w-full rounded-md border border-outline-variant bg-surface-container-low px-4 text-on-surface"
                >
                  <option>Bottles (250ml)</option>
                  <option>Bottles (500ml)</option>
                  <option>Tins (100g)</option>
                  <option>Bulk (Litre)</option>
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-label-md text-on-surface-variant font-medium">Notes</label>
              <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Production notes or storage requirements..." rows={3} />
            </div>

            <div className="flex gap-3 pt-2">
              <Button type="button" variant="ghost" className="flex-1 border border-outline-variant/30" onClick={() => router.push("/products")}>
                Cancel
              </Button>
              <Button type="button" className="flex-1" onClick={() => setStep(2)}>
                Continue to BOM
                <ArrowRight className="h-4 w-4 ml-1.5" />
              </Button>
            </div>
          </div>
        ) : (
          /* Step 2: BOM Entry */
          <div className="space-y-6">
            <div className="p-4 bg-surface-container-low border border-outline-variant/30 rounded-xl">
              <h4 className="text-label-md font-semibold text-primary mb-2">Product Summary</h4>
              <p className="text-body-sm text-on-surface-variant">
                Creating <span className="font-semibold text-white">{brand} {name}</span> ({productCode}) • Batch size: {defaultBatchSize} kg
              </p>
            </div>

            <div className="space-y-4">
              <h4 className="text-label-md uppercase text-on-surface-variant font-semibold">Current Bill of Materials</h4>
              <div className="divide-y divide-outline-variant/20 border border-outline-variant/30 rounded-xl overflow-hidden bg-surface-container-low">
                {bomLines.length === 0 ? (
                  <p className="text-body-sm text-on-surface-variant italic p-4 text-center">No lines added yet.</p>
                ) : (
                  bomLines.map((line, idx) => {
                    const item = inventoryItems.find((i) => i.id === line.inventoryItemId);
                    return (
                      <div key={idx} className="flex justify-between items-center p-3 hover:bg-surface-container-high/30 transition">
                        <div>
                          <p className="text-body-sm font-semibold text-white">{item?.name || "Unknown item"}</p>
                          <p className="text-label-sm text-on-surface-variant mt-0.5 capitalize">
                            {line.lineType.replace("_", " ")} • Quantity per batch: {line.quantityPerBatch} {line.unit}
                          </p>
                        </div>
                        <Button size="icon" variant="ghost" onClick={() => handleRemoveLine(idx)} className="text-error hover:bg-error/15">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Add Line Sub-form */}
            <div className="p-4 bg-surface-container rounded-xl border border-outline-variant/20 space-y-4">
              <h4 className="text-label-sm uppercase font-bold text-primary">Add BOM Line</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-label-sm text-on-surface-variant">BOM Ingredient/Packaging</label>
                  <select
                    value={newLineItem}
                    onChange={(e) => setNewLineItem(e.target.value)}
                    className="focus-ring h-10 w-full rounded-md border border-outline-variant bg-surface-container-low px-3 text-body-sm text-on-surface"
                  >
                    <option value="">Select component...</option>
                    {activeItems.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name} ({item.unit})
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-1">
                  <label className="text-label-sm text-on-surface-variant">Qty per Batch</label>
                  <div className="flex gap-2">
                    <Input
                      type="number"
                      step="0.01"
                      className="h-10 text-body-sm"
                      value={newLineQty}
                      onChange={(e) => setNewLineQty(Number(e.target.value))}
                    />
                    <Button type="button" className="h-10 px-4" onClick={handleAddLine} disabled={!newLineItem}>
                      <Plus className="h-4 w-4 mr-1" /> Add
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <Button type="button" variant="ghost" className="flex-1 border border-outline-variant/30" onClick={() => setStep(1)}>
                Back to Info
              </Button>
              <Button type="button" className="flex-1 bg-primary text-on-primary font-bold" onClick={handleSave}>
                <Save className="h-5 w-5" />
                Save Product
              </Button>
            </div>
          </div>
        )}
      </Card>
    </AppShell>
  );
}
