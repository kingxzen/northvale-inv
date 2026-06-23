"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  BarChart3,
  Boxes,
  Factory,
  Grid2X2,
  Plus,
  ArrowDownToLine,
  ArrowUpFromLine,
  PlusCircle,
  GitBranch,
  Wrench,
  X,
  ChevronRight,
  ClipboardList,
  PackageCheck,
  PackageMinus
} from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/dashboard", label: "Dashboard", icon: Grid2X2 },
  { href: "/inventory", label: "Inventory", icon: Boxes },
  { href: "/production", label: "Production", icon: Factory },
  { href: "/reports", label: "Reports", icon: BarChart3 }
];

export function BottomNav() {
  const pathname = usePathname();
  const [isOpen, setIsOpen] = useState(false);

  const toggleSheet = () => setIsOpen((open) => !open);
  const closeSheet = () => setIsOpen(false);

  return (
    <>
      {/* Overlay Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm transition-opacity"
          onClick={closeSheet}
        />
      )}

      {isOpen && (
        <div
          className="fixed inset-x-0 bottom-0 z-[60] mx-auto w-full max-w-md bg-surface-container-high rounded-t-[32px] border-t border-outline-variant/30 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] pb-8 px-6"
          role="dialog"
          aria-modal="true"
          aria-label="Create"
        >
          {/* Handle */}
          <div className="flex justify-center pt-4 pb-2">
            <div className="w-12 h-1.5 bg-outline-variant rounded-full opacity-50" />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between pb-4">
            <h2 className="text-headline-md font-semibold text-on-surface">Create</h2>
            <button
              type="button"
              onClick={closeSheet}
              className="p-1 rounded-full hover:bg-surface-container-highest transition text-on-surface-variant"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Content Area */}
          <div className="space-y-3 max-h-[60vh] overflow-y-auto pr-1">
            {/* Main Actions */}
            <Link
              href="/production/new"
              onClick={closeSheet}
              className="flex items-start gap-4 p-4 rounded-2xl bg-surface-container/50 border border-outline-variant/10 hover:bg-surface-container-highest/50 active:scale-[0.98] transition text-left group"
            >
            <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-on-primary transition">
              <Factory className="h-6 w-6" />
            </div>
            <div className="flex-grow pt-0.5">
              <p className="text-label-md text-on-surface">New production plan</p>
              <p className="text-body-sm text-on-surface-variant mt-0.5">Check BOM and material availability</p>
            </div>
            <ChevronRight className="h-5 w-5 text-outline self-center opacity-0 group-hover:opacity-100 transition" />
            </Link>

            <Link
              href="/quick-order/new"
              onClick={closeSheet}
              className="flex items-start gap-4 p-4 rounded-2xl bg-surface-container/50 border border-outline-variant/10 hover:bg-surface-container-highest/50 active:scale-[0.98] transition text-left group"
            >
            <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-secondary-container/20 flex items-center justify-center text-secondary group-hover:bg-secondary group-hover:text-on-secondary transition">
              <PackageCheck className="h-6 w-6" />
            </div>
            <div className="flex-grow pt-0.5">
              <p className="text-label-md text-on-surface">Quick Order / Packing</p>
              <p className="text-body-sm text-on-surface-variant mt-0.5">Ecommerce or retail packing order</p>
            </div>
            <ChevronRight className="h-5 w-5 text-outline self-center opacity-0 group-hover:opacity-100 transition" />
            </Link>

            <Link
              href="/quick-plan/new"
              onClick={closeSheet}
              className="flex items-start gap-4 p-4 rounded-2xl bg-surface-container/50 border border-outline-variant/10 hover:bg-surface-container-highest/50 active:scale-[0.98] transition text-left group"
            >
            <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-on-primary transition">
              <PackageMinus className="h-6 w-6" />
            </div>
            <div className="flex-grow pt-0.5">
              <p className="text-label-md text-on-surface">Quick Plan</p>
              <p className="text-body-sm text-on-surface-variant mt-0.5">Finished goods out with notes or optional materials</p>
            </div>
            <ChevronRight className="h-5 w-5 text-outline self-center opacity-0 group-hover:opacity-100 transition" />
            </Link>

            <Link
              href="/production/tasks"
              onClick={closeSheet}
              className="flex items-start gap-4 p-4 rounded-2xl bg-surface-container/50 border border-outline-variant/10 hover:bg-surface-container-highest/50 active:scale-[0.98] transition text-left group"
            >
            <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-secondary-container/20 flex items-center justify-center text-secondary group-hover:bg-secondary group-hover:text-on-secondary transition">
              <ClipboardList className="h-6 w-6" />
            </div>
            <div className="flex-grow pt-0.5">
              <p className="text-label-md text-on-surface">Production Task</p>
              <p className="text-body-sm text-on-surface-variant mt-0.5">Separate to-do list, not mixed with plan jobs</p>
            </div>
            <ChevronRight className="h-5 w-5 text-outline self-center opacity-0 group-hover:opacity-100 transition" />
            </Link>

            <Link
              href="/products"
              onClick={closeSheet}
              className="flex items-start gap-4 p-4 rounded-2xl bg-surface-container/50 border border-outline-variant/10 hover:bg-surface-container-highest/50 active:scale-[0.98] transition text-left group"
            >
            <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-on-primary transition">
              <GitBranch className="h-6 w-6" />
            </div>
            <div className="flex-grow pt-0.5">
              <p className="text-label-md text-on-surface">Products & BOMs</p>
              <p className="text-body-sm text-on-surface-variant mt-0.5 font-normal">View formulations, status, and recipe details</p>
            </div>
            <ChevronRight className="h-5 w-5 text-outline self-center opacity-0 group-hover:opacity-100 transition" />
            </Link>

            <Link
              href="/inventory/stock-movement?type=in"
              onClick={closeSheet}
              className="flex items-start gap-4 p-4 rounded-2xl bg-surface-container/50 border border-outline-variant/10 hover:bg-surface-container-highest/50 active:scale-[0.98] transition text-left group"
            >
            <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-secondary-container/20 flex items-center justify-center text-secondary group-hover:bg-secondary group-hover:text-on-secondary transition">
              <ArrowDownToLine className="h-6 w-6" />
            </div>
            <div className="flex-grow pt-0.5">
              <p className="text-label-md text-on-surface">Stock in</p>
              <p className="text-body-sm text-on-surface-variant mt-0.5 font-normal">Add received materials or packaging</p>
            </div>
            <ChevronRight className="h-5 w-5 text-outline self-center opacity-0 group-hover:opacity-100 transition" />
            </Link>

            <Link
              href="/inventory/bulk-stock-in"
              onClick={closeSheet}
              className="flex items-start gap-4 p-4 rounded-2xl bg-surface-container/50 border border-outline-variant/10 hover:bg-surface-container-highest/50 active:scale-[0.98] transition text-left group"
            >
            <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-secondary-container/20 flex items-center justify-center text-secondary group-hover:bg-secondary group-hover:text-on-secondary transition">
              <ArrowDownToLine className="h-6 w-6" />
            </div>
            <div className="flex-grow pt-0.5">
              <p className="text-label-md text-on-surface">Bulk Stock In</p>
              <p className="text-body-sm text-on-surface-variant mt-0.5 font-normal">Multiple received items with shared shipping fee</p>
            </div>
            <ChevronRight className="h-5 w-5 text-outline self-center opacity-0 group-hover:opacity-100 transition" />
            </Link>

            <Link
              href="/inventory/stock-movement?type=out"
              onClick={closeSheet}
              className="flex items-start gap-4 p-4 rounded-2xl bg-surface-container/50 border border-outline-variant/10 hover:bg-surface-container-highest/50 active:scale-[0.98] transition text-left group"
            >
            <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-error-container/20 flex items-center justify-center text-error group-hover:bg-error group-hover:text-on-error transition">
              <ArrowUpFromLine className="h-6 w-6" />
            </div>
            <div className="flex-grow pt-0.5">
              <p className="text-label-md text-on-surface">Stock out</p>
              <p className="text-body-sm text-on-surface-variant mt-0.5 font-normal">Record used or removed stock</p>
            </div>
            <ChevronRight className="h-5 w-5 text-outline self-center opacity-0 group-hover:opacity-100 transition" />
            </Link>

            <div className="h-px bg-outline-variant/20 my-2" />

            {/* Grid for smaller actions */}
            <div className="grid grid-cols-3 gap-2">
              <Link
                href="/inventory/add"
                onClick={closeSheet}
                className="flex flex-col items-center justify-center gap-2 p-3 rounded-2xl bg-surface-container/30 border border-outline-variant/10 hover:bg-surface-container-highest/50 active:scale-[0.95] transition text-center group"
              >
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-surface-variant flex items-center justify-center text-on-surface-variant group-hover:bg-primary group-hover:text-on-primary transition">
                <PlusCircle className="h-5 w-5" />
              </div>
                <p className="text-label-sm text-on-surface">New Inventory Item</p>
              </Link>

              <Link
                href="/products/new"
                onClick={closeSheet}
                className="flex flex-col items-center justify-center gap-2 p-3 rounded-2xl bg-surface-container/30 border border-outline-variant/10 hover:bg-surface-container-highest/50 active:scale-[0.95] transition text-center group"
              >
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-surface-variant flex items-center justify-center text-on-surface-variant group-hover:bg-primary group-hover:text-on-primary transition">
                <GitBranch className="h-5 w-5" />
              </div>
              <p className="text-label-sm text-on-surface">Add BOM</p>
              </Link>

              <Link
                href="/inventory/add?type=asset"
                onClick={closeSheet}
                className="flex flex-col items-center justify-center gap-2 p-3 rounded-2xl bg-surface-container/30 border border-outline-variant/10 hover:bg-surface-container-highest/50 active:scale-[0.95] transition text-center group"
              >
              <div className="flex-shrink-0 w-10 h-10 rounded-full bg-surface-variant flex items-center justify-center text-on-surface-variant group-hover:bg-primary group-hover:text-on-primary transition">
                <Wrench className="h-5 w-5" />
              </div>
              <p className="text-label-sm text-on-surface">Add asset</p>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* Main Bottom Nav Shell */}
      <nav aria-label="Primary" className="glass-nav fixed inset-x-0 bottom-0 z-40 mx-auto h-[72px] max-w-5xl">
        <div className="grid h-full grid-cols-5 items-center px-5">
          {navItems.slice(0, 2).map((item) => (
            <NavItem key={item.href} active={pathname.startsWith(item.href)} {...item} />
          ))}
          <button
            onClick={toggleSheet}
            aria-label="Create"
            className="focus-ring mx-auto -mt-6 grid h-16 w-16 place-items-center rounded-lg bg-primary text-on-primary shadow-[0_0_18px_rgba(173,198,255,0.22)] transition active:scale-95"
          >
            <Plus className={cn("h-7 w-7 transition-transform duration-300", isOpen && "rotate-45")} />
          </button>
          {navItems.slice(2).map((item) => (
            <NavItem key={item.href} active={pathname.startsWith(item.href)} {...item} />
          ))}
        </div>
      </nav>
    </>
  );
}

interface NavItemProps {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  active: boolean;
}

function NavItem({ href, label, icon: Icon, active }: NavItemProps) {
  return (
    <Link
      href={href}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      className={cn(
        "focus-ring mx-auto grid h-10 w-10 place-items-center rounded-full text-on-surface-variant transition",
        active && "bg-cobalt text-white shadow-[0_0_14px_rgba(173,198,255,0.18)]"
      )}
    >
      <Icon className="h-[22px] w-[22px]" />
    </Link>
  );
}
