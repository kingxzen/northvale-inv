"use client";

import { ChangeEvent, useRef, useState, useMemo } from "react";
import Link from "next/link";
import { Download, Filter, PackageSearch, TrendingUp, History, Upload, FileDown, ShieldAlert } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExpensesChart } from "@/components/reports/expenses-chart";
import { useApp } from "@/context/app-context";
import { formatMoney } from "@/lib/utils";
import {
  getMasterBoms,
  getPackingTemplates,
  getProductBomAssignments,
  getQuickOrders
} from "@/lib/operations-store";

type BackupPreview = {
  inventory: number;
  boms: number;
  packingTemplates: number;
  production: number;
  quickOrders: number;
  transactions: number;
  logs: number;
};

type FullBackup = {
  app: "NORTHVALE INV";
  type: "full-backup";
  version: number;
  appVersion: string;
  exportedAt: string;
  appSettings: {
    deploymentMode: "private-internal-beta";
    safeSupabaseModules: string[];
    localBackupBasedModules: string[];
    warning: string;
  };
  data: {
    inventoryItems: unknown[];
    products: unknown[];
    productBomLines: unknown[];
    bomLibrary: unknown[];
    productBomAssignments: unknown[];
    packingTemplates: unknown[];
    productionPlans: unknown[];
    quickOrders: unknown[];
    stockTransactions: unknown[];
    activityLogs: unknown[];
    analyticsSource: Record<string, unknown>;
  };
};

