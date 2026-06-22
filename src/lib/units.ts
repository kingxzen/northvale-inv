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
