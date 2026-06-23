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
import { getLogisticsExpenses, makeOpId, saveLogisticsExpenses } from "@/lib/operations-store";

type BulkLine = {
  id: string;
  inventoryItemId: string;
  quantity: number;
};

export default function BulkStockInPage() {
  const { inventoryItems, updateInventoryItem, addStockTransaction, addActivityLog } = useApp();
  const stockItems = useMemo(() => inventoryItems.filter(item => !item.isArchived && item.category !== "asset"), [inventoryItems]);
  const firstItem = stockItems[0];
  const [lines, setLines] = useState<BulkLine[]>(firstItem ? [{ id: makeOpId("bulk-line"), inventoryItemId: firstItem.id, quantity: 1 }] : []);
  const [supplier, setSupplier] = useState("");
  const [reference, setReference] = useState("");
  const [pickedUpBy, setPickedUpBy] = useState("");
  const [shippingExpense, setShippingExpense] = useState("");
  const [notes, setNotes] = useState("");
  const [message, setMessage] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const addLine = () => {
    const item = stockItems[0];
    if (!item) return;
    setLines(prev => [...prev, { id: makeOpId("bulk-line"), inventoryItemId: item.id, quantity: 1 }]);
  };

  const updateLine = (id: string, updates: Partial<BulkLine>) => {
    setLines(prev => prev.map(line => line.id === id ? { ...line, ...updates } : line));
  };

  const removeLine = (id: string) => {
    setLines(prev => prev.length === 1 ? prev : prev.filter(line => line.id !== id));
  };

  const saveBulkStockIn = () => {
    if (submitted) return;
    const validLines = lines.filter(line => line.inventoryItemId && line.quantity > 0);
    if (validLines.length === 0) {
      setMessage("Add at least one stock-in line.");
      return;
    }

    const batchRef = reference.trim() || `BULK-${new Date().toISOString().slice(0, 10)}`;
    validLines.forEach((line) => {
      const item = inventoryItems.find(entry => entry.id === line.inventoryItemId);
      if (!item) return;
      const afterQuantity = item.quantityOnHand + line.quantity;
      updateInventoryItem(item.id, { quantityOnHand: afterQuantity });
      addStockTransaction({
        inventoryItemId: item.id,
        type: "stock_in",
        quantity: line.quantity,
        unit: item.unit,
        reference: batchRef,
        beforeQuantity: item.quantityOnHand,
        afterQuantity,
        reason: `Bulk stock in${supplier ? ` from ${supplier}` : ""}${pickedUpBy ? ` picked up by ${pickedUpBy}` : ""}`
      });
      addActivityLog({
        actorName: "Admin",
        action: `Bulk stock-in ${line.quantity} ${item.unit} of ${item.name}`,
        entityType: "inventory_item",
        entityId: item.id
      });
    });

    const expense = Math.max(0, Number(shippingExpense) || 0);
    if (expense > 0) {
      saveLogisticsExpenses([
        {
          id: makeOpId("logx"),
          source: "bulk_stock_in",
          amount: expense,
          reference: batchRef,
          notes: [supplier && `Supplier: ${supplier}`, pickedUpBy && `Pickup: ${pickedUpBy}`, notes].filter(Boolean).join(" | "),
          createdAt: new Date().toISOString()
        },
        ...getLogisticsExpenses()
      ]);
      addActivityLog({
        actorName: "Admin",
        action: `Logged logistics expense ${expense} for bulk stock-in ${batchRef}`,
        entityType: "logistics_expense",
        entityId: batchRef
      });
    }

    setSubmitted(true);
    setMessage("Bulk stock-in saved. Shared logistics expense was recorded.");
  };

  return (
    <AppShell>
      <PageBackButton fallbackHref="/inventory" />
      {message && <div className="mb-3 rounded-lg border border-primary/25 bg-primary/10 px-3 py-2 text-[12.5px] text-primary">{message}</div>}
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-label-sm uppercase text-primary">Inventory</p>
          <h2 className="mt-1 text-[30px] font-bold leading-tight text-white">Bulk Stock In</h2>
        </div>
        <span className="mt-2 rounded-full border border-outline-variant/30 bg-surface-container px-2.5 py-1 text-[11px] font-bold text-on-surface-variant">
          {lines.length} lines
        </span>
      </div>

      <Card className="mt-3 rounded-lg border border-outline-variant/30 bg-surface-container p-3">
        <div className="grid grid-cols-2 gap-2">
          <Field label="Supplier"><Input value={supplier} onChange={event => setSupplier(event.target.value)} className="h-10 text-[13px]" /></Field>
          <Field label="Reference"><Input value={reference} onChange={event => setReference(event.target.value)} placeholder="DR/SI no." className="h-10 text-[13px]" /></Field>
          <Field label="Picked up by"><Input value={pickedUpBy} onChange={event => setPickedUpBy(event.target.value)} className="h-10 text-[13px]" /></Field>
          <Field label="Shipping fee"><Input type="number" min={0} value={shippingExpense} onChange={event => setShippingExpense(event.target.value)} placeholder="0" className="h-10 text-[13px]" /></Field>
        </div>
        <Field label="Notes"><Textarea value={notes} onChange={event => setNotes(event.target.value)} placeholder="Shared pickup, supplier notes, courier..." className="mt-1 min-h-20 text-[13px]" /></Field>
      </Card>

      <Card className="mt-3 rounded-lg border border-outline-variant/30 bg-surface-container p-3">
        <div className="flex items-center justify-between gap-2">
          <h3 className="text-[15px] font-semibold text-white">Stock-in lines</h3>
          <Button type="button" size="sm" className="h-8 px-2 text-[12px]" onClick={addLine}>
            <Plus className="h-4 w-4" /> Line
          </Button>
        </div>
        <div className="mt-3 space-y-2">
          {lines.map((line) => {
            const item = inventoryItems.find(entry => entry.id === line.inventoryItemId);
            return (
              <div key={line.id} className="rounded-md border border-outline-variant/20 bg-surface-container-low p-2">
                <SearchableInventoryPicker
                  items={stockItems}
                  value={line.inventoryItemId}
                  onChange={(itemId) => updateLine(line.id, { inventoryItemId: itemId })}
                  placeholder="Search raw, packaging, finished..."
                />
                <div className="mt-1.5 grid grid-cols-[1fr_74px_40px] gap-1.5">
                  <p className="truncate rounded-md border border-outline-variant/20 px-2 py-2 text-[12px] text-on-surface-variant">
                    Current {item?.quantityOnHand ?? 0} {item?.unit ?? "unit"}
                  </p>
                  <Input type="number" min={0} value={line.quantity} onChange={event => updateLine(line.id, { quantity: Math.max(0, Number(event.target.value) || 0) })} className="h-9 text-right text-[12px]" />
                  <button type="button" aria-label="Remove line" onClick={() => removeLine(line.id)} className="grid h-9 w-10 place-items-center rounded-md border border-outline-variant/25 text-error">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      <Card className="sticky bottom-20 z-30 mt-3 flex gap-2 rounded-lg border border-outline-variant/35 bg-surface-container/95 p-3 shadow-glow backdrop-blur-md">
        <Button type="button" className="h-10 flex-1" onClick={saveBulkStockIn} disabled={submitted}>
          <Save className="h-4 w-4" /> {submitted ? "Saved" : "Save Bulk Stock In"}
        </Button>
      </Card>
    </AppShell>
  );
}

function Field({ label, children }: Readonly<{ label: string; children: React.ReactNode }>) {
  return <label className="block space-y-1"><span className="text-[10.5px] font-bold uppercase text-outline">{label}</span>{children}</label>;
}
