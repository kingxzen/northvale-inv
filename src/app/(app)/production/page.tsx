"use client";

import Link from "next/link";
import { useEffect, useState, useMemo } from "react";
import { ClipboardList, FilePlus2, Plus } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { ProductionCard } from "@/components/data/production-card";
import { useApp } from "@/context/app-context";
import { getProductionTasks } from "@/lib/production-tasks";
import { cn } from "@/lib/utils";

export default function ProductionPage() {
  const { productionJobs, products, activityLogs } = useApp();

  const [activeFilter, setActiveFilter] = useState("All");
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);
  const [openTaskCount, setOpenTaskCount] = useState(0);

  useEffect(() => {
    setOpenTaskCount(getProductionTasks().filter((task) => task.status === "todo").length);
  }, []);

  const activeJobs = useMemo(() => productionJobs.filter((job) => !job.isArchived), [productionJobs]);

  // Calculate live metric totals
  const drafts = useMemo(() => activeJobs.filter((job) => job.status === "draft").length, [activeJobs]);
  const toProcess = useMemo(() => activeJobs.filter((job) => job.status === "to_process").length, [activeJobs]);
  const completed = useMemo(() => activeJobs.filter((job) => job.status === "completed").length, [activeJobs]);

  // Filter jobs dynamically
  const filteredJobs = useMemo(() => {
    if (activeFilter === "All") return activeJobs;
    if (activeFilter === "Late") {
      return activeJobs.filter((job) => {
        const dueDateValue = job.dueDate ?? (job.status === "blocked" ? "2026-06-20T08:00:00+08:00" : job.scheduledFor);
        return !!dueDateValue && new Date(dueDateValue).getTime() < Date.now() && job.status !== "completed";
      });
    }
    const statusValue = activeFilter === "Process" ? "to_process" : activeFilter === "Done" ? "completed" : activeFilter.toLowerCase();
    return activeJobs.filter(job => job.status.toLowerCase() === statusValue);
  }, [activeJobs, activeFilter]);

  const recentUpdates = useMemo(() => {
    const productionLogs = activityLogs
      .filter((log) => log.entityType === "production_job")
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 3);

    return productionLogs;
  }, [activityLogs]);

  return (
    <AppShell>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-label-sm uppercase text-primary">Manufacturing</p>
          <h2 className="mt-1 text-[36px] font-bold leading-tight text-white">Production</h2>
        </div>
        <Button asChild size="sm" className="mt-2 h-9 px-3">
          <Link href="/production/new">
            <Plus className="h-4 w-4" /> New
          </Link>
        </Button>
      </div>

      <section className="mt-3 grid h-12 grid-cols-3 items-center rounded-lg border border-outline-variant/30 bg-surface-container px-3">
        <SummaryStat label="Draft" value={drafts} className="text-primary" />
        <SummaryStat label="To Process" value={toProcess} className="text-secondary" />
        <SummaryStat label="Done" value={completed} className="text-success" />
      </section>

      <section className="mt-3 grid grid-cols-2 gap-2">
        <Button asChild variant="secondary" className="h-11 justify-start rounded-lg border border-outline-variant/30 bg-surface-container px-3 text-[13px]">
          <Link href="/production/tasks">
            <ClipboardList className="h-4 w-4 text-primary" />
            Tasks{openTaskCount > 0 ? ` (${openTaskCount})` : ""}
          </Link>
        </Button>
        <Button asChild variant="secondary" className="h-11 justify-start rounded-lg border border-outline-variant/30 bg-surface-container px-3 text-[13px]">
          <Link href="/quick-plan/new">
            <FilePlus2 className="h-4 w-4 text-primary" />
            Quick plan
          </Link>
        </Button>
      </section>

      {/* Tabs / Filter Controls */}
      <div className="mt-3 grid grid-cols-6 gap-1">
          {["All", "Draft", "Process", "Done", "Blocked", "Late"].map((filter) => {
            const isActive = activeFilter === filter;
            return (
              <button
                key={filter}
                onClick={() => setActiveFilter(filter)}
                className={cn(
                  "min-w-0 rounded-full border px-1 py-2 text-center text-[10.5px] font-semibold transition-all active:scale-95",
                  isActive
                    ? "border-primary bg-primary text-on-primary shadow-md"
                    : "border-outline-variant/30 bg-surface-container text-on-surface-variant hover:text-white"
                )}
              >
                {filter}
              </button>
            );
          })}
      </div>

      {/* Production Cards List */}
      <section className="mt-3 space-y-2">
        {filteredJobs.length > 0 ? (
          filteredJobs.map((job) => (
            <ProductionCard
              key={job.id}
              job={job}
              product={products.find((product) => product.id === job.productId)}
              isMenuOpen={openMenuId === job.id}
              onToggleMenu={() => setOpenMenuId((current) => current === job.id ? null : job.id)}
              onCloseMenu={() => setOpenMenuId(null)}
            />
          ))
        ) : (
          <div className="text-center py-12 bg-surface-container rounded-xl border border-outline-variant/20">
            <p className="text-on-surface-variant text-body-md">
              No production jobs found under status "{activeFilter}".
            </p>
          </div>
        )}
      </section>

      <section className="mt-4 rounded-lg border border-outline-variant/25 bg-surface-container p-3 pb-4">
        <h3 className="text-[14px] font-semibold text-white">Recent updates</h3>
        <div className="mt-2 space-y-2">
          {recentUpdates.length > 0 ? (
            recentUpdates.map((log) => (
              <div key={log.id} className="border-t border-outline-variant/15 pt-2 first:border-t-0 first:pt-0">
                <p className="truncate text-[12.5px] font-medium text-on-surface">{log.action}</p>
                <p className="mt-0.5 text-[11.5px] text-on-surface-variant">
                  {log.actorName} {"\u2022"} {formatRelativeTime(log.createdAt)}
                </p>
              </div>
            ))
          ) : (
            <p className="text-[12.5px] text-on-surface-variant">No recent production updates.</p>
          )}
        </div>
      </section>
    </AppShell>
  );
}

function SummaryStat({ label, value, className }: Readonly<{ label: string; value: number; className: string }>) {
  return (
    <div className="flex items-baseline justify-center gap-1 border-r border-outline-variant/25 last:border-r-0">
      <span className={cn("text-body-md font-bold", className)}>{value}</span>
      <span className="text-label-sm text-on-surface-variant">{label}</span>
    </div>
  );
}

function formatRelativeTime(value: string) {
  const diffMs = Date.now() - new Date(value).getTime();
  const diffMinutes = Math.max(0, Math.round(diffMs / 60000));
  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;
  const diffHours = Math.round(diffMinutes / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  return "Yesterday";
}
