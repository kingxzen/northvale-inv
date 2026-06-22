"use client";

import { AppShell } from "@/components/layout/app-shell";
import { ProductionPlanForm } from "@/components/forms/production-plan-form";
import { useApp } from "@/context/app-context";

export default function NewProductionPage() {
  const { products, productBomLines, inventoryItems } = useApp();

  return (
    <AppShell>
      <p className="text-label-md uppercase text-primary">BOM planner</p>
      <h2 className="mt-2 text-[34px] font-bold leading-tight text-white">New production plan</h2>
      <div className="mt-4">
        <ProductionPlanForm products={products} bomLines={productBomLines} inventoryItems={inventoryItems} />
      </div>
    </AppShell>
  );
}
