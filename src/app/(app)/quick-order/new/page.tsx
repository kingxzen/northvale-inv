"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Save, Trash2 } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { PageBackButton } from "@/components/layout/page-back-button";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useApp } from "@/context/app-context";
import { cn, formatMoney } from "@/lib/utils";
import { convertQuantityForInventory } from "@/lib/units";
import {
  appendOrderLog,
  getPackingTemplates,
  getQuickOrders,
  makeOpId,
  saveQuickOrders,
  type PackingTemplateRecord,
  type QuickOrderRecord
} from "@/lib/operations-store";
import { listPackingTemplatesFromSupabase } from "@/lib/supabase/repositories/bom-packing";

type Line = { id: string; productId: string; quantity: number; notes?: string };
type Group = { id: string; templateId: string; assignedLineIds: string[]; manualSets: string; notes?: string };

export default function NewQuickOrderPage() {
  const { products, inventoryItems, updateInventoryItem, addStockTransaction, addActivityLog } = useApp();
  const finishedProducts = useMemo(() => products.filter(product => !product.isArchived), [products]);
  const [templates, setTemplates] = useState<PackingTemplateRecord[]>([]);
  const [platform, setPlatform] = useState("Shopee");
  const [referenceNo, setReferenceNo] = useState("");
  const [targetShipDate, setTargetShipDate] = useState("");
  const [preparedBy, setPreparedBy] = useState("");
  const [notes, setNotes] = useState("");
  const [otherExpense, setOtherExpense] = useState("");
  const [message, setMessage] = useState("");
  const [templateLoadMessage, setTemplateLoadMessage] = useState("");
  const [submittedOrderStatus, setSubmittedOrderStatus] = useState<"draft" | "processed" | null>(null);
  const [isProcessConfirmOpen, setIsProcessConfirmOpen] = useState(false);
  const [lines, setLines] = useState<Line[]>([{ id: makeOpId("line"), productId: "", quantity: 1 }]);
  const [groups, setGroups] = useState<Group[]>([{ id: makeOpId("group"), templateId: "", assignedLineIds: [], manualSets: "" }]);
  const [materialOverrides, setMaterialOverrides] = useState<Record<string, string>>({});

  useEffect(() => {
    let active = true;

    async function loadTemplates() {
      try {
        const supabaseTemplates = await listPackingTemplatesFromSupabase();
        const activeTemplates = supabaseTemplates.filter(template => template.status === "active");
        if (!active) return;
        setTemplates(activeTemplates);
        setTemplateLoadMessage(activeTemplates.length ? "" : "No active Supabase packing templates yet.");
        setGroups(prev => prev.map(group => ({ ...group, templateId: group.templateId || activeTemplates[0]?.id || "", assignedLineIds: group.assignedLineIds.length ? group.assignedLineIds : lines.map(line => line.id) })));
      } catch {
        const localTemplates = getPackingTemplates().filter(template => template.status === "active");
        if (!active) return;
        setTemplates(localTemplates);
        setTemplateLoadMessage("Packing templates loaded locally only. Check Supabase sync before processing.");
        setGroups(prev => prev.map(group => ({ ...group, templateId: group.templateId || localTemplates[0]?.id || "", assignedLineIds: group.assignedLineIds.length ? group.assignedLineIds : lines.map(line => line.id) })));
      }
    }

    setLines(prev => prev.map((line, index) => ({ ...line, productId: line.productId || finishedProducts[index]?.id || finishedProducts[0]?.id || "" })));
    void loadTemplates();

    return () => {
      active = false;
    };
  }, []);

  const finishedSummary = useMemo(() => lines.map(line => {
    const product = finishedProducts.find(item => item.id === line.productId);
    const stockItem = inventoryItems.find(item => item.id === product?.finishedGoodItemId);
    return {
      line,
      product,
      stockItem,
      unit: product?.outputUnit ?? stockItem?.unit ?? "pcs",
      available: stockItem?.quantityOnHand ?? 0,
      short: Math.max(0, line.quantity - (stockItem?.quantityOnHand ?? 0))
    };
  }), [finishedProducts, inventoryItems, lines]);

  const materialSummary = useMemo(() => {
    const summary = new Map<string, { name: string; inventoryItemId: string; required: number; unit: string; available: number; short: number; cost: number }>();

    groups.forEach(group => {
      const template = templates.find(item => item.id === group.templateId);
      if (!template) return;
      const assignedQty = group.assignedLineIds.reduce((sum, lineId) => sum + (lines.find(line => line.id === lineId)?.quantity ?? 0), 0);
      const autoSets = Math.ceil(assignedQty / template.capacity);
      const sets = Number(group.manualSets) > 0 ? Number(group.manualSets) : autoSets;

      template.materials.forEach(material => {
        const stock = inventoryItems.find(item => item.id === material.inventoryItemId && item.category === "packaging");
        if (!stock) return;
        const required = material.usageRule === "per_order" ? material.qty : material.usageRule === "per_item" ? material.qty * assignedQty : material.qty * sets;
        if (required <= 0) return;
        const requiredInStockUnit = convertQuantityForInventory(required, material.unit, stock.unit);
        const existing = summary.get(stock.id) ?? { name: stock.name, inventoryItemId: stock.id, required: 0, unit: stock.unit, available: stock.quantityOnHand, short: 0, cost: 0 };
        existing.required += requiredInStockUnit;
        existing.short = Math.max(0, existing.required - existing.available);
        existing.cost = existing.required * (stock.unitCost ?? 0);
        summary.set(stock.id, existing);
      });
    });

    return Array.from(summary.values()).map(item => {
      const override = materialOverrides[item.inventoryItemId];
      const required = override === undefined || override === "" ? item.required : Math.max(0, Number(override) || 0);
      return { ...item, required, short: Math.max(0, required - item.available), cost: required * (inventoryItems.find(stock => stock.id === item.inventoryItemId)?.unitCost ?? 0) };
    });
  }, [groups, inventoryItems, lines, materialOverrides, templates]);

  const packingCost = materialSummary.reduce((sum, item) => sum + item.cost, 0);

  const updateLine = (id: string, updates: Partial<Line>) => {
    setLines(prev => prev.map(line => line.id === id ? { ...line, ...updates } : line));
  };

  const addLine = () => {
    const next = { id: makeOpId("line"), productId: finishedProducts[0]?.id ?? "", quantity: 1 };
    setLines(prev => [...prev, next]);
    setGroups(prev => prev.map(group => ({ ...group, assignedLineIds: [...group.assignedLineIds, next.id] })));
  };

  const removeLine = (id: string) => {
    setLines(prev => prev.length === 1 ? prev : prev.filter(line => line.id !== id));
    setGroups(prev => prev.map(group => ({ ...group, assignedLineIds: group.assignedLineIds.filter(lineId => lineId !== id) })));
  };

  const updateGroup = (id: string, updates: Partial<Group>) => {
    setGroups(prev => prev.map(group => group.id === id ? { ...group, ...updates } : group));
  };

  const addGroup = () => {
    setGroups(prev => [...prev, { id: makeOpId("group"), templateId: templates[0]?.id ?? "", assignedLineIds: lines.map(line => line.id), manualSets: "" }]);
  };

  const buildOrder = (status: QuickOrderRecord["status"], inventoryDeducted = false): QuickOrderRecord => ({
    id: makeOpId("qo"),
    status,
    platform,
    referenceNo,
    targetShipDate,
    preparedBy: preparedBy || "Admin",
    processedBy: status === "processed" ? preparedBy || "Admin" : undefined,
    notes,
    otherExpense: otherExpense === "" ? undefined : Math.max(0, Number(otherExpense) || 0),
    lines,
    groups,
    materials: materialSummary.map(item => ({ name: item.name, inventoryItemId: item.inventoryItemId, required: item.required, unit: item.unit as QuickOrderRecord["materials"][number]["unit"], cost: item.cost })),
    createdAt: new Date().toISOString(),
    processedAt: status === "processed" ? new Date().toISOString() : undefined,
    inventoryDeducted
  });

  const saveDraft = () => {
    if (submittedOrderStatus) return;
    const order = appendOrderLog(buildOrder("draft"), `Order ${referenceNo || "new"} saved as Draft`, preparedBy || "Admin");
    saveQuickOrders([order, ...getQuickOrders()]);
    addActivityLog({ actorName: preparedBy || "Admin", action: `Quick Order draft saved${referenceNo ? `: ${referenceNo}` : ""}`, entityType: "quick_order", entityId: order.id });
    setSubmittedOrderStatus("draft");
    flash("Quick order saved as Draft. Inventory was not deducted.");
  };

  const processOrder = () => {
    if (submittedOrderStatus) return;
    setIsProcessConfirmOpen(false);
    const actor = preparedBy || "Admin";
    const order = buildOrder("processed", true);

    finishedSummary.forEach(entry => {
      if (!entry.stockItem) return;
      const afterQuantity = Math.max(0, entry.stockItem.quantityOnHand - entry.line.quantity);
      updateInventoryItem(entry.stockItem.id, { quantityOnHand: afterQuantity });
      addStockTransaction({ inventoryItemId: entry.stockItem.id, type: "quick_order_finished_good_out", quantity: entry.line.quantity, unit: entry.stockItem.unit, reference: referenceNo || order.id, beforeQuantity: entry.stockItem.quantityOnHand, afterQuantity, reason: `Quick Order finished good out ${referenceNo || order.id}` });
      addActivityLog({ actorName: actor, action: `${entry.product?.name ?? "Finished good"} deducted ${entry.line.quantity} ${entry.unit} for Quick Order ${referenceNo || order.id}`, entityType: "quick_order", entityId: order.id });
    });

    materialSummary.forEach(material => {
      const stock = inventoryItems.find(item => item.id === material.inventoryItemId && item.category === "packaging");
      if (!stock) return;
      const afterQuantity = Math.max(0, stock.quantityOnHand - material.required);
      updateInventoryItem(stock.id, { quantityOnHand: afterQuantity });
      addStockTransaction({ inventoryItemId: stock.id, type: "quick_order_packing_material_out", quantity: material.required, unit: stock.unit, reference: referenceNo || order.id, beforeQuantity: stock.quantityOnHand, afterQuantity, reason: `Quick Order packing material out ${referenceNo || order.id}` });
      addActivityLog({ actorName: actor, action: `${stock.name} deducted ${roundQty(material.required)} ${stock.unit} for Quick Order ${referenceNo || order.id}`, entityType: "quick_order", entityId: order.id });
    });

    const withLogs = [
      `Order ${referenceNo || order.id} processed`,
      ...finishedSummary.map(entry => `${entry.product?.name ?? "Finished good"} deducted ${entry.line.quantity} ${entry.unit}`),
      ...materialSummary.map(material => `${material.name} deducted ${roundQty(material.required)} ${material.unit}`)
    ].reduce((current, text) => appendOrderLog(current, text, actor), order);

    saveQuickOrders([withLogs, ...getQuickOrders()]);
    addActivityLog({ actorName: actor, action: `Quick Order processed: ${referenceNo || order.id}`, entityType: "quick_order", entityId: order.id });
    setSubmittedOrderStatus("processed");
    flash("Quick order processed. Finished goods and packing materials deducted once.");
  };

  const flash = (text: string) => {
    setMessage(text);
    setTimeout(() => setMessage(""), 3500);
  };

  return (
    <AppShell>
      {message && <div className="fixed left-4 right-4 top-4 z-[100] rounded-lg border border-success/30 bg-success/15 px-3 py-2 text-[13px] font-semibold text-success shadow-glow">{message}</div>}
      {isProcessConfirmOpen && (
        <ConfirmModal
          title="Process Quick Order?"
          message="This will deduct finished goods and ecommerce packing materials only. Raw materials will not be deducted."
          confirmLabel="Confirm Process"
          onCancel={() => setIsProcessConfirmOpen(false)}
          onConfirm={processOrder}
        />
      )}
      <PageBackButton fallbackHref="/quick-orders" />
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-label-sm uppercase text-primary">Packing</p>
          <h2 className="mt-1 text-[30px] font-bold leading-tight text-white">Quick Order / Packing</h2>
        </div>
        <span className="mt-2 rounded-full border border-outline-variant/40 bg-surface-container px-2.5 py-1 text-[11px] font-bold uppercase text-on-surface-variant">Draft</span>
      </div>

      <Card className="mt-3 rounded-lg border border-outline-variant/30 bg-surface-container p-3">
        <SectionTitle title="Order info" subtitle="Fulfillment only, no BOM ingredient deduction" />
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Field label="Platform"><select value={platform} onChange={e => setPlatform(e.target.value)} className="h-10 w-full rounded-md border border-outline bg-surface-container px-2 text-[13px] text-white"><option>Lazada</option><option>Shopee</option><option>TikTok</option><option>Manual</option></select></Field>
          <Field label="Ship date"><Input type="date" value={targetShipDate} onChange={e => setTargetShipDate(e.target.value)} className="h-10 text-[13px]" /></Field>
          <Field label="Reference no."><Input value={referenceNo} onChange={e => setReferenceNo(e.target.value)} className="h-10 text-[13px]" placeholder="ORDER-001" /></Field>
          <Field label="Prepared by"><Input value={preparedBy} onChange={e => setPreparedBy(e.target.value)} className="h-10 text-[13px]" /></Field>
          <Field label="Other expense"><Input type="number" min={0} value={otherExpense} onChange={e => setOtherExpense(e.target.value)} className="h-10 text-[13px]" placeholder="Courier, gas, third-party" /></Field>
          <Field label="Notes"><Input value={notes} onChange={e => setNotes(e.target.value)} className="h-10 text-[13px]" /></Field>
        </div>
      </Card>
      {templateLoadMessage && <Card className="mt-3 rounded-lg border border-warning/25 bg-warning/10 p-3 text-[12.5px] text-warning">{templateLoadMessage}</Card>}

      <Card className="mt-3 rounded-lg border border-outline-variant/30 bg-surface-container p-3">
        <div className="flex items-center justify-between gap-2"><SectionTitle title="Finished goods" subtitle="Deducted only when processed" /><Button size="sm" className="h-8 px-2 text-[12px]" onClick={addLine}><Plus className="h-4 w-4" /> Add</Button></div>
        <div className="mt-3 space-y-2">
          {lines.map(line => (
            <div key={line.id} className="grid grid-cols-[1fr_70px_40px] gap-2 rounded-md border border-outline-variant/20 bg-surface-container-low p-2">
              <select value={line.productId} onChange={e => updateLine(line.id, { productId: e.target.value })} className="h-10 min-w-0 rounded-md border border-outline bg-surface-container px-2 text-[13px] text-white">{finishedProducts.map(product => <option key={product.id} value={product.id}>{product.name}</option>)}</select>
              <Input type="number" min={1} value={line.quantity} onChange={e => updateLine(line.id, { quantity: Math.max(1, Number(e.target.value) || 1) })} className="h-10 text-right text-[13px]" />
              <button type="button" aria-label="Remove line" onClick={() => removeLine(line.id)} className="grid h-10 w-10 place-items-center rounded-md border border-outline-variant/25 text-error"><Trash2 className="h-4 w-4" /></button>
            </div>
          ))}
        </div>
      </Card>

      <Card className="mt-3 rounded-lg border border-outline-variant/30 bg-surface-container p-3">
        <div className="flex items-center justify-between gap-2"><SectionTitle title="Packing groups" subtitle="Template, assigned lines, sets" /><Button size="sm" className="h-8 px-2 text-[12px]" onClick={addGroup}><Plus className="h-4 w-4" /> Group</Button></div>
        <div className="mt-3 space-y-2">
          {groups.map(group => {
            const template = templates.find(item => item.id === group.templateId);
            const assignedQty = group.assignedLineIds.reduce((sum, lineId) => sum + (lines.find(line => line.id === lineId)?.quantity ?? 0), 0);
            const autoSets = template ? Math.ceil(assignedQty / template.capacity) : 0;
            const finalSets = Number(group.manualSets) > 0 ? Number(group.manualSets) : autoSets;
            return (
              <div key={group.id} className="rounded-md border border-outline-variant/20 bg-surface-container-low p-2">
                <div className="grid grid-cols-[1fr_76px] gap-2">
                  <Field label="Packing template"><select value={group.templateId} onChange={e => updateGroup(group.id, { templateId: e.target.value })} className="h-10 w-full rounded-md border border-outline bg-surface-container px-2 text-[13px] text-white">{templates.map(item => <option key={item.id} value={item.id}>{item.name}</option>)}</select></Field>
                  <Field label="Manual sets"><Input value={group.manualSets} onChange={e => updateGroup(group.id, { manualSets: e.target.value })} type="number" min={0} placeholder={`${autoSets}`} className="h-10 text-right text-[13px]" /></Field>
                </div>
                <div className="mt-2 grid grid-cols-2 gap-1">{lines.map(line => <label key={line.id} className="flex min-w-0 items-center gap-2 rounded-md border border-outline-variant/15 px-2 py-1.5 text-[12px] text-on-surface-variant"><input type="checkbox" checked={group.assignedLineIds.includes(line.id)} onChange={e => updateGroup(group.id, { assignedLineIds: e.target.checked ? [...group.assignedLineIds, line.id] : group.assignedLineIds.filter(id => id !== line.id) })} /><span className="truncate">{finishedProducts.find(item => item.id === line.productId)?.name ?? "Line"}</span></label>)}</div>
                <div className="mt-2 grid grid-cols-3 gap-2 text-[12px]"><Metric label="Qty" value={assignedQty} /><Metric label="Auto" value={autoSets} /><Metric label="Final" value={finalSets} /></div>
              </div>
            );
          })}
        </div>
      </Card>

      <SummaryCard title="Finished goods needed">{finishedSummary.map(item => <SummaryRow key={item.line.id} label={item.product?.name ?? "Unknown"} meta={`${item.line.quantity} ${item.unit} needed ${"\u2022"} ${item.available} available`} short={item.short > 0} trailing={item.short > 0 ? `Short ${item.short}` : "OK"} />)}</SummaryCard>
      <SummaryCard title="Packing materials needed">
        {materialSummary.length === 0 ? <p className="py-2 text-[12.5px] text-on-surface-variant">Choose a packing template and assign product lines.</p> : materialSummary.map(item => (
          <div key={item.inventoryItemId} className="grid grid-cols-[1fr_88px] gap-2 border-b border-outline-variant/10 py-2 last:border-b-0">
            <div className="min-w-0"><p className="truncate text-[13px] font-semibold text-white">{item.name}</p><p className={cn("mt-0.5 text-[11.5px]", item.short > 0 ? "text-error" : "text-on-surface-variant")}>{item.available} available {"\u2022"} {item.short > 0 ? `Short ${roundQty(item.short)}` : "OK"}</p></div>
            <Input value={materialOverrides[item.inventoryItemId] ?? roundQty(item.required)} onChange={e => setMaterialOverrides(prev => ({ ...prev, [item.inventoryItemId]: e.target.value }))} className="h-9 text-right text-[12.5px]" />
          </div>
        ))}
      </SummaryCard>

      <Card className="mt-3 rounded-lg border border-primary/20 bg-primary/10 p-3"><div className="flex items-center justify-between text-[13px]"><span className="text-primary">Estimated packing cost</span><strong className="text-white">{packingCost > 0 ? formatMoney(packingCost) : "Cost pending"}</strong></div></Card>

      <Card className="sticky bottom-20 z-30 mt-3 flex gap-2 rounded-lg border border-outline-variant/35 bg-surface-container/95 p-3 shadow-glow backdrop-blur-md">
        <Button type="button" className="h-10 flex-1" onClick={saveDraft} disabled={!!submittedOrderStatus}><Save className="h-4 w-4" /> {submittedOrderStatus === "draft" ? "Saved" : "Save Draft"}</Button>
        <Button type="button" className="h-10 flex-1" onClick={() => setIsProcessConfirmOpen(true)} disabled={!!submittedOrderStatus}>{submittedOrderStatus === "processed" ? "Processed" : "Process/Packed"}</Button>
      </Card>
    </AppShell>
  );
}

