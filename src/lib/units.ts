import type { InventoryUnit } from "@/types/domain";

const conversionRates: Record<string, number> = {
  "ml:liter": 0.001,
  "liter:ml": 1000,
  "g:kg": 0.001,
  "kg:g": 1000,
  "gallon:liter": 3.78541,
  "liter:gallon": 1 / 3.78541,
  "pcs:pcs": 1
};

const compatibleUnitOptions: Record<InventoryUnit, InventoryUnit[]> = {
  kg: ["kg", "g"],
  g: ["g", "kg"],
  liter: ["liter", "ml", "gallon"],
  ml: ["ml", "liter"],
  gallon: ["gallon", "liter"],
  pcs: ["pcs"]
};

export function canConvertUnit(from: InventoryUnit, to: InventoryUnit) {
  return from === to || `${from}:${to}` in conversionRates;
}

export function convertUnit(quantity: number, from: InventoryUnit, to: InventoryUnit) {
  if (from === to) {
    return quantity;
  }

  const rate = conversionRates[`${from}:${to}`];
  if (!rate) {
    throw new Error(`Unsupported conversion from ${from} to ${to}`);
  }

  return quantity * rate;
}

export function compatibleUnitsFor(baseUnit: InventoryUnit) {
  return compatibleUnitOptions[baseUnit] ?? [baseUnit];
}

export function toInventoryUnit(unit?: string | null): InventoryUnit | undefined {
  if (unit === "ml" || unit === "liter" || unit === "g" || unit === "kg" || unit === "gallon" || unit === "pcs") {
    return unit;
  }
  return undefined;
}

export function convertQuantityForInventory(quantity: number, fromUnit: string | undefined, inventoryUnit: InventoryUnit) {
  const sourceUnit = toInventoryUnit(fromUnit);
  if (!sourceUnit || !canConvertUnit(sourceUnit, inventoryUnit)) {
    return quantity;
  }
  return convertUnit(quantity, sourceUnit, inventoryUnit);
}
