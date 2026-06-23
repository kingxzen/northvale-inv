"use client";

import { useMemo, useState } from "react";
import { Plus, Save, Trash2 } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { PageBackButton } from "@/components/layout/page-back-button";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { SearchableInventoryPicker } from "@/components/ui/searchable-inventory-picker";
import { useApp } from "@/context/app-context";
import { compatibleUnitsFor, convertQuantityForInventory } from "@/lib/units";
import { getQuickPlans, makeQuickPlanId, saveQuickPlans, type QuickPlan, type QuickPlanMaterial, type QuickPlanPurpose } from "@/lib/quick-plans";
import type { InventoryItem, InventoryUnit } from "@/types/domain";

type MaterialDraft = QuickPlanMaterial;

export default function NewQuickPlanPage() {
  const { inventoryItems, updateInventoryItem, addStockTransaction, addActivityLog } = useApp();
  const finishedItems = useMemo(() => inventoryItems.filter(item => item.category === "finished" && !item.isArchived), [inventoryItems]);
  const materialItems = useMemo(() => inventoryItems.filter(item => (item.category === "raw" || item.category === "packaging") && !item.isArchived), [inventoryItems]);
  const firstFinished = finishedItems[0];

  const [title, setTitle] = useState("Quick finished goods out");
  const [purpose, setPurpose] = useState<QuickPlanPurpose>("customer");
  const [reference, setReference] = useState("");
  const [finishedGoodItemId, setFinishedGoodItemId] = useState(firstFinished?.id ?? "");
  const [finishedGoodQty, setFinishedGoodQty] = useState(1);
  const [bomNote, setBomNote] = useState("");
  const [notes, setNotes] = useState("");
  const [otherCost, setOtherCost] = useState("");
  const [materials, setMaterials] = useState<MaterialDraft[]>([]);
  const [message, setMessage] = useState("");
  const [submittedStatus, setSubmittedStatus] = useState<"draft" | "completed" | null>(null);

  const selectedFinished = inventoryItems.find(item => item.id === finishedGoodItemId);
  const finishedShort = Math.max(0, finishedGoodQty - (selectedFinished?.quantityOnHand ?? 0));

  const addMaterial = () => {
    const item = materialItems[0];
    if (!item) return;
    setMaterials(prev => [...prev, { id: makeQuickPlanId("qpm"), inventoryItemId: item.id, quantity: 1, unit: item.unit }]);
  };

  const updateMaterial = (id: string, updates: Partial<MaterialDraft>) => {
    setMaterials(prev => prev.map(line => line.id === id ? { ...line, ...updates } : line));
  };

  const removeMaterial = (id: string) => {
    setMaterials(prev => prev.filter(line => line.id !== id));
  };

  const buildPlan = (status: QuickPlan["status"]): QuickPlan => ({
    id: makeQuickPlanId(),
    status,
    title: title.trim() || "Quick plan",
    purpose,
    reference: reference.trim() || undefined,
    finishedGoodItemId,
    finishedGoodQty,
    finishedGoodUnit: selectedFinished?.unit ?? "pcs",
    bomNote: bomNote.trim() || undefined,
    materials,
    otherCost: otherCost === "" ? undefined : Number(otherCost) || 0,
    notes: notes.trim() || undefined,
    createdAt: new Date().toISOString(),
    completedAt: status === "completed" ? new Date().toISOString() : undefined
  });

  const persistPlan = (plan: QuickPlan) => {
    saveQuickPlans([plan, ...getQuickPlans()]);
  };

  const saveDraft = () => {
    if (submittedStatus) return;
    if (!selectedFinished) {
      setMessage("Select a finished good first.");
      return;
    }
    const plan = buildPlan("draft");
    persistPlan(plan);
    addActivityLog({ actorName: "Admin", action: `Quick plan draft saved: ${plan.title}`, entityType: "quick_plan", entityId: plan.id });
    setSubmittedStatus("draft");
    setMessage("Quick plan saved as Draft. Inventory was not deducted.");
  };

  const completePlan = () => {
    if (submittedStatus) return;
    if (!selectedFinished) {
      setMessage("Select a finished good first.");
      return;
    }
    if (finishedShort > 0) {
      setMessage(`Finished goods short by ${finishedShort} ${selectedFinished.unit}.`);
      return;
    }

    const materialShortage = materials
      .map((line) => {
        const item = inventoryItems.find(entry => entry.id === line.inventoryItemId);
        if (!item) return null;
        const quantity = convertQuantityForInventory(line.quantity, line.unit, item.unit);
        return quantity > item.quantityOnHand ? `${item.name} short by ${quantity - item.quantityOnHand} ${item.unit}` : null;
      })
      .find(Boolean);

    if (materialShortage) {
      setMessage(materialShortage);
      return;
    }

    const plan = buildPlan("completed");
    deductItem(selectedFinished, finishedGoodQty, selectedFinished.unit, `Quick plan finished goods out${reference ? ` ${reference}` : ""}`, plan.id);

    materials.forEach(line => {
      const item = inventoryItems.find(entry => entry.id === line.inventoryItemId);
      if (!item) return;
      const quantity = convertQuantityForInventory(line.quantity, line.unit, item.unit);
      deductItem(item, quantity, item.unit, `Quick plan material used${reference ? ` ${reference}` : ""}`, plan.id);
    });

    persistPlan(plan);
    addActivityLog({ actorName: "Admin", action: `Quick plan completed: ${plan.title}`, entityType: "quick_plan", entityId: plan.id });
    setSubmittedStatus("completed");
    setMessage("Quick plan completed. Finished goods and selected materials were deducted once.");
  };

  const deductItem = (item: InventoryItem, quantity: number, unit: InventoryUnit, reason: string, referenceId: string) => {
    const afterQuantity = Math.max(0, item.quantityOnHand - quantity);
    updateInventoryItem(item.id, { quantityOnHand: afterQuantity });
    addStockTransaction({
      inventoryItemId: item.id,
      type: "stock_out",
      quantity,
      unit,
      reference: reference || referenceId,
      beforeQuantity: item.quantityOnHand,
      afterQuantity,
      reason
    });
  };

  return (
    <AppShell>
      <PageBackButton fallbackHref="/production" />
      {message && <div className="mb-3 rounded-lg border border-primary/25 bg-primary/10 px-3 py-2 text-[12.5px] text-primary">{message}</div>}
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-label-sm uppercase text-primary">Operations</p>
          <h2 className="mt-1 text-[30px] font-bold leading-tight text-white">Quick Plan</h2>
        </div>
        <span className="mt-2 rounded-full border border-outline-variant/30 bg-surface-container px-2.5 py-1 text-[11px] font-bold text-on-surface-variant">
          {submittedStatus ?? "draft"}
        </span>
      </div>

      <Card className="mt-3 rounded-lg border border-outline-variant/30 bg-surface-container p-3">
        <div className="grid grid-cols-2 gap-2">
          <Field label="Title"><Input value={title} onChange={event => setTitle(event.target.value)} className="h-10 text-[13px]" /></Field>
          <Field label="Purpose">
            <select value={purpose} onChange={event => setPurpose(event.target.value as QuickPlanPurpose)} className="h-10 w-full rounded-md border border-outline bg-surface-container px-2 text-[13px] text-white">
              <option value="customer">Customer quick order</option>
              <option value="stock">For stocks</option>
              <option value="other">Other</option>
            </select>
          </Field>
          <div className="col-span-2"><Field label="Reference / reason"><Input value={reference} onChange={event => setReference(event.target.value)} placeholder="Customer, stock move, or reason" className="h-10 text-[13px]" /></Field></div>
        </div>
      </Card>

      <Card className="mt-3 rounded-lg border border-outline-variant/30 bg-surface-container p-3">
        <h3 className="text-[15px] font-semibold text-white">Finished goods out</h3>
        <div className="mt-3 grid grid-cols-[1fr_86px] gap-2">
          <SearchableInventoryPicker
            items={finishedItems}
            onChange={(itemId) => setFinishedGoodItemId(itemId)}
            placeholder="Search finished goods..."
            value={finishedGoodItemId}
          />
          <Input type="number" min={1} value={finishedGoodQty} onChange={event => setFinishedGoodQty(Math.max(1, Number(event.target.value) || 1))} className="h-9 text-right text-[13px]" />
        </div>
        <p className="mt-2 text-[12px] text-on-surface-variant">
          Available: {selectedFinished?.quantityOnHand ?? 0} {selectedFinished?.unit ?? "unit"}
          {finishedShort > 0 ? <span className="text-error"> • Short {finishedShort}</span> : null}
        </p>
      </Card>

      <Card className="mt-3 rounded-lg border border-outline-variant/30 bg-surface-container p-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-[15px] font-semibold text-white">Optional materials / costs</h3>
          <Button type="button" size="sm" className="h-8 px-2 text-[12px]" onClick={addMaterial}><Plus className="h-4 w-4" /> Material</Button>
        </div>
        <div className="mt-3 space-y-2">
          {materials.length === 0 ? <p className="text-[12.5px] text-on-surface-variant">Add raw or packaging only if something extra was used.</p> : materials.map(line => {
            const item = materialItems.find(entry => entry.id === line.inventoryItemId);
            const unitOptions = item ? compatibleUnitsFor(item.unit) : [line.unit];
            return (
              <div key={line.id} className="rounded-md border border-outline-variant/20 bg-surface-container-low p-2">
                <SearchableInventoryPicker
                  items={materialItems}
                  onChange={(itemId, selectedItem) => updateMaterial(line.id, { inventoryItemId: itemId, unit: selectedItem.unit })}
                  placeholder="Search raw or packaging..."
                  value={line.inventoryItemId}
                />
                <div className="mt-1.5 grid grid-cols-[72px_78px_40px] gap-1.5">
                  <Input type="number" min={0} value={line.quantity} onChange={event => updateMaterial(line.id, { quantity: Math.max(0, Number(event.target.value) || 0) })} className="h-9 text-right text-[12px]" />
                  <select value={line.unit} onChange={event => updateMaterial(line.id, { unit: event.target.value as InventoryUnit })} className="h-9 rounded-md border border-outline bg-surface-container px-1 text-[12px] text-white">
                    {unitOptions.map(unit => <option key={unit} value={unit}>{unit}</option>)}
                  </select>
                  <button type="button" aria-label="Remove material" onClick={() => removeMaterial(line.id)} className="grid h-9 w-10 place-items-center rounded-md border border-outline-variant/25 text-error"><Trash2 className="h-4 w-4" /></button>
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Field label="Other cost optional"><Input type="number" value={otherCost} onChange={event => setOtherCost(event.target.value)} placeholder="0" className="h-10 text-[13px]" /></Field>
          <Field label="BOM/material note"><Input value={bomNote} onChange={event => setBomNote(event.target.value)} placeholder="Optional" className="h-10 text-[13px]" /></Field>
        </div>
        <Field label="Notes"><Textarea value={notes} onChange={event => setNotes(event.target.value)} placeholder="What happened?" className="mt-1 min-h-20 text-[13px]" /></Field>
      </Card>

      <Card className="sticky bottom-20 z-30 mt-3 flex gap-2 rounded-lg border border-outline-variant/35 bg-surface-container/95 p-3 shadow-glow backdrop-blur-md">
        <Button type="button" className="h-10 flex-1" onClick={saveDraft} disabled={!!submittedStatus}><Save className="h-4 w-4" /> {submittedStatus === "draft" ? "Saved" : "Save Draft"}</Button>
        <Button type="button" className="h-10 flex-1" onClick={completePlan} disabled={!!submittedStatus}>{submittedStatus === "completed" ? "Completed" : "Complete Out"}</Button>
      </Card>
    </AppShell>
  );
}

function Field({ label, children }: Readonly<{ label: string; children: React.ReactNode }>) {
  return <label className="block space-y-1"><span className="text-[10.5px] font-bold uppercase text-outline">{label}</span>{children}</label>;
}
