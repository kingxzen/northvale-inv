"use client";

import { ChangeEvent, useRef, useState, useMemo } from "react";
import Link from "next/link";
import { Database, Download, Filter, PackageSearch, TrendingUp, History, Upload, FileDown, ShieldAlert } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExpensesChart } from "@/components/reports/expenses-chart";
import { useApp, type BackupRestorePayload, type BackupRestoreSummary, type RestoreMode } from "@/context/app-context";
import { formatMoney } from "@/lib/utils";
import {
  getMasterBoms,
  getPackingTemplates,
  getProductBomAssignments,
  getQuickOrders
} from "@/lib/operations-store";
import { createClient } from "@/lib/supabase/browser";
import { getSupabaseUrl } from "@/lib/supabase/config";
import { isSupabaseConfigured } from "@/lib/supabase/repositories/inventory";
import {
  listMasterBomsFromSupabase,
  listPackingTemplatesFromSupabase
} from "@/lib/supabase/repositories/bom-packing";

type BackupPreview = {
  version: number;
  exportedAt: string;
  inventory: number;
  products: number;
  boms: number;
  bomLines: number;
  productBomAssignments: number;
  packingTemplates: number;
  packingLines: number;
  production: number;
  quickOrders: number;
  transactions: number;
  logs: number;
  result: "RESTORE_READY" | "RESTORE_RISK";
  warnings: string[];
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

type BackupFileShape = Partial<Omit<FullBackup, "app" | "type">> & {
  app?: string;
  type?: string;
  items?: unknown[];
  data?: Partial<FullBackup["data"]>;
};

type SyncCheckState = {
  status: "idle" | "checking" | "connected" | "failed";
  message: string;
};

const SYNC_TABLE_LABELS: Record<string, string> = {
  inventory_items: "Inventory",
  master_boms: "BOMs",
  master_bom_lines: "BOM lines",
  packing_templates: "Packing Templates",
  packing_template_lines: "Packing Template lines"
};

export default function ReportsPage() {
  const { inventoryItems, productionJobs, stockTransactions, products, productBomLines, activityLogs, inventoryError, freshStartReset, restoreFullBackup } = useApp();
  const [activeFilter, setActiveFilter] = useState<"week" | "month">("week");
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [backupPreview, setBackupPreview] = useState<BackupPreview | null>(null);
  const [pendingBackup, setPendingBackup] = useState<FullBackup | null>(null);
  const [backupDownloaded, setBackupDownloaded] = useState(false);
  const [freshStartText, setFreshStartText] = useState("");
  const [freshStartBusy, setFreshStartBusy] = useState(false);
  const [freshStartResult, setFreshStartResult] = useState<string | null>(null);
  const [restoreMode, setRestoreMode] = useState<RestoreMode>("safe-merge");
  const [restoreBusy, setRestoreBusy] = useState(false);
  const [restoreSummary, setRestoreSummary] = useState<BackupRestoreSummary | null>(null);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [syncCheck, setSyncCheck] = useState<SyncCheckState>({
    status: "idle",
    message: "Not checked yet."
  });
  const [lastImportStatus, setLastImportStatus] = useState("No import this session.");
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const supabaseConnected = isSupabaseConfigured();
  const appEnvironment = typeof window !== "undefined" && window.location.hostname.includes("localhost") ? "Local" : "Production";
  const projectRef = getSupabaseProjectRef();
  const dataSource = supabaseConnected ? "Supabase" : "Local only";

  const lowStock = useMemo(() => 
    inventoryItems.filter((item) => !item.isArchived && (item.status === "critical" || item.status === "low")),
    [inventoryItems]
  );

  const fullRestoreAllowed = useMemo(() => {
    const activeInventory = inventoryItems.filter((item) => !item.isArchived).length;
    return Boolean(freshStartResult)
      || (activeInventory === 0 && products.length === 0 && productBomLines.length === 0 && productionJobs.length === 0 && stockTransactions.length === 0 && activityLogs.length <= 1);
  }, [activityLogs.length, freshStartResult, inventoryItems, productBomLines.length, productionJobs.length, products.length, stockTransactions.length]);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2000);
  };

  const expenseSummary = useMemo(() => {
    const now = new Date();
    const start = activeFilter === "week"
      ? new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7))
      : new Date(now.getFullYear(), now.getMonth(), 1);
    start.setHours(0, 0, 0, 0);
    const end = activeFilter === "week"
      ? new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6, 23, 59, 59, 999)
      : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const chartData = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((day) => ({ day, cost: 0 }));
    const totals = stockTransactions.reduce((acc, txn) => {
      const created = new Date(txn.createdAt);
      if (created < start || created > end) return acc;
      const item = inventoryItems.find((entry) => entry.id === txn.inventoryItemId);
      const value = Number(txn.quantity || 0) * (item?.unitCost ?? 0);
      if (item?.category === "raw") acc.raw += value;
      if (item?.category === "packaging") acc.packaging += value;
      acc.total += value;
      const dayIndex = Math.max(0, Math.min(6, (created.getDay() + 6) % 7));
      chartData[dayIndex].cost += value;
      return acc;
    }, { raw: 0, packaging: 0, labor: 0, total: 0 });

    return { ...totals, chartData };
  }, [activeFilter, inventoryItems, stockTransactions]);

  const buildFullBackup = async (): Promise<FullBackup> => {
    const quickOrders = getQuickOrders();
    const bomLibrary = supabaseConnected ? await listMasterBomsFromSupabase() : getMasterBoms();
    const packingTemplates = supabaseConnected ? await listPackingTemplatesFromSupabase() : getPackingTemplates();

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
        bomLibrary,
        productBomAssignments: getProductBomAssignments(),
        packingTemplates,
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

  const downloadFullBackup = async () => {
    try {
      const backup = await buildFullBackup();
      downloadTextFile(
        `northvale-full-backup-${new Date().toISOString().slice(0, 10)}.json`,
        JSON.stringify(backup, null, 2)
      );
      setBackupDownloaded(true);
      triggerToast("Full backup downloaded.");
    } catch (error) {
      triggerToast(error instanceof Error ? error.message : "Full backup failed.");
    }
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

  const previewBackup = (backup: FullBackup): BackupPreview => {
    const warnings: string[] = [];
    const data = backup.data;
    if (!Array.isArray(data.inventoryItems)) warnings.push("Inventory items are missing.");
    if (!Array.isArray(data.bomLibrary)) warnings.push("BOM Library is missing.");
    if (!Array.isArray(data.packingTemplates)) warnings.push("Packing Templates are missing.");
    if (!Array.isArray(data.productionPlans)) warnings.push("Production Plans are missing.");
    if (!Array.isArray(data.quickOrders)) warnings.push("Quick Orders are missing.");
    if (!Array.isArray(data.stockTransactions)) warnings.push("Stock Transactions are missing.");
    if (!Array.isArray(data.activityLogs)) warnings.push("Activity Logs are missing.");

    const boms = data.bomLibrary ?? [];
    const packing = data.packingTemplates ?? [];

    return {
      version: backup.version,
      exportedAt: backup.exportedAt,
      inventory: data.inventoryItems?.length ?? 0,
      products: data.products?.length ?? 0,
      boms: boms.length,
      bomLines: boms.reduce<number>((sum, bom) => sum + (Array.isArray((bom as { lines?: unknown[] }).lines) ? (bom as { lines: unknown[] }).lines.length : 0), 0),
      productBomAssignments: data.productBomAssignments?.length ?? 0,
      packingTemplates: packing.length,
      packingLines: packing.reduce<number>((sum, template) => sum + (Array.isArray((template as { materials?: unknown[] }).materials) ? (template as { materials: unknown[] }).materials.length : 0), 0),
      production: data.productionPlans?.length ?? 0,
      quickOrders: data.quickOrders?.length ?? 0,
      transactions: data.stockTransactions?.length ?? 0,
      logs: data.activityLogs?.length ?? 0,
      result: warnings.length > 0 ? "RESTORE_RISK" : "RESTORE_READY",
      warnings
    };
  };

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
        const parsed = JSON.parse(String(reader.result)) as unknown;
        const normalized = normalizeBackupFile(parsed);
        if (!normalized) {
          triggerToast("Invalid NORTHVALE INV backup file.");
          return;
        }
        setPendingBackup(normalized);
        setBackupPreview(previewBackup(normalized));
        setRestoreError(null);
        setRestoreSummary(null);
        setLastImportStatus("Backup preview loaded. Restore not confirmed yet.");
      } catch {
        setLastImportStatus("Import failed.");
        triggerToast("Backup file could not be read.");
      }
    };
    reader.readAsText(file);
  };

  const confirmImport = async () => {
    if (!pendingBackup) return;
    if (inventoryError?.includes("PGRST205") || inventoryError?.includes("inventory_items")) {
      triggerToast("Supabase table missing. Apply migrations before importing.");
      return;
    }
    if (restoreMode === "full-after-fresh-start" && !fullRestoreAllowed) {
      triggerToast("Full Restore is only available after Fresh Start Reset.");
      return;
    }

    setRestoreBusy(true);
    try {
      const summary = await restoreFullBackup(pendingBackup as BackupRestorePayload, restoreMode);
      setRestoreSummary(summary);
      setRestoreError(null);
      setFreshStartResult(null);
      const savedTarget = supabaseConnected ? "Import saved to Supabase" : "Import saved locally only";
      setLastImportStatus(savedTarget);
      triggerToast(savedTarget);
    } catch (error) {
      setRestoreError(formatRestoreError(error));
      setLastImportStatus("Import failed.");
      triggerToast("Backup restore failed. See error details.");
    } finally {
      setRestoreBusy(false);
    }
  };

  const runFreshStart = async () => {
    if (!backupDownloaded) {
      triggerToast("Download Full Backup before Fresh Start.");
      return;
    }
    if (freshStartText !== "FRESH START") {
      triggerToast("Type FRESH START to confirm.");
      return;
    }

    setFreshStartBusy(true);
    try {
      await freshStartReset();
      setFreshStartResult("Fresh Start complete. App data is empty and ready for backup restore.");
      setRestoreMode("full-after-fresh-start");
      setFreshStartText("");
      triggerToast("Fresh Start complete. App is empty.");
    } catch (error) {
      triggerToast(error instanceof Error ? error.message : "Fresh Start failed.");
    } finally {
      setFreshStartBusy(false);
    }
  };

  const runSyncCheck = async () => {
    if (!supabaseConnected) {
      setSyncCheck({
        status: "failed",
        message: "Vercel Supabase env vars are missing. Data is local only and will not sync across devices."
      });
      return;
    }

    setSyncCheck({ status: "checking", message: "Checking shared Supabase tables..." });
    try {
      const supabase = createClient();
      const results = await Promise.all([
        readTableCount(supabase, "inventory_items"),
        readTableCount(supabase, "master_boms"),
        readTableCount(supabase, "master_bom_lines"),
        readTableCount(supabase, "packing_templates"),
        readTableCount(supabase, "packing_template_lines")
      ]);
      const failed = results.find((result) => result.error);
      if (failed) {
        setSyncCheck({
          status: "failed",
          message: `${failed.table}: ${failed.error}`
        });
        return;
      }

      setSyncCheck({
        status: "connected",
        message: results.map((result) => `${SYNC_TABLE_LABELS[result.table] ?? result.table}: ${result.count ?? 0}`).join(" • ")
      });
    } catch (error) {
      setSyncCheck({
        status: "failed",
        message: error instanceof Error ? error.message : "Supabase sync check failed."
      });
    }
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

      <Card className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-primary" />
              <h3 className="text-[13px] font-bold uppercase text-on-surface">Data Sync</h3>
            </div>
            <p className="mt-1 text-[12px] leading-5 text-on-surface-variant">
              Shared modules use Supabase when connected. Local-only data will not appear on other devices.
            </p>
          </div>
          <Badge tone={supabaseConnected ? "good" : "critical"}>{supabaseConnected ? "Connected" : "Local"}</Badge>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 text-[12px] text-on-surface-variant">
          <SyncField label="Data source" value={dataSource} />
          <SyncField label="Environment" value={appEnvironment} />
          <SyncField label="Supabase" value={supabaseConnected ? "Connected" : "Not connected"} />
          <SyncField label="Project" value={projectRef} />
        </div>
        <div className="mt-3 rounded-md border border-outline-variant/20 bg-surface-container-low px-3 py-2 text-[11.5px] leading-5 text-on-surface-variant">
          Last sync/import status: {lastImportStatus}
        </div>
        {lastImportStatus === "Import saved locally only" && (
          <div className="mt-2 rounded-md border border-warning/25 bg-warning/10 px-3 py-2 text-[11.5px] leading-5 text-warning">
            This data will not appear on other devices.
          </div>
        )}
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="mt-3 h-9 w-full border border-outline-variant/25"
          onClick={runSyncCheck}
          disabled={syncCheck.status === "checking"}
        >
          {syncCheck.status === "checking" ? "Checking..." : "Check Live Sync"}
        </Button>
        <p className={syncCheck.status === "failed" ? "mt-2 text-[11.5px] leading-5 text-error" : "mt-2 text-[11.5px] leading-5 text-on-surface-variant"}>
          {syncCheck.message}
        </p>
      </Card>

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
            {formatMoney(expenseSummary.total)}
          </p>
          <Badge tone={expenseSummary.total > 0 ? "good" : "neutral"} className="mt-2">{expenseSummary.total > 0 ? "Live" : "No expenses"}</Badge>
          <ExpensesChart data={expenseSummary.chartData} />
        </Card>
        <div className="grid gap-4">
          <MiniReport label="Raw" value={expenseSummary.raw} />
          <MiniReport label="Packaging" value={expenseSummary.packaging} />
          <MiniReport label="Manpower" value={expenseSummary.labor} />
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
            <div className="flex items-center justify-between gap-2">
              <p className="text-[12px] font-bold uppercase text-outline">Restore Test / Dry Run</p>
              <Badge tone={backupPreview.result === "RESTORE_READY" ? "good" : "critical"}>{backupPreview.result}</Badge>
            </div>
            <p className="mt-1 text-[11.5px] text-on-surface-variant">
              Version {backupPreview.version} • {new Date(backupPreview.exportedAt).toLocaleString()}
            </p>
            <div className="mt-2 grid grid-cols-2 gap-1.5 text-[12px] text-on-surface-variant">
              <span>Inventory: {backupPreview.inventory}</span>
              <span>Products: {backupPreview.products}</span>
              <span>BOMs: {backupPreview.boms}</span>
              <span>BOM lines: {backupPreview.bomLines}</span>
              <span>BOM links: {backupPreview.productBomAssignments}</span>
              <span>Packing: {backupPreview.packingTemplates}</span>
              <span>Packing lines: {backupPreview.packingLines}</span>
              <span>Production: {backupPreview.production}</span>
              <span>Quick Orders: {backupPreview.quickOrders}</span>
              <span>Transactions: {backupPreview.transactions}</span>
              <span>Logs: {backupPreview.logs}</span>
            </div>
            {backupPreview.boms === 0 && backupPreview.packingTemplates === 0 && (
              <div className="mt-2 rounded-md border border-outline-variant/20 bg-surface-container px-2 py-1.5 text-[11.5px] leading-5 text-on-surface-variant">
                This backup contains inventory and operating records, but no BOM Library or Packing Template records.
              </div>
            )}
            {backupPreview.warnings.length > 0 && (
              <div className="mt-2 rounded-md border border-warning/25 bg-warning/10 px-2 py-1.5 text-[11.5px] text-warning">
                {backupPreview.warnings.join(" ")}
              </div>
            )}
            <div className="mt-3 grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setRestoreMode("safe-merge")}
                className={cnRestoreMode(restoreMode === "safe-merge")}
              >
                Safe Merge
              </button>
              <button
                type="button"
                onClick={() => setRestoreMode("full-after-fresh-start")}
                disabled={!fullRestoreAllowed}
                className={cnRestoreMode(restoreMode === "full-after-fresh-start")}
              >
                Full Restore
              </button>
            </div>
            <p className="mt-2 text-[11.5px] leading-5 text-on-surface-variant">
              {restoreMode === "safe-merge"
                ? "Adds missing records only and skips duplicates."
                : fullRestoreAllowed
                  ? "For use after Fresh Start. Restores backup records into the empty app."
                  : "Run Fresh Start Reset before using Full Restore."}
            </p>
            <Button size="sm" className="mt-3 h-9 w-full" onClick={confirmImport} disabled={restoreBusy || backupPreview.result !== "RESTORE_READY"}>
              {restoreBusy ? "Restoring..." : "Confirm Restore"}
            </Button>
            {restoreSummary && (
              <p className="mt-2 text-[11.5px] leading-5 text-success">
                Inventory backup records {restoreSummary.restored.inventory}: added {restoreSummary.inventoryAdded}, reactivated/updated {restoreSummary.inventoryUpdated}, skipped {restoreSummary.inventorySkipped}. BOMs {restoreSummary.restored.boms}, BOM lines {restoreSummary.restored.bomLines}, packing {restoreSummary.restored.packingTemplates}, packing lines {restoreSummary.restored.packingLines}, production {restoreSummary.restored.production}, quick orders {restoreSummary.restored.quickOrders}, transactions {restoreSummary.restored.transactions}, logs {restoreSummary.restored.logs}. Skipped duplicates {restoreSummary.inventorySkipped + restoreSummary.bomPackingSkipped}.
              </p>
            )}
            {restoreError && (
              <p className="mt-2 rounded-md border border-error/25 bg-error/10 px-2 py-1.5 text-[11.5px] leading-5 text-error">
                {restoreError}
              </p>
            )}
          </div>
        )}
        <div className="mt-4 rounded-lg border border-warning/30 bg-warning/10 p-3">
          <div className="flex items-start gap-2">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-warning" />
            <div>
              <p className="text-[12px] font-bold uppercase text-warning">Fresh Start Reset</p>
              <p className="mt-1 text-[12px] leading-5 text-on-surface-variant">
                Manual setup only. Downloads are required first. This clears app business data to an empty state. Restore your saved data using Import Backup.
              </p>
            </div>
          </div>
          <div className="mt-3 grid gap-2">
            <input
              value={freshStartText}
              onChange={(event) => setFreshStartText(event.target.value)}
              placeholder="Type FRESH START"
              className="h-9 rounded-md border border-outline bg-surface-container px-3 text-[12.5px] text-white outline-none placeholder:text-on-surface-variant"
            />
            <Button
              type="button"
              size="sm"
              variant="ghost"
              className="h-9 border border-warning/30 text-warning"
              disabled={!backupDownloaded || freshStartText !== "FRESH START" || freshStartBusy}
              onClick={runFreshStart}
            >
              {freshStartBusy ? "Resetting..." : "Fresh Start Reset"}
            </Button>
          </div>
          <p className="mt-2 text-[11.5px] leading-5 text-on-surface-variant">
            Backup gate: {backupDownloaded ? "Full Backup downloaded in this session." : "Download Full Backup first."}
          </p>
          {freshStartResult && (
            <p className="mt-2 text-[11.5px] leading-5 text-success">
              {freshStartResult}
            </p>
          )}
        </div>
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

