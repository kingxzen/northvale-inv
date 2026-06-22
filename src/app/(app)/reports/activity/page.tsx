"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Download, Boxes, Factory, Sliders, Tag } from "lucide-react";
import { useApp } from "@/context/app-context";
import { cn } from "@/lib/utils";

const iconMap = {
  stock: Boxes,
  production: Factory,
  product: Tag,
  adjustment: Sliders
};

const badgeClasses = {
  stock: "bg-secondary-container/15 text-secondary border border-secondary/20",
  production: "bg-tertiary-container/15 text-tertiary border border-tertiary/20",
  product: "bg-primary-container/15 text-primary border border-primary/20",
  adjustment: "bg-error-container/15 text-error border border-error/20"
};

export default function ActivityLogPage() {
  const { activityLogs } = useApp();
  const [activeFilter, setActiveFilter] = useState("All");
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const triggerToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 2000);
  };

  // Format creation date to relative or human-readable format
  const formatTime = (isoString: string) => {
    try {
      const now = new Date();
      const past = new Date(isoString);
      const diffMs = now.getTime() - past.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMins / 60);

      if (diffMins < 1) return "Just now";
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      return past.toLocaleDateString();
    } catch {
      return "—";
    }
  };

  // Map entity types to the active categories in filters
  const mappedLogs = useMemo(() => {
    return activityLogs.map((log) => {
      let type: "stock" | "production" | "product" | "adjustment" = "stock";
      
      if (log.entityType === "production_job") {
        type = "production";
      } else if (log.entityType === "product") {
        type = "product";
      } else if (log.entityType === "inventory_item") {
        const actionLower = log.action.toLowerCase();
        if (actionLower.includes("adjust") || actionLower.includes("change")) {
          type = "adjustment";
        } else {
          type = "stock";
        }
      }

      return {
        id: log.id,
        title: log.action,
        time: formatTime(log.createdAt),
        actor: log.actorName,
        details: log.entityType.replace("_", " "),
        type,
        rawDate: new Date(log.createdAt)
      };
    }).sort((a, b) => b.rawDate.getTime() - a.rawDate.getTime()); // Sort newest first
  }, [activityLogs]);

  const filteredLogs = useMemo(() => {
    if (activeFilter === "All") return mappedLogs;
    return mappedLogs.filter((log) => log.type.toLowerCase() === activeFilter.toLowerCase());
  }, [mappedLogs, activeFilter]);

  return (
    <AppShell>
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-10 left-1/2 -translate-x-1/2 z-50 bg-secondary-container text-on-secondary-container border border-outline-variant/30 font-semibold px-6 py-3 rounded-full shadow-glow animate-bounce">
          {toastMessage}
        </div>
      )}

      {/* Top Header */}
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" asChild className="rounded-full">
          <Link href="/reports" aria-label="Back">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <h2 className="text-headline-md font-bold text-white">Activity log</h2>
          <p className="text-body-sm text-on-surface-variant mt-0.5">Real-time audit of production and inventory shifts.</p>
        </div>
      </div>

      {/* Filters Section */}
      <div className="flex flex-wrap gap-2 mb-6 overflow-x-auto pb-2 no-scrollbar">
        {["All", "Stock", "Production", "Product", "Adjustment"].map((filter) => {
          const isActive = activeFilter === filter;
          return (
            <button
              key={filter}
              onClick={() => setActiveFilter(filter)}
              className={cn(
                "rounded-full px-5 py-2 font-label-md border transition-all active:scale-95 text-label-sm",
                isActive
                  ? "bg-secondary-container text-on-secondary-container border-secondary-container shadow-md"
                  : "bg-surface-container border-outline-variant/30 text-on-surface-variant hover:text-on-surface"
              )}
            >
              {filter}
            </button>
          );
        })}
      </div>

      {/* Activity Log List */}
      <div className="space-y-3">
        {filteredLogs.length > 0 ? (
          filteredLogs.map((log) => {
            const LogIcon = iconMap[log.type] || Boxes;
            return (
              <Card 
                key={log.id} 
                className="p-4 flex items-start gap-4 hover:bg-surface-container-high/40 transition duration-300 bg-surface-container border border-outline-variant/20"
              >
                <div className={cn(
                  "w-10 h-10 shrink-0 rounded-lg flex items-center justify-center border",
                  log.type === "stock"
                    ? "bg-secondary/10 border-secondary/20 text-secondary"
                    : log.type === "production"
                    ? "bg-tertiary/10 border-tertiary/20 text-tertiary"
                    : log.type === "product"
                    ? "bg-primary/10 border-primary/20 text-primary"
                    : "bg-error/10 border-error/20 text-error"
                )}>
                  <LogIcon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex justify-between items-start">
                    <h4 className="font-semibold text-white text-body-sm mb-0.5 truncate">{log.title}</h4>
                    <span className="text-body-sm text-on-surface-variant shrink-0 ml-2">{log.time}</span>
                  </div>
                  <div className="flex items-center gap-2 mb-2 text-body-sm text-on-surface-variant">
                    <span className="text-secondary font-medium">{log.actor}</span>
                    {log.details && (
                      <>
                        <span className="w-1.5 h-1.5 rounded-full bg-outline-variant/55" />
                        <span className="capitalize">{log.details}</span>
                      </>
                    )}
                  </div>
                  <span className={cn("px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider", badgeClasses[log.type])}>
                    {log.type}
                  </span>
                </div>
              </Card>
            );
          })
        ) : (
          <div className="text-center py-10 bg-surface-container rounded-lg border border-outline-variant/20">
            <p className="text-on-surface-variant text-body-md">No logs found matching the filter selection.</p>
          </div>
        )}
      </div>

      {/* Export Action Button */}
      <div className="mt-8 flex justify-center pb-10">
        <Button 
          onClick={() => triggerToast("Activity logs export is coming soon!")}
          className="bg-secondary-container text-on-secondary-container hover:brightness-110 font-bold px-6 py-5 rounded-full shadow-lg"
        >
          <Download className="h-5 w-5 mr-1.5" />
          Export Log
        </Button>
      </div>
    </AppShell>
  );
}
