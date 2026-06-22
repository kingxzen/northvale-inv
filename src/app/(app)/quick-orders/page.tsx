"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useApp } from "@/context/app-context";
import { cn, formatMoney } from "@/lib/utils";
import { appendOrderLog, getQuickOrders, saveQuickOrders, type QuickOrderRecord } from "@/lib/operations-store";

type RangeMode = "Today" | "This week" | "This month" | "Custom";

function dateValue(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

function getPresetRange(range: RangeMode) {
  const now = new Date();
  if (range === "Today") return { start: dateValue(now), end: dateValue(now) };
  if (range === "This month") return { start: dateValue(new Date(now.getFullYear(), now.getMonth(), 1)), end: dateValue(new Date(now.getFullYear(), now.getMonth() + 1, 0)) };
  const day = now.getDay();
  const start = new Date(now);
  start.setDate(now.getDate() + (day === 0 ? -6 : 1 - day));
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { start: dateValue(start), end: dateValue(end) };
}

function inRange(value: string | undefined, start: string, end: string) {
  if (!value) return false;
  const time = new Date(value).getTime();
  return time >= new Date(`${start}T00:00:00`).getTime() && time <= new Date(`${end}T23:59:59`).getTime();
}

function orderDate(order: QuickOrderRecord) {
  return order.completedAt ?? order.processedAt ?? order.packedAt ?? order.createdAt;
}

export default function QuickOrdersPage() {
  const { inventoryItems, products, updateInventoryItem, addStockTransaction, addActivityLog } = useApp();
  const [orders, setOrders] = useState<QuickOrderRecord[]>([]);
  const [range, setRange] = useState<RangeMode>("This week");
  const preset = getPresetRange("This week");
  const [startDate, setStartDate] = useState(preset.start);
  const [endDate, setEndDate] = useState(preset.end);
  const [platform, setPlatform] = useState("All");
  const [status, setStatus] = useState("All");
  const [message, setMessage] = useState("");
  const [pendingConfirm, setPendingConfirm] = useState<{ type: "process" | "complete"; order: QuickOrderRecord } | null>(null);

  useEffect(() => {
    setOrders(getQuickOrders());
  }, []);

  const updateOrders = (next: QuickOrderRecord[]) => {
    setOrders(next);
    saveQuickOrders(next);
  };

  const setPreset = (nextRange: Exclude<RangeMode, "Custom">) => {
    const next = getPresetRange(nextRange);
    setRange(nextRange);
    setStartDate(next.start);
    setEndDate(next.end);
  };

  const filtered = useMemo(() => orders.filter(order => {
    const platformMatch = platform === "All" || order.platform === platform;
    const statusMatch = status === "All" || order.status === status || (status === "processed" && order.status === "packed");
    return platformMatch && statusMatch && inRange(orderDate(order), startDate, endDate);
  }), [endDate, orders, platform, startDate, status]);

  const summaries = useMemo(() => {
    const processed = filtered.filter(order => order.status === "processed" || order.status === "packed").length;
    const completed = filtered.filter(order => order.status === "completed").length;
    const finished = filtered.reduce((sum, order) => sum + order.lines.reduce((lineSum, line) => lineSum + Number(line.quantity || 0), 0), 0);
    const packingExpense = filtered.reduce((sum, order) => sum + order.materials.reduce((matSum, material) => matSum + (material.cost ?? 0), 0), 0);
    return { processed, completed, finished, packingExpense };
  }, [filtered]);

  const deductOrder = (order: QuickOrderRecord) => {
    if (order.inventoryDeducted) return order;
    const actor = order.processedBy || order.preparedBy || "Admin";

    order.lines.forEach(line => {
      const product = products.find(item => item.id === line.productId);
      const stock = inventoryItems.find(item => item.id === product?.finishedGoodItemId);
      if (!stock) return;
      const afterQuantity = Math.max(0, stock.quantityOnHand - line.quantity);
      updateInventoryItem(stock.id, { quantityOnHand: afterQuantity });
      addStockTransaction({ inventoryItemId: stock.id, type: "quick_order_finished_good_out", quantity: line.quantity, unit: stock.unit, reference: order.referenceNo || order.id, beforeQuantity: stock.quantityOnHand, afterQuantity, reason: `Quick Order finished good out ${order.referenceNo || order.id}` });
      addActivityLog({ actorName: actor, action: `${product?.name ?? "Finished good"} deducted ${line.quantity} ${stock.unit} for Quick Order ${order.referenceNo || order.id}`, entityType: "quick_order", entityId: order.id });
    });

    order.materials.forEach(material => {
      const stock = inventoryItems.find(item => item.id === material.inventoryItemId && item.category === "packaging");
      if (!stock) return;
      const afterQuantity = Math.max(0, stock.quantityOnHand - material.required);
      updateInventoryItem(stock.id, { quantityOnHand: afterQuantity });
      addStockTransaction({ inventoryItemId: stock.id, type: "quick_order_packing_material_out", quantity: material.required, unit: stock.unit, reference: order.referenceNo || order.id, beforeQuantity: stock.quantityOnHand, afterQuantity, reason: `Quick Order packing material out ${order.referenceNo || order.id}` });
      addActivityLog({ actorName: actor, action: `${stock.name} deducted ${material.required} ${stock.unit} for Quick Order ${order.referenceNo || order.id}`, entityType: "quick_order", entityId: order.id });
    });

    return appendOrderLog({ ...order, inventoryDeducted: true }, `Inventory deducted for ${order.referenceNo || order.id}`, actor);
  };

  const markProcessed = (order: QuickOrderRecord) => {
    if (!order.inventoryDeducted) {
      setPendingConfirm({ type: "process", order });
      return;
    }
    processConfirmed(order);
  };

  const processConfirmed = (order: QuickOrderRecord) => {
    setPendingConfirm(null);
    const actor = order.processedBy || order.preparedBy || "Admin";
    const deducted = deductOrder(order);
    const nextOrder = appendOrderLog({ ...deducted, status: "processed", processedAt: deducted.processedAt ?? new Date().toISOString(), processedBy: actor }, `Order ${order.referenceNo || order.id} processed`, actor);
    updateOrders(orders.map(item => item.id === order.id ? nextOrder : item));
    addActivityLog({ actorName: actor, action: `Quick Order processed: ${order.referenceNo || order.id}`, entityType: "quick_order", entityId: order.id });
    flash("Order processed/packed. Deduction guarded against repeats.");
  };

  const markCompleted = (order: QuickOrderRecord) => {
    if (!order.inventoryDeducted) {
      setPendingConfirm({ type: "complete", order });
      return;
    }
    completeConfirmed(order);
  };

  const completeConfirmed = (order: QuickOrderRecord) => {
    setPendingConfirm(null);
    const actor = order.completedBy || order.processedBy || order.preparedBy || "Admin";
    const deducted = deductOrder(order);
    const nextOrder = appendOrderLog({ ...deducted, status: "completed", completedAt: new Date().toISOString(), completedBy: actor }, `Order ${order.referenceNo || order.id} completed`, actor);
    updateOrders(orders.map(item => item.id === order.id ? nextOrder : item));
    addActivityLog({ actorName: actor, action: `Quick Order completed: ${order.referenceNo || order.id}`, entityType: "quick_order", entityId: order.id });
    flash(order.inventoryDeducted ? "Order completed. Inventory was not deducted again." : "Order completed and inventory deducted once.");
  };

  const flash = (text: string) => {
    setMessage(text);
    setTimeout(() => setMessage(""), 3500);
  };

  return (
    <AppShell>
      {message && <div className="fixed left-4 right-4 top-4 z-[100] rounded-lg border border-success/30 bg-success/15 px-3 py-2 text-[13px] font-semibold text-success shadow-glow">{message}</div>}
      {pendingConfirm && (
        <ConfirmModal
          title={pendingConfirm.type === "process" ? "Process Quick Order?" : "Complete Quick Order?"}
          message="This will deduct finished goods and ecommerce packing materials only. Raw materials will not be deducted."
          confirmLabel={pendingConfirm.type === "process" ? "Confirm Process" : "Confirm Complete"}
          onCancel={() => setPendingConfirm(null)}
          onConfirm={() => pendingConfirm.type === "process" ? processConfirmed(pendingConfirm.order) : completeConfirmed(pendingConfirm.order)}
        />
      )}
      <p className="text-label-sm uppercase text-primary">Ecommerce</p>
      <h2 className="mt-1 text-[32px] font-bold leading-tight text-white">Quick Order History</h2>

      <div className="mt-3 grid grid-cols-3 gap-1.5">
        {(["Today", "This week", "This month"] as const).map(item => <button key={item} type="button" onClick={() => setPreset(item)} className={cn("rounded-full border px-2 py-2 text-[11.5px] font-semibold", range === item ? "border-primary bg-primary text-on-primary" : "border-outline-variant/30 bg-surface-container text-on-surface-variant")}>{item}</button>)}
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <Input aria-label="Start date" type="date" value={startDate} onChange={e => { setRange("Custom"); setStartDate(e.target.value); }} className="h-10 text-[12.5px]" />
        <Input aria-label="End date" type="date" value={endDate} onChange={e => { setRange("Custom"); setEndDate(e.target.value); }} className="h-10 text-[12.5px]" />
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <select value={platform} onChange={e => setPlatform(e.target.value)} className="h-10 rounded-md border border-outline bg-surface-container px-2 text-[13px] text-white"><option>All</option><option>Lazada</option><option>Shopee</option><option>TikTok</option><option>Manual</option></select>
        <select value={status} onChange={e => setStatus(e.target.value)} className="h-10 rounded-md border border-outline bg-surface-container px-2 text-[13px] text-white"><option value="All">All status</option><option value="draft">Draft</option><option value="processed">Processed/Packed</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select>
      </div>

      <section className="mt-3 grid grid-cols-2 gap-2">
        <Summary label="Orders processed" value={summaries.processed} />
        <Summary label="Orders completed" value={summaries.completed} />
        <Summary label="Finished goods released" value={summaries.finished} />
        <Summary label="Packing expenses" value={formatMoney(summaries.packingExpense)} />
      </section>

      <section className="mt-3 space-y-2 pb-16">
        {filtered.length === 0 ? <Card className="rounded-lg border border-outline-variant/30 bg-surface-container p-3 text-[13px] text-on-surface-variant">No quick orders in this date range.</Card> : filtered.map(order => {
          const finishedQty = order.lines.reduce((sum, line) => sum + Number(line.quantity || 0), 0);
          const packingCost = order.materials.reduce((sum, material) => sum + (material.cost ?? 0), 0);
          return (
            <Card key={order.id} className="rounded-lg border border-outline-variant/30 bg-surface-container p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="truncate text-[15px] font-semibold text-white">{order.platform} {"\u2022"} {order.referenceNo || "No reference"}</h3>
                  <p className="mt-0.5 text-[12px] text-on-surface-variant">{order.processedAt ? `Processed ${new Date(order.processedAt).toLocaleDateString()}` : "Not processed"} {"\u2022"} {order.completedAt ? `Done ${new Date(order.completedAt).toLocaleDateString()}` : "Not completed"}</p>
                  <p className="mt-0.5 text-[12px] text-on-surface-variant">{order.processedBy || order.preparedBy || "Admin"}</p>
                </div>
                <span className="rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[11px] font-bold uppercase text-primary">{order.status}</span>
              </div>
              <div className="mt-2 grid grid-cols-2 gap-2 text-[12.5px]">
                <Mini label="Finished goods released" value={finishedQty} />
                <Mini label="Packing cost" value={formatMoney(packingCost)} />
              </div>
              <div className="mt-2 grid grid-cols-2 gap-1.5">
                <Button size="sm" variant="ghost" className="h-8 text-[12px]" onClick={() => markProcessed(order)} disabled={order.status === "processed" || order.status === "completed"}>Process/Packed</Button>
                <Button size="sm" className="h-8 text-[12px]" onClick={() => markCompleted(order)} disabled={order.status === "completed"}>Complete</Button>
              </div>
              {order.logs && order.logs.length > 0 && <div className="mt-2 rounded-md bg-surface-container-low px-2 py-1.5"><p className="text-[11px] font-bold uppercase text-outline">Logs</p>{order.logs.slice(0, 4).map(log => <p key={`${log.text}-${log.createdAt}`} className="truncate text-[11.5px] text-on-surface-variant">{log.text}</p>)}</div>}
            </Card>
          );
        })}
      </section>
    </AppShell>
  );
}

function Summary({ label, value }: Readonly<{ label: string; value: string | number }>) {
  return <Card className="rounded-lg border border-outline-variant/30 bg-surface-container p-3"><p className="text-[11px] text-on-surface-variant">{label}</p><p className="mt-1 truncate text-[15px] font-bold text-white">{value}</p></Card>;
}

function Mini({ label, value }: Readonly<{ label: string; value: string | number }>) {
  return <div className="rounded-md bg-surface-container-low px-2 py-1.5"><p className="text-outline">{label}</p><p className="font-bold text-white">{value}</p></div>;
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
