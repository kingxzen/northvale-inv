"use client";

import { Archive, Check, Copy, MoreVertical, Play, Trash2 } from "lucide-react";
import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useApp } from "@/context/app-context";
import { cn, formatMoney } from "@/lib/utils";
import type { Product, ProductionJob, ProductionStatus } from "@/types/domain";

export interface ProductionCardProps {
  job: ProductionJob;
  product?: Product;
  isMenuOpen: boolean;
  onToggleMenu: () => void;
  onCloseMenu: () => void;
}

export function ProductionCard({
  job,
  product: singleProductFallback,
  isMenuOpen,
  onToggleMenu,
  onCloseMenu
}: ProductionCardProps) {
  const {
    inventoryItems,
    productBomLines,
    products,
    duplicateProductionJob,
    archiveProductionJob,
    deleteProductionJob,
    moveProductionJobToProcess,
    completeProductionJob
  } = useApp();
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isMenuOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target as HTMLElement;
      if (menuRef.current?.contains(target)) return;
      if (target.closest('button[aria-label^="Actions for"]')) return;
      onCloseMenu();
    };

    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, [isMenuOpen, onCloseMenu]);

  const jobProducts = useMemo(() => {
    if (job.productLines && job.productLines.length > 0) {
      return job.productLines.map((line) => ({
        productId: line.productId,
        plannedBatchQty: line.plannedBatchQty,
        productObj: products.find((product) => product.id === line.productId)
      }));
    }

    return [{
      productId: job.productId,
      plannedBatchQty: job.plannedBatchQty,
      productObj: singleProductFallback || products.find((product) => product.id === job.productId)
    }];
  }, [job, products, singleProductFallback]);

  const estimatedCost = useMemo(() => {
    return jobProducts.reduce((total, productLine) => {
      const bomCost = productBomLines
        .filter((line) => line.productId === productLine.productId)
        .reduce((sum, line) => {
          const unitCost = line.costOverride ?? inventoryItems.find((item) => item.id === line.inventoryItemId)?.unitCost ?? 0;
          const wastage = line.wastagePercent ? 1 + line.wastagePercent / 100 : 1;
          return sum + unitCost * line.quantityPerBatch * productLine.plannedBatchQty * wastage;
        }, 0);

      return total + bomCost;
    }, 0);
  }, [inventoryItems, jobProducts, productBomLines]);

  const productTitle = useMemo(() => {
    if (jobProducts.length === 1 && jobProducts[0].productObj) return jobProducts[0].productObj.name;
    if (jobProducts.length > 1) {
      const first = jobProducts[0].productObj?.name ?? "Multiple Product Lines";
      return `${first} (+ ${jobProducts.length - 1} other${jobProducts.length > 2 ? "s" : ""})`;
    }
    return "Untitled Product Run";
  }, [jobProducts]);

  const completed = job.status === "completed";
  const dueDateValue = job.dueDate ?? (job.status === "blocked" ? "2026-06-20T08:00:00+08:00" : job.scheduledFor);
  const dueDate = dueDateValue ? new Date(dueDateValue) : null;
  const isOverdue = !!dueDate && dueDate.getTime() < Date.now() && !completed;
  const isNew = !!job.isNew || (!!job.createdAt && Date.now() - new Date(job.createdAt).getTime() < 24 * 60 * 60 * 1000);
  const reference = job.referenceNote ?? `Custom order #${job.jobNumber.replace(/\D/g, "").slice(-3).padStart(3, "0")}`;

  const runAction = (action: () => void) => {
    action();
    onCloseMenu();
  };

  return (
    <article
      className={cn(
        "premium-card relative overflow-visible rounded-lg border border-outline-variant/20 bg-surface-container px-2.5 py-2 transition hover:border-primary/30",
        job.status === "blocked" && "border-l-4 border-l-error",
        completed && "border-l-4 border-l-success",
        job.status !== "blocked" && !completed && "border-l-4 border-l-primary"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <Link href={`/production/${job.id}`} className="min-w-0 flex-1 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70">
          <h3 className="truncate text-[15.5px] font-bold leading-5 text-white">Plan #{job.jobNumber}</h3>
          <p className="mt-0.5 truncate text-[12.5px] font-semibold leading-4 text-on-surface">{productTitle}</p>
          <p className="mt-0.5 truncate text-[11.5px] leading-4 text-on-surface-variant">
            {jobProducts.length} product{jobProducts.length !== 1 ? "s" : ""} {"\u2022"} {estimatedCost ? formatMoney(estimatedCost) : "Cost pending"}
          </p>
          <p className="mt-0.5 truncate text-[11.5px] leading-4 text-on-surface-variant">
            Due: {dueDate ? dueDate.toLocaleDateString("en-US", { month: "short", day: "numeric" }) : "No due date"} {"\u2022"} Ref: {reference}
          </p>
        </Link>

        <div ref={menuRef} className="relative flex shrink-0 flex-col items-end gap-1">
          <ProductionStatusBadge status={job.status} />
          <div className="flex min-h-4 justify-end gap-1">
            {isNew && <MiniBadge className="border-primary/25 bg-primary/10 text-primary">NEW</MiniBadge>}
            {isOverdue && <MiniBadge className="border-error/25 bg-error/10 text-error">OVERDUE</MiniBadge>}
          </div>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            className="h-7 border border-outline-variant/25 px-2"
            onPointerDown={(event) => event.stopPropagation()}
            onClick={onToggleMenu}
            aria-label={`Actions for ${job.jobNumber}`}
            aria-expanded={isMenuOpen}
          >
            <MoreVertical className="h-4 w-4" />
          </Button>

          {isMenuOpen && (
            <div className="absolute right-0 top-[64px] z-30 w-48 overflow-hidden rounded-md border border-outline-variant/40 bg-surface-container-high shadow-card">
              <MenuButton
                onClick={() => runAction(() => moveProductionJobToProcess(job.id))}
                icon={<Play className="h-4 w-4 text-primary" />}
              >
                Mark To Process
              </MenuButton>
              <MenuButton
                onClick={() => runAction(() => completeProductionJob(job.id))}
                icon={<Check className="h-4 w-4 text-success" />}
              >
                Mark Done
              </MenuButton>
              <MenuButton
                onClick={() => runAction(() => duplicateProductionJob(job.id))}
                icon={<Copy className="h-4 w-4 text-secondary" />}
              >
                Duplicate
              </MenuButton>
              <MenuButton
                onClick={() => runAction(() => archiveProductionJob(job.id))}
                icon={<Archive className="h-4 w-4 text-warning" />}
              >
                Archive
              </MenuButton>
              <MenuButton
                onClick={() => {
                  setIsDeleteOpen(true);
                  onCloseMenu();
                }}
                icon={<Trash2 className="h-4 w-4 text-error" />}
              >
                Delete
              </MenuButton>
            </div>
          )}
        </div>
      </div>

      {isDeleteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4">
          <div className="w-full max-w-sm rounded-lg border border-outline-variant/35 bg-surface-container p-4 shadow-card">
            <h3 className="text-[18px] font-bold text-white">Delete job order?</h3>
            <p className="mt-2 text-[13px] leading-5 text-on-surface-variant">
              This may affect production history. Archive is recommended instead.
            </p>
            <p className="mt-2 rounded-md border border-warning/25 bg-warning/10 p-2 text-[12.5px] font-semibold text-warning">
              Permanent delete is disabled for MVP. Job order will be archived instead.
            </p>
            <div className="mt-4 flex gap-2">
              <Button variant="ghost" className="h-10 flex-1 border border-outline-variant/30" onClick={() => setIsDeleteOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="secondary"
                className="h-10 flex-1"
                onClick={() => {
                  archiveProductionJob(job.id);
                  setIsDeleteOpen(false);
                }}
              >
                Archive instead
              </Button>
              <Button
                className="h-10 flex-1 bg-error text-white hover:bg-error/90"
                onClick={() => {
                  deleteProductionJob(job.id);
                  setIsDeleteOpen(false);
                }}
              >
                Delete
              </Button>
            </div>
          </div>
        </div>
      )}
    </article>
  );
}

function ProductionStatusBadge({ status }: Readonly<{ status: ProductionStatus }>) {
  const tone =
    status === "blocked"
      ? "border-error/35 bg-error/15 text-error"
      : status === "completed" || status === "to_process"
        ? "border-success/35 bg-success/15 text-success"
        : "border-outline-variant bg-surface-container-high text-on-surface-variant";

  return (
    <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase leading-4", tone)}>
      {status === "to_process" ? "PROCESS" : status.replace("_", " ")}
    </span>
  );
}

function MiniBadge({ className, children }: Readonly<{ className: string; children: React.ReactNode }>) {
  return <span className={cn("rounded-full border px-1.5 py-0 text-[9.5px] font-bold leading-4", className)}>{children}</span>;
}

function MenuButton({ onClick, icon, children }: Readonly<{ onClick: () => void; icon: React.ReactNode; children: React.ReactNode }>) {
  return (
    <button
      type="button"
      className="flex min-h-9 w-full items-center gap-2 px-3 text-left text-[12.5px] font-medium text-on-surface hover:bg-surface-variant"
      onClick={onClick}
    >
      {icon}
      {children}
    </button>
  );
}
