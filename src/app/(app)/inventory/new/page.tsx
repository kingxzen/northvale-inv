"use client";

import { AppShell } from "@/components/layout/app-shell";
import { Card } from "@/components/ui/card";
import { InventoryItemForm } from "@/components/forms/inventory-item-form";
import { useApp } from "@/context/app-context";

export default function NewInventoryItemPage() {
  const { locations } = useApp();

  return (
    <AppShell>
      <p className="text-label-md uppercase text-primary">Inventory</p>
      <h2 className="mt-3 text-headline-lg">Add inventory item</h2>
      <Card className="mt-6 p-5">
        <InventoryItemForm locations={locations} />
      </Card>
    </AppShell>
  );
}
