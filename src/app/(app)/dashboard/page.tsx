"use client";

import { Boxes, CircleSlash, Clock3, FlaskConical, PackageSearch } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { InventoryCard } from "@/components/data/inventory-card";
import { Progress } from "@/components/ui/progress";
import { useApp } from "@/context/app-context";
import { formatMoney } from "@/lib/utils";
import Link from "next/link";
import { useMemo } from "react";

export default function DashboardPage() {
  const { inventoryItems, locations, productionJobs, stockTransactions, activityLogs } = useApp();

  const activeItems = useMemo(() => inventoryItems.filter(item => !item.isArchived), [inventoryItems]);
  const criticalItems = useMemo(() => activeItems.filter((item) => item.status === "critical"), [activeItems]);
  const lowItems = useMemo(() => activeItems.filter((item) => item.status === "low"), [activeItems]);
  const blockedJobs = useMemo(() => productionJobs.filter((job) => job.status === "blocked"), [productionJobs]);
  const latestLog = useMemo(() => (
    [...activityLogs].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]
  ), [activityLogs]);
  const weeklyEstimate = useMemo(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() - ((now.getDay() + 6) % 7));
    start.setHours(0, 0, 0, 0);
    const end = new Date(start.getFullYear(), start.getMonth(), start.getDate() + 6, 23, 59, 59, 999);

    return stockTransactions.reduce((sum, txn) => {
      const created = new Date(txn.createdAt);
      if (created < start || created > end) return sum;
      const item = inventoryItems.find((entry) => entry.id === txn.inventoryItemId);
      return sum + Number(txn.quantity || 0) * (item?.unitCost ?? 0);
    }, 0);
  }, [inventoryItems, stockTransactions]);

  return (
    <AppShell>
      <section className="mb-3 flex items-center gap-2 rounded-lg border border-outline-variant/20 bg-surface-container px-3 py-2 text-[12px] text-on-surface-variant">
        <Clock3 className="h-4 w-4 shrink-0 text-primary" />
        <p className="min-w-0 truncate">
          Last update: {latestLog ? `${latestLog.action} • ${latestLog.actorName} • ${formatRelativeTime(latestLog.createdAt)}` : "No setup actions yet"}
        </p>
      </section>

      <section className="rounded-lg border border-primary/20 bg-hero-card p-6 shadow-card">
        <div className="grid grid-cols-[1fr_auto] gap-5">
          <div>
            <p className="text-body-lg text-primary">Need actions today</p>
            <p className="mt-3 text-[76px] font-bold leading-none text-white">{criticalItems.length + lowItems.length + blockedJobs.length}</p>
            <p className="mt-3 max-w-52 text-body-lg text-on-surface-variant">Items need attention before production</p>
          </div>
          <div className="rounded-lg bg-surface-container-high/80 p-5">
            <Metric label="Order" value={lowItems.length + criticalItems.length} />
            <Metric label="Blocked" value={blockedJobs.length} alert />
            <Metric label="Low stock" value={lowItems.length} />
          </div>
        </div>
      </section>

      <section className="mt-5 grid grid-cols-2 gap-4">
        <ActionCard
          icon={PackageSearch}
          title="Need to order"
          value={`${lowItems.length + criticalItems.length} items`}
          subtitle="Critical shortages"
          href="/inventory"
        />
        <ActionCard
          icon={CircleSlash}
          title="Blocked job"
          value={`${blockedJobs.length} active`}
          subtitle="Check BOM"
          href="/production"
        />
      </section>

      <section className="mt-7">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-headline-md">Priority Today</h2>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/inventory">View all</Link>
          </Button>
        </div>
        <div className="space-y-3">
          {activeItems.slice(0, 3).map((item) => (
            <Link
              key={item.id}
              href={`/inventory/${item.id === "item-sles" ? "sles" : item.id}`}
              className="block hover:no-underline active:scale-[0.99] transition-transform"
            >
              <InventoryCard item={item} location={locations.find((location) => location.id === item.locationId)} />
            </Link>
          ))}
        </div>
      </section>

      <Card className="mt-6 p-5 bg-surface-container border border-outline-variant/20">
        <div className="flex items-center gap-5">
          <div className="grid h-16 w-16 place-items-center rounded-full bg-navy text-primary">
            <Boxes className="h-7 w-7" />
          </div>
          <div>
            <p className="text-body-md text-on-surface-variant">Weekly estimate</p>
            <p className="text-headline-md font-bold text-white">{formatMoney(weeklyEstimate)}</p>
          </div>
        </div>
        <div className="mt-5 border-t border-outline-variant/50 pt-5">
          <Progress value={weeklyEstimate > 0 ? 68 : 0} />
          <div className="mt-4 flex flex-wrap gap-4 text-body-sm text-on-surface-variant">
            <span>Raw PHP 0</span>
            <span>Packaging PHP 0</span>
            <span>Labor PHP 0</span>
          </div>
        </div>
      </Card>
    </AppShell>
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

function Metric({ label, value, alert = false }: Readonly<{ label: string; value: number; alert?: boolean }>) {
  return (
    <div className="mb-5 last:mb-0">
      <p className="text-body-md text-on-surface-variant">{label}</p>
      <p className={alert ? "text-headline-md text-error" : "text-headline-md text-primary font-bold"}>{value}</p>
    </div>
  );
}

function ActionCard({
  icon: Icon,
  title,
  value,
  subtitle,
  href
}: Readonly<{ icon: typeof FlaskConical; title: string; value: string; subtitle: string; href?: string }>) {
  const content = (
    <Card className="p-5 h-full cursor-pointer hover:bg-surface-container-high/40 transition active:scale-[0.98] bg-surface-container border border-outline-variant/20">
      <div className="mb-8 flex items-center justify-between">
        <div className="grid h-12 w-12 place-items-center rounded-md bg-navy text-primary">
          <Icon className="h-6 w-6" />
        </div>
      </div>
      <h3 className="text-body-lg font-semibold text-white">{title}</h3>
      <p className="text-headline-md font-bold text-white">{value}</p>
      <p className="text-body-sm text-error">{subtitle}</p>
    </Card>
  );

  if (href) {
    return <Link href={href} className="block no-underline">{content}</Link>;
  }

  return content;
}
