"use client";

import Link from "next/link";
import { useState, useMemo } from "react";
import { ArrowDownAZ, Plus, Search, ArrowUpZA, Eye, EyeOff, Boxes, ChartBar, ClipboardList, PackageCheck, Download, Upload } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { InventoryCard } from "@/components/data/inventory-card";
import { useApp } from "@/context/app-context";
import { cn } from "@/lib/utils";
import type { StockStatus } from "@/types/domain";

type StatusFilter = Extract<StockStatus, "critical" | "low"> | "active" | "zero_qty" | null;

export default function InventoryPage() {
  const {
    inventoryItems,
    locations,
    activityLogs,
    duplicateInventoryItem,
    archiveInventoryItem,
    inventorySource,
    inventoryError,
    importLocalInventoryBackup,
    exportInventoryBackup
  } = useApp();

  const [searchQuery, setSearchQuery] = useState("");
  const [activeFilter, setActiveFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>(null);
  const [sortAsc, setSortAsc] = useState<boolean | null>(null); // null = unsorted, true = A-Z, false = Z-A
  const [showArchived, setShowArchived] = useState(false);
  const [importSummary, setImportSummary] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);

  // Active (non-archived) items calculations for counters
  const activeItemsList = useMemo(() => inventoryItems.filter(item => !item.isArchived), [inventoryItems]);
  const critical = useMemo(() => activeItemsList.filter((item) => item.reorderPoint > 0 && item.status === "critical").length, [activeItemsList]);
  const low = useMemo(() => activeItemsList.filter((item) => item.reorderPoint > 0 && item.status === "low").length, [activeItemsList]);
  const zeroQty = useMemo(() => activeItemsList.filter((item) => item.reorderPoint <= 0 && item.quantityOnHand <= 0 && item.category !== "asset").length, [activeItemsList]);

  const filteredAndSortedItems = useMemo(() => {
    // Determine whether to show archived items or only active ones
    let items = statusFilter
      ? activeItemsList
      : inventoryItems.filter(item => showArchived ? item.isArchived : !item.isArchived);

    // Filter by summary status
    if (statusFilter === "critical" || statusFilter === "low") {
      items = items.filter((item) => item.reorderPoint > 0 && item.status === statusFilter);
    }
    if (statusFilter === "zero_qty") {
      items = items.filter((item) => item.reorderPoint <= 0 && item.quantityOnHand <= 0 && item.category !== "asset");
    }
    if (statusFilter === "active") {
      items = items.filter((item) => !item.isArchived);
    }

    // Filter by category chip
    if (activeFilter !== "All") {
      items = items.filter(
        (item) => item.category.toLowerCase() === activeFilter.toLowerCase()
      );
    }

    // Filter by search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      items = items.filter(
        (item) =>
          item.name.toLowerCase().includes(q) ||
          item.sku.toLowerCase().includes(q) ||
          item.category.toLowerCase().includes(q)
      );
    }

    // Sort by name
    if (sortAsc !== null) {
      items.sort((a, b) => {
        const nameA = a.name.toLowerCase();
        const nameB = b.name.toLowerCase();
        if (nameA < nameB) return sortAsc ? -1 : 1;
        if (nameA > nameB) return sortAsc ? 1 : -1;
        return 0;
      });
    }

    return items;
  }, [inventoryItems, activeItemsList, searchQuery, activeFilter, statusFilter, sortAsc, showArchived]);

  const recentUpdates = useMemo(() => {
    const inventoryLogs = activityLogs
      .filter((log) => log.entityType === "inventory_item")
      .map((log) => {
        const itemName = inventoryItems.find((item) => item.id === log.entityId)?.name;
        const action = itemName && !log.action.toLowerCase().includes(itemName.toLowerCase())
          ? `${itemName} ${log.action.charAt(0).toLowerCase()}${log.action.slice(1)}`
          : log.action;

        return {
          action,
          actorName: log.actorName,
          createdAt: log.createdAt
        };
      });

    return inventoryLogs
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 3);
  }, [activityLogs, inventoryItems]);

  const toggleSort = () => {
    if (sortAsc === null) {
      setSortAsc(true); // default to A-Z
    } else if (sortAsc === true) {
      setSortAsc(false); // switch to Z-A
    } else {
      setSortAsc(null); // reset sorting
    }
  };

  const handleExportInventory = () => {
    const backup = exportInventoryBackup();
    const blob = new Blob([backup], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `northvale-inventory-backup-${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const handleImportLocalInventory = async () => {
    if (!window.confirm("Import local inventory backup to Supabase? Existing Supabase items with the same SKU or name will be skipped. Quantities and costs will not be reset.")) return;
    setIsImporting(true);
    setImportSummary(null);
    try {
      const summary = await importLocalInventoryBackup();
      setImportSummary(`Import complete: ${summary.added} added, ${summary.skipped} skipped, ${summary.updated} updated.`);
    } catch {
      setImportSummary("Import failed. Check Supabase connection and try again.");
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <AppShell>
      <p className="text-label-sm uppercase text-primary">Operations hub</p>
      <h2 className="mt-1 text-[40px] font-bold leading-tight text-on-surface">Inventory</h2>

      <div className="mt-3 grid grid-cols-4 gap-1.5">
        <Shortcut href="/bom-library" label="BOM" icon={ClipboardList} />
        <Shortcut href="/packing-templates" label="Packing" icon={PackageCheck} />
        <Shortcut href="/quick-orders" label="Orders" icon={Boxes} />
        <Shortcut href="/analytics" label="Analytics" icon={ChartBar} />
      </div>
      
      <div className="relative mt-4">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-outline" />
        <Input
          className="h-11 pl-10 text-body-sm"
          placeholder={showArchived ? "Search archived records..." : "Search inventory, code, or area..."}
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>

      <div className="mt-3 flex items-center gap-2">
        <Button asChild size="sm" className="h-9 px-3">
          <Link href="/inventory/add">
            <Plus className="h-4 w-4" />
            Add
          </Link>
        </Button>
        <Button
          size="sm"
          variant={sortAsc !== null ? "secondary" : "ghost"}
          onClick={toggleSort}
          className="h-9 gap-1.5 px-3"
        >
          {sortAsc === false ? (
            <ArrowUpZA className="h-4 w-4" />
          ) : (
            <ArrowDownAZ className="h-4 w-4" />
          )}
          {sortAsc === null ? "Sort" : sortAsc ? "A-Z" : "Z-A"}
        </Button>
        
        <Button
          size="sm"
          variant={showArchived ? "secondary" : "ghost"}
          onClick={() => {
            setStatusFilter(null);
            setShowArchived(!showArchived);
          }}
          className="h-9 gap-1.5 border border-outline-variant/30 px-3"
        >
          {showArchived ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
          {showArchived ? "Archived" : "Active"}
        </Button>
      </div>

      <div className="mt-2 grid grid-cols-2 gap-2">
        <Button size="sm" variant="ghost" asChild className="h-8 gap-1.5 border border-outline-variant/25 px-2 text-[11.5px]">
          <Link href="/inventory/bulk-stock-in">
            <Plus className="h-3.5 w-3.5" />
            Bulk stock in
          </Link>
        </Button>
        <Button size="sm" variant="ghost" className="h-8 gap-1.5 border border-outline-variant/25 px-2 text-[11.5px]" onClick={handleExportInventory}>
          <Download className="h-3.5 w-3.5" />
          Export
        </Button>
        <Button
          size="sm"
          variant="ghost"
          className="h-8 gap-1.5 border border-outline-variant/25 px-2 text-[11.5px]"
          onClick={handleImportLocalInventory}
          disabled={inventorySource !== "supabase" || isImporting}
        >
          <Upload className="h-3.5 w-3.5" />
          {isImporting ? "Importing" : "Import local"}
        </Button>
      </div>

      {(inventoryError || importSummary) && (
        <div className="mt-2 rounded-md border border-outline-variant/25 bg-surface-container px-3 py-2 text-[12px] text-on-surface-variant">
          {inventoryError ?? importSummary}
        </div>
      )}

      <section className="mt-3 grid h-12 grid-cols-4 items-center rounded-lg border border-outline-variant/30 bg-surface-container px-1">
        <SummaryItem
          label="Critical"
          value={critical}
          tone="text-error"
          active={statusFilter === "critical"}
          onClick={() => {
            setShowArchived(false);
            setStatusFilter("critical");
          }}
        />
        <SummaryItem
          label="Low stock"
          value={low}
          tone="text-secondary"
          active={statusFilter === "low"}
          onClick={() => {
            setShowArchived(false);
            setStatusFilter("low");
          }}
        />
        <SummaryItem
          label="Zero qty"
          value={zeroQty}
          tone="text-warning"
          active={statusFilter === "zero_qty"}
          onClick={() => {
            setShowArchived(false);
            setStatusFilter("zero_qty");
          }}
        />
        <SummaryItem
          label="Active"
          value={activeItemsList.length}
          tone="text-primary"
          active={statusFilter === "active"}
          onClick={() => {
            setShowArchived(false);
            setStatusFilter("active");
          }}
        />
      </section>

      <div className="mt-3 grid grid-cols-5 gap-1.5">
        {[
          { label: "All", value: "All" },
          { label: "Raw", value: "Raw" },
          { label: "Pack", value: "Packaging" },
          { label: "Finish", value: "Finished" },
          { label: "Asset", value: "Asset" }
        ].map((filter) => {
          const isActive = activeFilter === filter.value;
          return (
            <button
              key={filter.value}
              onClick={() => {
                setActiveFilter(filter.value);
                if (filter.value === "All") setStatusFilter(null);
              }}
              className={cn(
                "min-w-0 rounded-full border px-2 py-2 text-center text-label-sm transition-all active:scale-95",
                isActive
                  ? "bg-primary border-primary text-on-primary shadow-md"
                  : "bg-surface-container border-outline-variant/30 text-on-surface-variant hover:text-on-surface"
              )}
            >
              {filter.label}
            </button>
          );
        })}
      </div>

      <section className="mt-3 space-y-2 pb-8">
        {filteredAndSortedItems.length > 0 ? (
          filteredAndSortedItems.map((item) => {
            const detailHref = `/inventory/${item.id === "item-sles" ? "sles" : item.id}`;

            return (
              <InventoryCard
                key={item.id}
                item={item}
                location={locations.find((location) => location.id === item.locationId)}
                detailHref={detailHref}
                stockInHref={`/inventory/stock-movement?type=in&item=${item.id}`}
                stockOutHref={`/inventory/stock-movement?type=out&item=${item.id}`}
                adjustHref={`/inventory/stock-movement?type=adjustment&item=${item.id}`}
                editHref={`/inventory/add?id=${item.id}`}
                onDuplicate={() => duplicateInventoryItem(item.id)}
                onArchive={() => archiveInventoryItem(item.id)}
              />
            );
          })
        ) : (
          <div className="text-center py-10 bg-surface-container rounded-lg border border-outline-variant/20">
            <p className="text-on-surface-variant text-body-md">
              {inventoryError
                ? "Supabase inventory failed to load. Check database table or policy."
                : inventorySource === "supabase" && inventoryItems.length === 0
                ? "No Supabase inventory items yet."
                : showArchived 
                ? "No archived items found matching your filters."
                : "No items found matching the filter or search criteria."}
            </p>
            {inventorySource === "supabase" && inventoryItems.length === 0 && !inventoryError && (
              <Button className="mt-4 h-9" size="sm" onClick={handleImportLocalInventory} disabled={isImporting}>
                <Upload className="h-4 w-4" />
                Import local inventory backup
              </Button>
            )}
          </div>
        )}
      </section>

      <section className="mt-1 pb-10">
        <div className="flex items-center justify-between">
          <h3 className="text-label-md font-semibold text-on-surface">Recent updates</h3>
          <Link href="/reports/activity" className="text-label-sm text-primary hover:text-primary/80">
            View history
          </Link>
        </div>
        <div className="mt-2 overflow-hidden rounded-lg border border-outline-variant/25 bg-surface-container/70">
          {recentUpdates.length > 0 ? (
            recentUpdates.map((update, index) => (
              <div
                key={`${update.action}-${update.createdAt}-${index}`}
                className="border-b border-outline-variant/15 px-3 py-2 last:border-b-0"
              >
                <p className="truncate text-[12.5px] font-medium leading-4 text-on-surface">{update.action}</p>
                <p className="mt-0.5 text-[11.5px] leading-4 text-on-surface-variant">
                  {update.actorName} {"\u2022"} {formatRelativeTime(update.createdAt)}
                </p>
              </div>
            ))
          ) : (
            <p className="px-3 py-3 text-[12.5px] text-on-surface-variant">No recent inventory updates.</p>
          )}
        </div>
      </section>
    </AppShell>
  );
}

function Shortcut({ href, label, icon: Icon }: Readonly<{ href: string; label: string; icon: React.ComponentType<{ className?: string }> }>) {
  return (
    <Link
      href={href}
      className="flex min-w-0 flex-col items-center gap-1 rounded-lg border border-outline-variant/25 bg-surface-container px-1 py-2 text-center text-[11.5px] font-semibold text-on-surface-variant active:scale-[0.98]"
    >
      <Icon className="h-4 w-4 text-primary" />
      <span className="truncate">{label}</span>
    </Link>
  );
}

function SummaryItem({
  label,
  value,
  tone,
  active,
  onClick
}: Readonly<{ label: string; value: number; tone: string; active: boolean; onClick: () => void }>) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      aria-label={`${value} ${label}`}
      className={cn(
        "flex h-10 items-baseline justify-center gap-1 rounded-md border-r border-outline-variant/25 text-center transition active:scale-[0.98] last:border-r-0",
        active && "border border-primary/35 bg-primary/10 shadow-[inset_0_0_0_1px_rgba(173,198,255,0.16)]"
      )}
    >
      <span className={cn("text-body-md font-bold", tone)}>{value}</span>
      <span className={cn("text-label-sm", active ? "text-primary" : "text-on-surface-variant")}>{label}</span>
    </button>
  );
}

function formatRelativeTime(value: string) {
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return "Recently";

  const diffMs = Date.now() - timestamp;
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diffMs < minute) return "Just now";
  if (diffMs < hour) return `${Math.max(1, Math.floor(diffMs / minute))}m ago`;
  if (diffMs < day) return `${Math.floor(diffMs / hour)}h ago`;
  if (diffMs < 2 * day) return "Yesterday";
  return `${Math.floor(diffMs / day)}d ago`;
}
