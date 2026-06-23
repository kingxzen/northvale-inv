import type { InventoryUnit } from "@/types/domain";

export type QuickPlanPurpose = "stock" | "customer" | "other";

export type QuickPlanMaterial = {
  id: string;
  inventoryItemId: string;
  quantity: number;
  unit: InventoryUnit;
  note?: string;
};

export type QuickPlan = {
  id: string;
  status: "draft" | "completed";
  title: string;
  purpose: QuickPlanPurpose;
  reference?: string;
  finishedGoodItemId: string;
  finishedGoodQty: number;
  finishedGoodUnit: InventoryUnit;
  bomNote?: string;
  materials: QuickPlanMaterial[];
  otherCost?: number;
  notes?: string;
  createdAt: string;
  completedAt?: string;
};

const QUICK_PLANS_KEY = "northvale_quick_plans";

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const stored = window.localStorage.getItem(key);
    return stored ? JSON.parse(stored) : fallback;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

export function makeQuickPlanId(prefix = "qplan") {
  return `${prefix}-${Math.random().toString(36).slice(2, 9)}`;
}

export function getQuickPlans() {
  return readJson<QuickPlan[]>(QUICK_PLANS_KEY, []);
}

export function saveQuickPlans(plans: QuickPlan[]) {
  writeJson(QUICK_PLANS_KEY, plans);
}