export default function ReportsPage() {
  const { inventoryItems, productionJobs, stockTransactions, products, productBomLines, activityLogs, inventoryError } = useApp();
  const [activeFilter, setActiveFilter] = useState<"week" | "month">("week");
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [backupPreview, setBackupPreview] = useState<BackupPreview | null>(null);
  const [pendingBackup, setPendingBackup] = useState<FullBackup | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const lowStock = useMemo(() => 
    inventoryItems.filter((item) => !item.isArchived && (item.status === "critical" || item.status === "low")),
    [inventoryItems]
  );

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2000);
  };

  const buildFullBackup = (): FullBackup => {
    const quickOrders = getQuickOrders();
    return {
      app: "NORTHVALE INV",
      type: "full-backup",
      version: 1,
      appVersion: "0.1.0-private-beta",
      exportedAt: new Date().toISOString(),
      appSettings: {
        deploymentMode: "private-internal-beta",
        safeSupabaseModules: ["Inventory", "BOM Library", "Packing Templates"],
        localBackupBasedModules: ["Production Plans", "Quick Orders", "Stock Transactions", "Activity Logs", "Analytics source data"],
        warning: "Some modules are still local/backup-based. Download Full Backup before every update or deploy."
      },
      data: {
        inventoryItems,
        products,
        productBomLines,
        bomLibrary: getMasterBoms(),
        productBomAssignments: getProductBomAssignments(),
        packingTemplates: getPackingTemplates(),
        productionPlans: productionJobs,
        quickOrders,
        stockTransactions,
        activityLogs,
        analyticsSource: {
          stockTransactions,
          productionPlans: productionJobs,
          quickOrders,
          productBomLines
        }
      }
    };
  };

  const downloadTextFile = (filename: string, content: string, type = "application/json") => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const downloadFullBackup = () => {
    downloadTextFile(
      `northvale-full-backup-${new Date().toISOString().slice(0, 10)}.json`,
      JSON.stringify(buildFullBackup(), null, 2)
    );
    triggerToast("Full backup downloaded.");
  };

  const csvEscape = (value: unknown) => {
    const text = value === undefined || value === null ? "" : String(value);
    return `"${text.replace(/"/g, '""')}"`;
  };

  const downloadCsv = (filename: string, headers: string[], rows: unknown[][]) => {
    const csv = [headers, ...rows].map((row) => row.map(csvEscape).join(",")).join("\n");
    downloadTextFile(filename, csv, "text/csv");
    triggerToast("CSV exported.");
  };

  const previewBackup = (backup: FullBackup): BackupPreview => ({
    inventory: backup.data.inventoryItems?.length ?? 0,
    boms: backup.data.bomLibrary?.length ?? 0,
    packingTemplates: backup.data.packingTemplates?.length ?? 0,
    production: backup.data.productionPlans?.length ?? 0,
    quickOrders: backup.data.quickOrders?.length ?? 0,
    transactions: backup.data.stockTransactions?.length ?? 0,
    logs: backup.data.activityLogs?.length ?? 0
  });

  const handleImportFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    if (!file.name.endsWith(".json") && file.type !== "application/json") {
      triggerToast("Import accepts JSON backup files only.");
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const parsed = JSON.parse(String(reader.result)) as FullBackup;
        if (parsed.app !== "NORTHVALE INV" || parsed.type !== "full-backup" || !parsed.data) {
          triggerToast("Invalid NORTHVALE INV backup file.");
          return;
        }
        setPendingBackup(parsed);
        setBackupPreview(previewBackup(parsed));
      } catch {
        triggerToast("Backup file could not be read.");
      }
    };
    reader.readAsText(file);
  };

  const confirmImport = () => {
    if (!pendingBackup) return;
    if (inventoryError?.includes("PGRST205") || inventoryError?.includes("inventory_items")) {
      triggerToast("Supabase table missing. Apply migrations before importing.");
      return;
    }
    triggerToast("Import restore waits for Supabase tables. No records changed.");
  };

  return (
    <AppShell>
      {/* Toast Banner */}
      {toastMessage && (
        <div className="fixed top-10 left-1/2 -translate-x-1/2 z-50 bg-secondary-container text-on-secondary-container border border-outline-variant/30 font-semibold px-6 py-3 rounded-full shadow-glow animate-bounce">
          {toastMessage}
        </div>
      )}

      {/* Title Header with Nav to Activity Log */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <h2 className="text-headline-md font-bold text-white">Reports</h2>
          <p className="text-body-sm text-on-surface-variant mt-0.5">Operational insights and inventory analytics</p>
        </div>
        <Button variant="ghost" size="sm" asChild className="flex items-center gap-1.5 border border-outline-variant/30 hover:bg-surface-container-high/40">
          <Link href="/reports/activity">
            <History className="h-4 w-4" />
            Activity Log
          </Link>
        </Button>
      </div>

      <div className="mt-5 flex gap-2">
        <Button 
          size="sm" 
          variant={activeFilter === "week" ? "default" : "ghost"}
          onClick={() => setActiveFilter("week")}
        >
          This Week
        </Button>
        <Button 
          size="sm" 
          variant={activeFilter === "month" ? "default" : "ghost"}
          onClick={() => setActiveFilter("month")}
        >
          Month
        </Button>
      </div>

      <section className="mt-6 grid gap-4 lg:grid-cols-3">
        <Card className="p-5 lg:col-span-2">
          <div className="flex items-center justify-between">
            <p className="text-label-md text-on-surface font-semibold">Weekly estimate</p>
            <TrendingUp className="h-5 w-5 text-primary" />
          </div>
          <p className="mt-8 text-headline-md font-bold text-white">
            {activeFilter === "week" ? formatMoney(18450) : formatMoney(78900)}
          </p>
          <Badge tone="good" className="mt-2">+12.4%</Badge>
          <ExpensesChart />
        </Card>
        <div className="grid gap-4">
          <MiniReport label="Raw" value={activeFilter === "week" ? 10800 : 45600} />
          <MiniReport label="Packaging" value={activeFilter === "week" ? 4200 : 19400} />
          <MiniReport label="Labor" value={activeFilter === "week" ? 3450 : 13900} />
        </div>
      </section>

      <Card className="mt-6 p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-label-md uppercase font-bold text-on-surface">Low stock report</h3>
          <Badge tone="critical">{lowStock.length} alerts</Badge>
        </div>
        <div className="space-y-4">
          {lowStock.length > 0 ? (
            lowStock.map((item) => (
              <div key={item.id} className="flex items-center justify-between border-b border-outline-variant/40 pb-4 last:border-0 last:pb-0">
                <div className="flex items-center gap-3">
                  <PackageSearch className="h-5 w-5 text-primary" />
                  <div>
                    <p className="text-body-sm font-semibold text-white">{item.name}</p>
                    <p className="text-label-sm text-error">Remaining: {item.quantityOnHand} {item.unit}</p>
                  </div>
                </div>
                <Button 
                  aria-label={`Create reorder task for ${item.name}`} 
                  size="icon" 
                  variant="ghost"
                  onClick={() => triggerToast("Reorder details exported. Download coming soon!")}
                >
                  <Download className="h-4 w-4" />
                </Button>
              </div>
            ))
          ) : (
            <div className="p-4 text-center text-body-sm text-on-surface-variant italic">
              All active inventory items have sufficient stock.
            </div>
          )}
        </div>
      </Card>

      <Card className="mt-6 overflow-hidden">
        <div className="flex items-center justify-between p-5">
          <h3 className="text-label-md uppercase font-bold text-on-surface">Production history</h3>
          <Button 
            aria-label="Filter production history" 
            size="icon" 
            variant="ghost"
            onClick={() => triggerToast("Filters are coming soon!")}
          >
            <Filter className="h-5 w-5" />
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[560px] text-left text-body-sm">
            <thead className="text-label-sm text-on-surface-variant border-b border-outline-variant/40">
              <tr>
                <th className="px-5 py-3">Batch ID</th>
                <th className="px-5 py-3">Product line</th>
                <th className="px-5 py-3">Qty</th>
                <th className="px-5 py-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {productionJobs.map((job) => {
                const p = products.find(prod => prod.id === job.productId);
                return (
                  <tr key={job.id} className="border-t border-outline-variant/40 hover:bg-surface-container-high/20 transition">
                    <td className="px-5 py-4 font-mono text-primary font-bold">#{job.jobNumber}</td>
                    <td className="px-5 py-4 text-white font-medium">{p ? p.name : "Unknown Product"}</td>
                    <td className="px-5 py-4 text-on-surface-variant font-medium">{job.plannedBatchQty}</td>
                    <td className="px-5 py-4"><Badge>{job.status}</Badge></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </Card>

      <Card className="mt-6 p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <h3 className="text-label-md uppercase font-bold text-on-surface">Backup & Export</h3>
            <p className="mt-1 text-[12.5px] leading-5 text-on-surface-variant">
              Some modules are still local/backup-based. Download Full Backup before every update or deploy.
            </p>
          </div>
          <ShieldAlert className="h-5 w-5 shrink-0 text-warning" />
        </div>
        {inventoryError && (
          <div className="mt-3 rounded-md border border-error/25 bg-error/10 px-3 py-2 text-[12px] leading-5 text-error">
            Supabase table missing. Apply migrations before importing. Required: 0001_initial_schema.sql and 0002_persistence_expansion.sql.
          </div>
        )}
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button size="sm" className="h-9 gap-1 px-1.5 text-[11px]" onClick={downloadFullBackup}>
            <Download className="h-3.5 w-3.5" /> Download Full Backup
          </Button>
          <Button size="sm" variant="ghost" className="h-9 gap-1 border border-outline-variant/25 px-1.5 text-[11px]" onClick={() => fileInputRef.current?.click()}>
            <Upload className="h-3.5 w-3.5" /> Import Backup
          </Button>
          <Button size="sm" variant="ghost" className="h-9 gap-1 border border-outline-variant/25 px-1.5 text-[11px]" onClick={() => downloadCsv("northvale-inventory.csv", ["sku", "name", "category", "quantity", "unit", "unit_cost", "status"], inventoryItems.map(item => [item.sku, item.name, item.category, item.quantityOnHand, item.unit, item.unitCost ?? "", item.status]))}>
            <FileDown className="h-3.5 w-3.5" /> Export Inventory CSV
          </Button>
          <Button size="sm" variant="ghost" className="h-9 gap-1 border border-outline-variant/25 px-1.5 text-[11px]" onClick={() => downloadCsv("northvale-transactions.csv", ["id", "item_id", "type", "quantity", "unit", "reference", "created_at"], stockTransactions.map(txn => [txn.id, txn.inventoryItemId, txn.type, txn.quantity, txn.unit, txn.reference ?? "", txn.createdAt]))}>
            <FileDown className="h-3.5 w-3.5" /> Export Transactions CSV
          </Button>
          <Button size="sm" variant="ghost" className="h-9 gap-1 border border-outline-variant/25 px-1.5 text-[11px]" onClick={() => downloadCsv("northvale-quick-orders.csv", ["id", "platform", "reference", "status", "prepared_by", "processed_at", "completed_at"], getQuickOrders().map(order => [order.id, order.platform, order.referenceNo, order.status, order.preparedBy, order.processedAt ?? "", order.completedAt ?? ""]))}>
            <FileDown className="h-3.5 w-3.5" /> Export Quick Orders CSV
          </Button>
          <Button size="sm" variant="ghost" className="h-9 gap-1 border border-outline-variant/25 px-1.5 text-[11px]" onClick={() => downloadCsv("northvale-production.csv", ["id", "job_number", "status", "planned_batch_qty", "due_date", "reference"], productionJobs.map(job => [job.id, job.jobNumber, job.status, job.plannedBatchQty, job.dueDate ?? "", job.referenceNote ?? ""]))}>
            <FileDown className="h-3.5 w-3.5" /> Export Production CSV
          </Button>
        </div>
        <input ref={fileInputRef} type="file" accept="application/json,.json" className="hidden" onChange={handleImportFile} />
        {backupPreview && (
          <div className="mt-3 rounded-lg border border-outline-variant/25 bg-surface-container-low p-3">
            <p className="text-[12px] font-bold uppercase text-outline">Import preview</p>
            <div className="mt-2 grid grid-cols-2 gap-1.5 text-[12px] text-on-surface-variant">
              <span>Inventory: {backupPreview.inventory}</span>
              <span>BOMs: {backupPreview.boms}</span>
              <span>Packing: {backupPreview.packingTemplates}</span>
              <span>Production: {backupPreview.production}</span>
              <span>Quick Orders: {backupPreview.quickOrders}</span>
              <span>Transactions: {backupPreview.transactions}</span>
              <span>Logs: {backupPreview.logs}</span>
            </div>
            <Button size="sm" className="mt-3 h-9 w-full" onClick={confirmImport}>Confirm safe import</Button>
          </div>
        )}
        <div className="mt-3 rounded-md bg-surface-container-low px-3 py-2 text-[11.5px] leading-5 text-on-surface-variant">
          Do not run reset, seed, drop, truncate, delete all, or localStorage.clear.
        </div>
      </Card>

      <Card className="mt-6 p-5">
        <h3 className="text-label-md uppercase font-bold text-on-surface mb-4">Stock movement</h3>
        <div className="space-y-3">
          {stockTransactions.slice(0, 8).map((transaction) => {
            const item = inventoryItems.find(i => i.id === transaction.inventoryItemId);
            return (
              <p key={transaction.id} className="text-body-sm text-on-surface-variant border-b border-outline-variant/20 pb-2 last:border-0 last:pb-0">
                <span className="capitalize font-semibold text-white">{transaction.type.replace("_", " ")}</span>: {transaction.quantity} {transaction.unit} for <span className="text-white">{item ? item.name : "Unknown Item"}</span>
              </p>
            );
          })}
        </div>
      </Card>
    </AppShell>
  );
}

function MiniReport({ label, value }: Readonly<{ label: string; value: number }>) {
  return (
    <Card className="p-5 flex flex-col justify-between bg-surface-container border border-outline-variant/25">
      <p className="text-label-md text-on-surface-variant font-medium">{label}</p>
      <p className="mt-4 text-headline-md font-bold text-white">{formatMoney(value)}</p>
      <div className="mt-4 h-1.5 rounded-full bg-surface-container-high">
        <div className="h-full w-3/5 rounded-full bg-primary" />
      </div>
    </Card>
  );
}