function ConfirmModal({
  title,
  message,
  confirmLabel,
  onCancel,
  onConfirm
}: Readonly<{ title: string; message: string; confirmLabel: string; onCancel: () => void; onConfirm: () => void }>) {
  return (
    <div className="fixed inset-0 z-[120] grid place-items-center bg-black/70 px-4 backdrop-blur-sm">
      <Card className="w-full max-w-[340px] rounded-lg border border-outline-variant/35 bg-surface-container p-4 shadow-glow">
        <h3 className="text-[18px] font-bold text-white">{title}</h3>
        <p className="mt-2 text-[13px] leading-5 text-on-surface-variant">{message}</p>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <Button type="button" variant="ghost" className="h-10" onClick={onCancel}>Cancel</Button>
          <Button type="button" className="h-10" onClick={onConfirm}>{confirmLabel}</Button>
        </div>
      </Card>
    </div>
  );
}

function roundQty(value: number) {
  return Number.isInteger(value) ? String(value) : value.toFixed(2).replace(/0+$/, "").replace(/\.$/, "");
}

function Field({ label, children }: Readonly<{ label: string; children: React.ReactNode }>) {
  return <label className="block space-y-1"><span className="text-[10.5px] font-bold uppercase text-outline">{label}</span>{children}</label>;
}

