"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Archive, Box, Copy, Edit3, FlaskConical, Minus, MoreVertical, Package, Plus, Sliders, Wrench } from "lucide-react";
import type { InventoryItem, Location } from "@/types/domain";
import { cn } from "@/lib/utils";

export interface InventoryCardProps {
  item: InventoryItem;
  location?: Location;
  detailHref?: string;
  editHref?: string;
  stockInHref?: string;
  stockOutHref?: string;
  adjustHref?: string;
  onDuplicate?: () => void;
  onArchive?: () => void;
}

const iconByCategory = {
  raw: FlaskConical,
  packaging: Package,
  finished: Box,
  asset: Wrench
};

const statusStyles = {
  critical: "border-error/35 bg-error/15 text-error",
  low: "border-secondary/35 bg-secondary/15 text-secondary",
  good: "border-success/35 bg-success/15 text-success",
  active: "border-outline-variant bg-surface-container-high text-on-surface-variant"
};

export function InventoryCard({ item, location, detailHref, editHref, stockInHref, stockOutHref, adjustHref, onDuplicate, onArchive }: InventoryCardProps) {
  const router = useRouter();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const Icon = iconByCategory[item.category];
  const categoryLabel = item.category === "raw" ? "Raw" : item.category === "asset" ? "Asset" : item.category[0].toUpperCase() + item.category.slice(1);
  const metadata = `${categoryLabel} \u2022 ${location?.code ?? "No area"} \u2022 ${item.quantityOnHand} ${item.unit}`;
  const displayStatus = item.reorderPoint <= 0 && item.quantityOnHand <= 0 && item.category !== "asset" ? "active" : item.reorderPoint <= 0 ? "active" : item.status;
  const displayLabel = item.reorderPoint <= 0 && item.quantityOnHand <= 0 && item.category !== "asset" ? "ZERO" : displayStatus.toUpperCase();

  const content = (
    <>
      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-primary/20 bg-surface-container-high text-primary">
        <Icon className="h-[18px] w-[18px]" />
      </div>
      <div className="min-w-0 flex-1 pr-1">
        <h3 className="line-clamp-2 text-[15.5px] font-semibold leading-[19px] text-on-surface">{item.name}</h3>
        <p className="mt-1 truncate text-[12.5px] leading-4 text-on-surface-variant">
          {metadata}
        </p>
      </div>
    </>
  );

  const openDetails = () => {
    if (detailHref) router.push(detailHref);
  };

  return (
    <article
      role={detailHref ? "link" : undefined}
      tabIndex={detailHref ? 0 : undefined}
      aria-label={detailHref ? `Open ${item.name}` : undefined}
      onClick={(event) => {
        if ((event.target as HTMLElement).closest("button, a")) return;
        openDetails();
      }}
      onKeyDown={(event) => {
        if (!detailHref || event.currentTarget !== event.target) return;
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openDetails();
        }
      }}
      className="premium-card group relative flex min-h-[68px] cursor-pointer items-center gap-2 rounded-lg p-2 transition active:scale-[0.99] active:bg-surface-container-high focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
    >
      <div className="relative z-10 flex min-w-0 flex-1 items-center gap-3 pointer-events-none">{content}</div>

      <div className="pointer-events-none relative z-20 flex shrink-0 items-center gap-1">
        <span className={cn("rounded-full border px-2 py-0.5 text-[11px] font-semibold leading-4", statusStyles[displayStatus])}>
          {displayLabel}
        </span>
        {editHref || onDuplicate || stockInHref || stockOutHref || adjustHref || onArchive ? (
          <button
            type="button"
            aria-label={`Actions for ${item.name}`}
            aria-expanded={isMenuOpen}
            onClick={(event) => {
              event.stopPropagation();
              setIsMenuOpen((open) => !open);
            }}
            className="pointer-events-auto grid h-8 w-8 place-items-center rounded-md text-on-surface-variant transition hover:bg-surface-container-high hover:text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            <MoreVertical className="h-4 w-4" />
          </button>
        ) : null}
      </div>

      {isMenuOpen && (
        <div
          className="pointer-events-auto absolute right-2 top-12 z-30 w-44 overflow-hidden rounded-md border border-outline-variant/40 bg-surface-container-high shadow-card"
          onClick={(event) => event.stopPropagation()}
        >
          {stockInHref ? (
            <MenuLink href={stockInHref} onClick={() => setIsMenuOpen(false)} icon={<Plus className="h-4 w-4 text-success" />}>
              Stock in
            </MenuLink>
          ) : null}
          {stockOutHref ? (
            <MenuLink href={stockOutHref} onClick={() => setIsMenuOpen(false)} icon={<Minus className="h-4 w-4 text-error" />}>
              Stock out
            </MenuLink>
          ) : null}
          {adjustHref ? (
            <MenuLink href={adjustHref} onClick={() => setIsMenuOpen(false)} icon={<Sliders className="h-4 w-4 text-primary" />}>
              Adjust count
            </MenuLink>
          ) : null}
          {editHref ? (
            <MenuLink href={editHref} onClick={() => setIsMenuOpen(false)} icon={<Edit3 className="h-4 w-4 text-primary" />}>
              Edit
            </MenuLink>
          ) : null}
          {onDuplicate ? (
            <button
              type="button"
              className="flex min-h-10 w-full items-center gap-2 px-3 text-left text-body-sm text-on-surface hover:bg-surface-variant"
              onClick={() => {
                onDuplicate();
                setIsMenuOpen(false);
              }}
            >
              <Copy className="h-4 w-4 text-secondary" />
              Duplicate
            </button>
          ) : null}
          {onArchive ? (
            <button
              type="button"
              className="flex min-h-10 w-full items-center gap-2 px-3 text-left text-body-sm text-warning hover:bg-surface-variant"
              onClick={() => {
                if (window.confirm(`Archive ${item.name}?`)) onArchive();
                setIsMenuOpen(false);
              }}
            >
              <Archive className="h-4 w-4" />
              Archive
            </button>
          ) : null}
        </div>
      )}
    </article>
  );
}

function MenuLink({ href, onClick, icon, children }: Readonly<{ href: string; onClick: () => void; icon: React.ReactNode; children: React.ReactNode }>) {
  return (
    <Link
      href={href}
      className={cn("flex min-h-10 items-center gap-2 px-3 text-body-sm text-on-surface hover:bg-surface-variant hover:no-underline")}
      onClick={onClick}
    >
      {icon}
      {children}
    </Link>
  );
}
