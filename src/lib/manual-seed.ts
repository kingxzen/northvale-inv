import { inventoryItems as seedInventoryItems } from "@/data/mock-data";
import type { InventoryItem } from "@/types/domain";

type SeedableInventoryItem = InventoryItem & { isArchived?: boolean };

const normalizeInventoryName = (value: string) => value.trim().toLowerCase().replace(/\s+/g, " ");

export function assertManualSeedAllowed(allowProductionSeed = false) {
  if (process.env.NODE_ENV === "production" && !allowProductionSeed) {
    throw new Error("Production seed/import is blocked. Export a backup and pass an explicit override before seeding.");
  }
}

export function addMissingInventorySeedItems(
  existingItems: SeedableInventoryItem[],
  options: { allowProductionSeed?: boolean } = {}
) {
  assertManualSeedAllowed(options.allowProductionSeed);

  const existingKeys = new Set(
    existingItems.flatMap((item) => [
      item.id,
      item.sku.trim().toLowerCase(),
      normalizeInventoryName(item.name)
    ])
  );

  const missingItems = seedInventoryItems
    .filter((seedItem) => {
      const keys = [
        seedItem.id,
        seedItem.sku.trim().toLowerCase(),
        normalizeInventoryName(seedItem.name)
      ];
      return keys.every((key) => !existingKeys.has(key));
    })
    .map((seedItem) => ({ ...seedItem, isArchived: false }));

  return [...existingItems, ...missingItems];
}