function SectionTitle({ title, subtitle }: Readonly<{ title: string; subtitle: string }>) {
  return <div><h3 className="text-[15px] font-semibold text-white">{title}</h3><p className="mt-0.5 text-[12px] text-on-surface-variant">{subtitle}</p></div>;
}

function Metric({ label, value }: Readonly<{ label: string; value: number }>) {
  return <div className="rounded-md bg-surface-container px-2 py-1.5"><p className="text-[10.5px] uppercase text-outline">{label}</p><p className="text-[13px] font-bold text-white">{roundQty(value)}</p></div>;
}

function SummaryCard({ title, children }: Readonly<{ title: string; children: React.ReactNode }>) {
  return <Card className="mt-3 rounded-lg border border-outline-variant/30 bg-surface-container p-3"><h3 className="text-[15px] font-semibold text-white">{title}</h3><div className="mt-2">{children}</div></Card>;
}

function SummaryRow({ label, meta, trailing, short }: Readonly<{ label: string; meta: string; trailing: string; short: boolean }>) {
  return <div className="flex items-center justify-between gap-3 border-b border-outline-variant/10 py-2 last:border-b-0"><div className="min-w-0"><p className="truncate text-[13px] font-semibold text-white">{label}</p><p className="mt-0.5 truncate text-[11.5px] text-on-surface-variant">{meta}</p></div><span className={cn("shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-bold", short ? "border-error/25 bg-error/10 text-error" : "border-success/20 bg-success/10 text-success")}>{trailing}</span></div>;
}