function SyncField({ label, value }: Readonly<{ label: string; value: string }>) {
  return (
    <div className="rounded-md border border-outline-variant/20 bg-surface-container-low px-2.5 py-2">
      <p className="text-[10.5px] uppercase text-outline">{label}</p>
      <p className="mt-0.5 truncate text-[12.5px] font-semibold text-on-surface">{value}</p>
    </div>
  );
}

function cnRestoreMode(active: boolean) {
  return [
    "h-9 rounded-md border px-2 text-[11.5px] font-semibold transition",
    active
      ? "border-primary bg-primary text-on-primary"
      : "border-outline-variant/30 bg-surface-container text-on-surface-variant"
  ].join(" ");
}

function normalizeBackupFile(parsed: unknown): FullBackup | null {
  if (!parsed || typeof parsed !== "object") return null;

  const source = parsed as BackupFileShape;
  const data: Partial<FullBackup["data"]> = source.data ?? {};
  const inventoryItems = Array.isArray(data.inventoryItems)
    ? data.inventoryItems
    : Array.isArray(source.items)
      ? source.items
      : Array.isArray(parsed)
        ? parsed
        : [];

  const hasRecognizedShape = source.type === "full-backup"
    || source.type === "inventory-local-backup"
    || source.app === "NORTHVALE INV"
    || inventoryItems.length > 0
    || Object.keys(data).length > 0;

  if (!hasRecognizedShape) return null;

  return {
    app: "NORTHVALE INV",
    type: "full-backup",
    version: typeof source.version === "number" ? source.version : 1,
    appVersion: typeof source.appVersion === "string" ? source.appVersion : "compat-import",
    exportedAt: typeof source.exportedAt === "string" ? source.exportedAt : new Date().toISOString(),
    appSettings: {
      deploymentMode: "private-internal-beta",
      safeSupabaseModules: ["Inventory", "BOM Library", "Packing Templates"],
      localBackupBasedModules: ["Production Plans", "Quick Orders", "Stock Transactions", "Activity Logs", "Analytics source data"],
      warning: "Compatibility import. Missing backup sections are treated as empty."
    },
    data: {
      inventoryItems,
      products: Array.isArray(data.products) ? data.products : [],
      productBomLines: Array.isArray(data.productBomLines) ? data.productBomLines : [],
      bomLibrary: Array.isArray(data.bomLibrary) ? data.bomLibrary : [],
      productBomAssignments: Array.isArray(data.productBomAssignments) ? data.productBomAssignments : [],
      packingTemplates: Array.isArray(data.packingTemplates) ? data.packingTemplates : [],
      productionPlans: Array.isArray(data.productionPlans) ? data.productionPlans : [],
      quickOrders: Array.isArray(data.quickOrders) ? data.quickOrders : [],
      stockTransactions: Array.isArray(data.stockTransactions) ? data.stockTransactions : [],
      activityLogs: Array.isArray(data.activityLogs) ? data.activityLogs : [],
      analyticsSource: data.analyticsSource && typeof data.analyticsSource === "object" && !Array.isArray(data.analyticsSource)
        ? data.analyticsSource as Record<string, unknown>
        : {}
    }
  };
}

