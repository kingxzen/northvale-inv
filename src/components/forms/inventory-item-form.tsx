"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Save } from "lucide-react";
import { Field } from "@/components/forms/field";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { inventoryItemSchema, type InventoryItemInput } from "@/lib/validation";
import type { Location, InventoryItem } from "@/types/domain";
import { useApp } from "@/context/app-context";

export interface InventoryItemFormProps {
  locations: Location[];
  initialItem?: InventoryItem;
}

export function InventoryItemForm({ locations, initialItem }: InventoryItemFormProps) {
  const router = useRouter();
  const { addInventoryItem, updateInventoryItem } = useApp();
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [hasSubmitted, setHasSubmitted] = useState(false);

  const form = useForm<InventoryItemInput>({
    resolver: zodResolver(inventoryItemSchema),
    defaultValues: {
      sku: initialItem?.sku ?? "",
      name: initialItem?.name ?? "",
      category: initialItem?.category ?? "raw",
      unit: initialItem?.unit ?? "kg",
      quantityOnHand: initialItem?.quantityOnHand ?? 0,
      reorderPoint: initialItem?.reorderPoint ?? 0,
      locationId: initialItem?.locationId ?? locations[0]?.id ?? "",
      unitCost: initialItem?.unitCost ?? ""
    }
  });

  const onSubmit = (data: InventoryItemInput) => {
    if (hasSubmitted) return;
    setHasSubmitted(true);
    const cost = data.unitCost !== "" && data.unitCost !== undefined ? Number(data.unitCost) : undefined;
    
    if (initialItem) {
      updateInventoryItem(initialItem.id, {
        name: data.name,
        category: data.category,
        unit: data.unit,
        quantityOnHand: Number(data.quantityOnHand),
        reorderPoint: Number(data.reorderPoint),
        locationId: data.locationId,
        unitCost: cost
      });
      setSuccessMessage("Changes saved successfully!");
    } else {
      addInventoryItem({
        sku: data.sku,
        name: data.name,
        category: data.category,
        unit: data.unit,
        quantityOnHand: Number(data.quantityOnHand),
        reorderPoint: Number(data.reorderPoint),
        locationId: data.locationId,
        unitCost: cost
      });
      setSuccessMessage("Inventory item added successfully!");
    }

    setTimeout(() => {
      router.push("/inventory");
      router.refresh();
    }, 1500);
  };

  return (
    <div className="relative">
      {successMessage && (
        <div className="fixed top-10 left-1/2 -translate-x-1/2 z-50 bg-success text-black font-semibold px-6 py-3 rounded-full shadow-glow animate-bounce">
          {successMessage}
        </div>
      )}

      <form className="space-y-5" onSubmit={form.handleSubmit(onSubmit)}>
        <Field id="sku" label="SKU" error={form.formState.errors.sku?.message}>
          <Input 
            id="sku" 
            placeholder="RM-SLES" 
            {...form.register("sku")} 
            disabled={!!initialItem}
          />
        </Field>
        <Field id="name" label="Item name" error={form.formState.errors.name?.message}>
          <Input id="name" placeholder="Sodium Lauryl Ether Sulfate" {...form.register("name")} />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="category" label="Category" error={form.formState.errors.category?.message}>
            <select id="category" className="focus-ring h-12 w-full rounded-md border border-outline-variant bg-surface-container-low px-4 text-on-surface" {...form.register("category")}>
              <option value="raw">Raw material</option>
              <option value="packaging">Packaging</option>
              <option value="finished">Finished good</option>
              <option value="asset">Asset</option>
            </select>
          </Field>
          <Field id="unit" label="Unit" error={form.formState.errors.unit?.message}>
            <select id="unit" className="focus-ring h-12 w-full rounded-md border border-outline-variant bg-surface-container-low px-4 text-on-surface" {...form.register("unit")}>
              <option value="kg">kg</option>
              <option value="g">g</option>
              <option value="liter">liter</option>
              <option value="ml">ml</option>
              <option value="gallon">gallon</option>
              <option value="pcs">pcs</option>
            </select>
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field id="quantityOnHand" label="On hand" error={form.formState.errors.quantityOnHand?.message}>
            <Input id="quantityOnHand" type="number" step="0.01" {...form.register("quantityOnHand")} />
          </Field>
          <Field id="reorderPoint" label="Reorder point" error={form.formState.errors.reorderPoint?.message}>
            <Input id="reorderPoint" type="number" step="0.01" {...form.register("reorderPoint")} />
          </Field>
        </div>
        <Field id="locationId" label="Location" error={form.formState.errors.locationId?.message}>
          <select id="locationId" className="focus-ring h-12 w-full rounded-md border border-outline-variant bg-surface-container-low px-4 text-on-surface" {...form.register("locationId")}>
            {locations.map((location) => (
              <option key={location.id} value={location.id}>
                {location.name}
              </option>
            ))}
          </select>
        </Field>
        <Field id="unitCost" label="Unit cost (optional)" error={form.formState.errors.unitCost?.message}>
          <Input id="unitCost" placeholder="Leave blank to warn only" {...form.register("unitCost")} />
        </Field>
        <div className="flex gap-4 pt-2">
          <Button 
            type="button" 
            variant="ghost" 
            className="flex-1 border border-outline-variant/30"
            onClick={() => router.push("/inventory")}
          >
            Cancel
          </Button>
          <Button className="flex-1" type="submit" disabled={hasSubmitted}>
            <Save className="h-5 w-5" />
            {hasSubmitted ? "Saving..." : initialItem ? "Save changes" : "Save item"}
          </Button>
        </div>
      </form>
    </div>
  );
}
