"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { PageBackButton } from "@/components/layout/page-back-button";
import { Card } from "@/components/ui/card";
import { useApp } from "@/context/app-context";
import { cn, formatMoney } from "@/lib/utils";
import type { ProductionJob } from "@/types/domain";

type RangeMode = "Weekly" | "Monthly" | "Custom";

type QuickOrder = {
  id: string;
  status: string;
  platform: string;
  referenceNo: string;
  lines: { quantity: number }[];
  materials: { required: number; name: string }[];
  createdAt: string;
  releasedAt?: string;
  datePacked?: string;
  packedAt?: string;
  processedAt?: string;
  completedAt?: string;
  inventoryDeducted?: boolean;
};

type ExpenseRow = {
  name: string;
  amount: number;
};

function toDateInputValue(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getCurrentWeekRange() {
  const now = new Date();
  const day = now.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  const start = new Date(now);
  start.setDate(now.getDate() + mondayOffset);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  return { start: toDateInputValue(start), end: toDateInputValue(end) };
}

function getCurrentMonthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return { start: toDateInputValue(start), end: toDateInputValue(end) };
}

function parseRangeBoundary(value: string, boundary: "start" | "end") {
  if (!value) return null;
  const date = new Date(`${value}T${boundary === "start" ? "00:00:00" : "23:59:59"}`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function isInRange(value: string | undefined, startDate: Date | null, endDate: Date | null) {
  if (!value || !startDate || !endDate) return false;
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return false;
  return time >= startDate.getTime() && time <= endDate.getTime();
}

function getQuickOrderDate(order: QuickOrder) {
  return order.processedAt ?? order.releasedAt ?? order.datePacked ?? order.packedAt ?? order.completedAt ?? order.createdAt;
}

function getProductionCostDate(job: ProductionJob) {
  return job.completedAt ?? job.startedAt;
}

export default function AnalyticsPage() {
  const { inventoryItems, stockTransactions, productBomLines, productionJobs } = useApp();
  const initialRange = getCurrentWeekRange();
  const [range, setRange] = useState<RangeMode>("Weekly");
  const [startDate, setStartDate] = useState(initialRange.start);
  const [endDate, setEndDate] = useState(initialRange.end);
  const [quickOrders, setQuickOrders] = useState<QuickOrder[]>([]);

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem("prodstock_quick_orders") ?? "[]");
      setQuickOrders(Array.isArray(stored) ? stored : []);
    } catch {
      setQuickOrders([]);
    }
  }, []);

  const setPresetRange = (mode: Exclude<RangeMode, "Custom">) => {
    const nextRange = mode === "Weekly" ? getCurrentWeekRange() : getCurrentMonthRange();
    setRange(mode);
    setStartDate(nextRange.start);
    setEndDate(nextRange.end);
  };

  const updateStartDate = (value: string) => {
    setRange("Custom");
    setStartDate(value);
  };

  const updateEndDate = (value: string) => {
    setRange("Custom");
    setEndDate(value);
  };

  const analytics = useMemo(() => {
    const rangeStart = parseRangeBoundary(startDate, "start");
    const rangeEnd = parseRangeBoundary(endDate, "end");
    const itemById = new Map(inventoryItems.map(item => [item.id, item]));
    const expenses = new Map<string, number>();

    const addExpense = (name: string, amount: number) => {
      if (amount <= 0) return;
      expenses.set(name, (expenses.get(name) ?? 0) + amount);
    };

    let rawMaterialsUsed = 0;
    let productionPackagingUsed = 0;
    let ecommercePackingCost = 0;
    let manpowerCost = 0;
    let otherCosts = 0;

    stockTransactions
      .filter(txn => isInRange(txn.createdAt, rangeStart, rangeEnd))
      .filter(txn => txn.type === "production_release" || txn.type === "production_consume")
      .forEach(txn => {
        const item = itemById.get(txn.inventoryItemId);
        const amount = txn.quantity * (item?.unitCost ?? 0);

        if (item?.category === "raw") {
          rawMaterialsUsed += amount;
          addExpense(item.name, amount);
        }

        if (item?.category === "packaging") {
          productionPackagingUsed += amount;
          addExpense(item.name, amount);
        }
      });

    stockTransactions
      .filter(txn => isInRange(txn.createdAt, rangeStart, rangeEnd))
      .filter(txn => txn.type === "quick_order_packing_material_out")
      .forEach(txn => {
        const item = itemById.get(txn.inventoryItemId);
        if (item?.category !== "packaging") return;
        const amount = txn.quantity * (item.unitCost ?? 0);
        ecommercePackingCost += amount;
        addExpense(item.name, amount);
      });

    const releasedOrders = quickOrders.filter(order => {
      const isReleased = order.status === "released" || order.status === "packed" || order.status === "processed" || order.status === "completed";
      return isReleased && isInRange(getQuickOrderDate(order), rangeStart, rangeEnd);
    });

    const quickOrderCount = releasedOrders.length;
    const finishedGoodsReleased = releasedOrders.reduce((sum, order) => (
      sum + order.lines.reduce((lineSum, line) => lineSum + Number(line.quantity || 0), 0)
    ), 0);
    const platformBreakdown = Array.from(
      releasedOrders.reduce((platforms, order) => {
        const platform = order.platform || "Manual";
        platforms.set(platform, (platforms.get(platform) ?? 0) + 1);
        return platforms;
      }, new Map<string, number>())
    ).sort((a, b) => b[1] - a[1]);

    releasedOrders.filter(order => !order.inventoryDeducted).forEach(order => {
      order.materials.forEach(material => {
        const packagingItem = inventoryItems.find(item => {
          if (item.category !== "packaging" || item.isArchived) return false;
          const text = `${item.name} ${item.sku}`.toLowerCase();
          return material.name.toLowerCase().split(" ").some(token => text.includes(token));
        });
        const amount = material.required * (packagingItem?.unitCost ?? 0);
        ecommercePackingCost += amount;
        addExpense(material.name, amount);
      });
    });

    productionJobs
      .filter(job => isInRange(getProductionCostDate(job), rangeStart, rangeEnd))
      .forEach(job => {
        const productLines = job.productLines && job.productLines.length > 0
          ? job.productLines
          : [{ productId: job.productId, plannedBatchQty: job.plannedBatchQty }];

        productLines.forEach(line => {
          productBomLines
            .filter(bom => bom.productId === line.productId)
            .forEach(bom => {
              const amount = (bom.costOverride ?? 0) * bom.quantityPerBatch * line.plannedBatchQty;
              if (bom.lineType === "manpower") {
                manpowerCost += amount;
                addExpense("Manpower", amount);
              }
              if (bom.lineType === "other_cost") {
                otherCosts += amount;
                addExpense("Other costs", amount);
              }
            });
        });
      });

    const packagingMaterialsUsed = productionPackagingUsed + ecommercePackingCost;
    const totalExpenses = rawMaterialsUsed + packagingMaterialsUsed + manpowerCost + otherCosts;
    const topExpenses = Array.from(expenses.entries())
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);

    return {
      finishedGoodsReleased,
      quickOrderCount,
      platformBreakdown,
      rawMaterialsUsed,
      packagingMaterialsUsed,
      manpowerCost,
      totalExpenses,
      topExpenses
    };
  }, [endDate, inventoryItems, productBomLines, productionJobs, quickOrders, startDate, stockTransactions]);

  return (
    <AppShell>
      <PageBackButton fallbackHref="/inventory" />
      <p className="text-label-sm uppercase text-primary">Cost center</p>
      <h2 className="mt-1 text-[32px] font-bold leading-tight text-white">Analytics</h2>

      <div className="mt-3 grid grid-cols-2 gap-1.5">
        {(["Weekly", "Monthly"] as const).map(item => (
          <button
            key={item}
            type="button"
            onClick={() => setPresetRange(item)}
            className={cn(
              "rounded-full border px-3 py-2 text-[12px] font-semibold",
              range === item
                ? "border-primary bg-primary text-on-primary"
                : "border-outline-variant/30 bg-surface-container text-on-surface-variant"
            )}
          >
            {item}
          </button>
        ))}
      </div>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <input
          aria-label="Start date"
          type="date"
          value={startDate}
          onChange={event => updateStartDate(event.target.value)}
          onInput={event => updateStartDate(event.currentTarget.value)}
          className="h-10 rounded-md border border-outline bg-surface-container px-2 text-[12.5px] text-white focus:outline-none"
        />
        <input
          aria-label="End date"
          type="date"
          value={endDate}
          onChange={event => updateEndDate(event.target.value)}
          onInput={event => updateEndDate(event.currentTarget.value)}
          className="h-10 rounded-md border border-outline bg-surface-container px-2 text-[12.5px] text-white focus:outline-none"
        />
      </div>

      <section className="mt-3 grid grid-cols-2 gap-2">
        <SummaryCard label="Finished goods released" value={analytics.finishedGoodsReleased.toLocaleString()} />
        <SummaryCard label="Quick orders" value={analytics.quickOrderCount.toLocaleString()} />
        <SummaryCard label="Raw materials used" value={formatMoney(analytics.rawMaterialsUsed)} />
        <SummaryCard label="Packaging used" value={formatMoney(analytics.packagingMaterialsUsed)} />
        <SummaryCard label="Manpower cost" value={formatMoney(analytics.manpowerCost)} />
      </section>
      <Card className="mt-2 rounded-lg border border-primary/20 bg-primary/10 p-3">
        <p className="text-[11px] uppercase text-primary">Total expenses</p>
        <p className="mt-1 text-[20px] font-bold text-white">{formatMoney(analytics.totalExpenses)}</p>
      </Card>

      <Card className="mt-2 rounded-lg border border-outline-variant/30 bg-surface-container p-3">
        <p className="text-[11px] uppercase text-on-surface-variant">Platform breakdown</p>
        <p className="mt-1 text-[13px] font-semibold text-white">
          {analytics.platformBreakdown.length > 0
            ? analytics.platformBreakdown.map(([platform, count]) => `${platform} ${count}`).join(" • ")
            : "No quick orders in this range"}
        </p>
      </Card>

      <section className="mt-4 pb-16">
        <h3 className="text-[15px] font-semibold text-white">Top 5 Expenses</h3>
        <div className="mt-2 space-y-2">
          {analytics.topExpenses.length > 0 ? (
            analytics.topExpenses.map(expense => (
              <ExpenseItem key={expense.name} expense={expense} total={analytics.totalExpenses} />
            ))
          ) : (
            <Card className="rounded-lg border border-outline-variant/30 bg-surface-container p-3">
              <p className="text-[13px] font-semibold text-on-surface-variant">No expenses in this date range</p>
            </Card>
          )}
        </div>
      </section>
    </AppShell>
  );
}

function SummaryCard({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <Card className="rounded-lg border border-outline-variant/30 bg-surface-container p-3">
      <p className="text-[11px] leading-snug text-on-surface-variant">{label}</p>
      <p className="mt-1 truncate text-[15px] font-bold text-white">{value}</p>
    </Card>
  );
}

function ExpenseItem({ expense, total }: Readonly<{ expense: ExpenseRow; total: number }>) {
  const pct = total > 0 ? Math.round((expense.amount / total) * 100) : 0;

  return (
    <Card className="rounded-lg border border-outline-variant/30 bg-surface-container p-3">
      <div className="flex items-center justify-between gap-2">
        <p className="min-w-0 truncate text-[13.5px] font-semibold text-white">{expense.name}</p>
        <p className="shrink-0 text-[12.5px] font-bold text-white">{formatMoney(expense.amount)} {"\u2022"} {pct}%</p>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-container-low">
        <div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, pct)}%` }} />
      </div>
    </Card>
  );
}