function getSupabaseProjectRef() {
  const url = getSupabaseUrl();
  if (!url) return "Not configured";

  try {
    const host = new URL(url).hostname;
    const ref = host.split(".")[0] ?? "";
    if (ref.length <= 10) return ref || "Unknown";
    return `${ref.slice(0, 6)}...${ref.slice(-4)}`;
  } catch {
    return "Invalid URL";
  }
}

async function readTableCount(supabase: ReturnType<typeof createClient>, table: string) {
  const { count, error } = await supabase
    .from(table)
    .select("id", { count: "exact", head: true });

  if (error) {
    return {
      table,
      error: [
        error.code ? `Code ${error.code}` : null,
        error.message,
        error.details ? `Details ${error.details}` : null,
        error.hint ? `Hint ${error.hint}` : null
      ].filter(Boolean).join(". ")
    };
  }

  return { table, count: count ?? 0 };
}

function formatRestoreError(error: unknown) {
  const info = (error as { info?: { table?: string; operation?: string; code?: string; message?: string; details?: string; hint?: string } })?.info;
  if (info) {
    return [
      info.table ? `Table: ${info.table}.` : null,
      info.operation ? `Operation: ${info.operation}.` : null,
      info.code ? `Code: ${info.code}.` : null,
      `Message: ${info.message ?? "Restore failed."}`,
      info.details ? `Details: ${info.details}.` : null,
      info.hint ? `Hint: ${info.hint}.` : null
    ].filter(Boolean).join(" ");
  }

  return error instanceof Error ? error.message : "Backup restore failed.";
}
