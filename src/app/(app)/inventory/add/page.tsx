"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useMemo } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Card } from "@/components/ui/card";
import { InventoryItemForm } from "@/components/forms/inventory-item-form";
import { useApp } from "@/context/app-context";

function AddInventoryItemContent() {
  const { inventoryItems, locations } = useApp();
  const searchParams = useSearchParams();
  const id = searchParams.get("id");
  const type = searchParams.get("type");

  const initialItem = useMemo(() => {
    if (!id) return undefined;
    return inventoryItems.find(
      (item) => item.id === id || item.id === `item-${id}` || item.sku.toLowerCase() === id.toLowerCase()
    );
  }, [id, inventoryItems]);

  const defaultItem = useMemo(() => {
    if (!initialItem && type === "asset") {
      return {
        id: "",
        sku: "",
        name: "",
        category: "asset" as const,
        unit: "pcs" as const,
        quantityOnHand: 0,
        reorderPoint: 0,
        locationId: "loc-a4",
        status: "active" as const
      };
    }
    return undefined;
  }, [initialItem, type]);

  return (
    <>
      <p className="text-label-md uppercase text-primary">Inventory</p>
      <h2 className="mt-3 text-headline-lg text-white">
        {initialItem ? `Edit item: ${initialItem.name}` : type === "asset" ? "Add asset" : "Add inventory item"}
      </h2>
      <Card className="mt-6 p-5">
        <InventoryItemForm 
          locations={locations} 
          initialItem={initialItem || defaultItem} 
        />
      </Card>
    </>
  );
}

export default function AddInventoryItemPage() {
  return (
    <AppShell>
      <Suspense fallback={<div className="text-on-surface-variant text-body-md">Loading form...</div>}>
        <AddInventoryItemContent />
      </Suspense>
    </AppShell>
  );
}
