"use client";

import React, { createContext, useContext, useState, useEffect } from "react";
import type {
  InventoryItem,
  Product,
  ProductBomLine,
  ProductionJob,
  StockTransaction,
  ActivityLog,
  Location
} from "@/types/domain";
import {
  inventoryItems as initialInventoryItems,
  products as initialProducts,
  productBomLines as initialProductBomLines,
  productionJobs as initialProductionJobs,
  stockTransactions as initialStockTransactions,
  activityLogs as initialActivityLogs,
  locations as initialLocations
} from "@/data/mock-data";
import {
  createInventoryItemInSupabase,
  importLocalInventoryToSupabase as importInventoryBackupToSupabase,
  InventorySupabaseError,
  isSupabaseConfigured,
  listInventoryItemsFromSupabase,
  updateInventoryItemInSupabase,
  type InventoryImportSummary
} from "@/lib/supabase/repositories/inventory";

interface AppContextType {
  inventoryItems: (InventoryItem & { isArchived?: boolean })[];
  products: Product[];
  productBomLines: ProductBomLine[];
  productionJobs: ProductionJob[];
  stockTransactions: StockTransaction[];
  activityLogs: ActivityLog[];
  locations: Location[];
  hydrated: boolean;
  inventorySource: "supabase" | "local";
  inventoryError: string | null;
  
  // Inventory actions
  addInventoryItem: (item: Omit<InventoryItem, "id" | "status">) => InventoryItem;
  updateInventoryItem: (id: string, updates: Partial<InventoryItem & { isArchived?: boolean }>) => void;
  archiveInventoryItem: (id: string) => void;
  duplicateInventoryItem: (id: string) => InventoryItem;
  deleteInventoryItem: (id: string) => void;
  refreshInventoryItems: () => Promise<void>;
  importLocalInventoryBackup: () => Promise<InventoryImportSummary>;
  exportInventoryBackup: () => string;
  
  // Product actions
  addProduct: (product: Omit<Product, "id">, bomLines: Omit<ProductBomLine, "id" | "productId">[]) => Product;
  updateProduct: (id: string, updates: Partial<Product>) => void;
  archiveProduct: (id: string) => void;
  duplicateProduct: (id: string) => Product;
  deleteProduct: (id: string) => void;
  
  // BOM actions
  updateProductBom: (productId: string, bomLines: Omit<ProductBomLine, "id" | "productId">[]) => void;
  
  // Production actions
  addProductionJob: (job: Omit<ProductionJob, "id" | "jobNumber">) => ProductionJob;
  updateProductionJob: (id: string, updates: Partial<ProductionJob>) => void;
  duplicateProductionJob: (id: string) => ProductionJob;
  archiveProductionJob: (id: string) => void;
  deleteProductionJob: (id: string) => void;
  moveProductionJobToProcess: (id: string) => { ok: boolean; shortages: { itemName: string; required: number; available: number; unit: string }[] };
  releaseJobMaterials: (jobId: string, itemReleases: { itemId: string; qty: number }[]) => void;
  completeProductionJob: (jobId: string, finishedGoodQtyMap?: Record<string, number> | number) => void;
  addCompoundToJob: (jobId: string, itemId: string, qty: number, reason?: string) => void;
  
  // General transactions and logging
  addStockTransaction: (txn: Omit<StockTransaction, "id" | "createdAt">) => void;
  addActivityLog: (log: Omit<ActivityLog, "id" | "createdAt">) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

const DEMO_DATA_ENABLED = process.env.NEXT_PUBLIC_ENABLE_DEMO_DATA === "true";

function safeParseArray<T>(value: string | null, fallback: T[]): T[] {
  if (!value) return fallback;
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function withDemoProductDefaults(product: Product): Product {
  return {
    ...product,
    brand: "Keeva",
    scent: product.id === "prod-lavender-gal" ? "Lavender" : "Ocean",
    family: product.id === "prod-lavender-gal" ? "Floral" : "Fresh",
    category: "Air Care",
    notes: "Initial seed product specification.",
    isArchived: false
  };
}

function formatInventorySupabaseError(error: unknown) {
  if (error instanceof InventorySupabaseError) {
    const parts = [
      `Supabase inventory failed to load. Table: ${error.info.table}.`,
      `Message: ${error.info.message}`,
      error.info.code ? `Code: ${error.info.code}` : null,
      error.info.details ? `Details: ${error.info.details}` : null,
      error.info.hint ? `Hint: ${error.info.hint}` : null
    ].filter(Boolean);
    return parts.join(" ");
  }

  if (error instanceof Error) return `Supabase inventory failed to load. ${error.message}`;
  return "Supabase inventory failed to load. Check database table or policy.";
}

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [hydrated, setHydrated] = useState(false);
  const [inventoryItems, setInventoryItems] = useState<(InventoryItem & { isArchived?: boolean })[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [productBomLines, setProductBomLines] = useState<ProductBomLine[]>([]);
  const [productionJobs, setProductionJobs] = useState<ProductionJob[]>([]);
  const [stockTransactions, setStockTransactions] = useState<StockTransaction[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLog[]>([]);
  const [locations] = useState<Location[]>(initialLocations);
  const [inventorySource, setInventorySource] = useState<"supabase" | "local">("local");
  const [inventoryError, setInventoryError] = useState<string | null>(null);

  // Hydrate persisted data only. Mock data is demo-only and must not replace stored records.
  useEffect(() => {
    let active = true;

    async function hydrateAppData() {
    const localInv = localStorage.getItem("prodstock_inventory");
    const localProd = localStorage.getItem("prodstock_products");
    const localBom = localStorage.getItem("prodstock_bom");
    const localJobs = localStorage.getItem("prodstock_jobs");
    const localTxns = localStorage.getItem("prodstock_txns");
    const localLogs = localStorage.getItem("prodstock_logs");

    setInventorySource(isSupabaseConfigured() ? "supabase" : "local");
    setProducts(safeParseArray(localProd, DEMO_DATA_ENABLED ? initialProducts.map(withDemoProductDefaults) : []));
    setProductBomLines(safeParseArray(localBom, DEMO_DATA_ENABLED ? initialProductBomLines : []));
    setProductionJobs(safeParseArray(localJobs, DEMO_DATA_ENABLED ? initialProductionJobs : []));
    setStockTransactions(safeParseArray(localTxns, DEMO_DATA_ENABLED ? initialStockTransactions : []));
    setActivityLogs(safeParseArray(localLogs, DEMO_DATA_ENABLED ? initialActivityLogs : []));

    if (isSupabaseConfigured()) {
      try {
        const result = await listInventoryItemsFromSupabase();
        if (!active) return;
        setInventoryItems(result.items);
        setInventoryError(null);
      } catch (error) {
        if (!active) return;
        console.error(formatInventorySupabaseError(error));
        setInventoryItems([]);
        setInventoryError(formatInventorySupabaseError(error));
      }
    } else {
      setInventoryItems(safeParseArray(localInv, DEMO_DATA_ENABLED ? initialInventoryItems : []));
      setInventoryError(null);
    }

    if (active) setHydrated(true);
    }

    void hydrateAppData();
    return () => {
      active = false;
    };
  }, []);

  // Save triggers
  useEffect(() => {
    if (hydrated && inventorySource === "local") {
      localStorage.setItem("prodstock_inventory", JSON.stringify(inventoryItems));
    }
  }, [inventoryItems, hydrated, inventorySource]);

  useEffect(() => {
    if (hydrated) {
      localStorage.setItem("prodstock_products", JSON.stringify(products));
    }
  }, [products, hydrated]);

  useEffect(() => {
    if (hydrated) {
      localStorage.setItem("prodstock_bom", JSON.stringify(productBomLines));
    }
  }, [productBomLines, hydrated]);

  useEffect(() => {
    if (hydrated) {
      localStorage.setItem("prodstock_jobs", JSON.stringify(productionJobs));
    }
  }, [productionJobs, hydrated]);

  useEffect(() => {
    if (hydrated) {
      localStorage.setItem("prodstock_txns", JSON.stringify(stockTransactions));
    }
  }, [stockTransactions, hydrated]);

  useEffect(() => {
    if (hydrated) {
      localStorage.setItem("prodstock_logs", JSON.stringify(activityLogs));
    }
  }, [activityLogs, hydrated]);

  const helperCalculateStatus = (quantity: number, reorderPoint: number): "critical" | "low" | "good" | "active" => {
    if (quantity <= reorderPoint * 0.5) return "critical";
    if (quantity <= reorderPoint) return "low";
    return "good";
  };

  const refreshInventoryItems = async () => {
    if (!isSupabaseConfigured()) return;
    try {
      const result = await listInventoryItemsFromSupabase();
      setInventoryItems(result.items);
      setInventoryError(null);
    } catch (error) {
      console.error(formatInventorySupabaseError(error));
      setInventoryError(formatInventorySupabaseError(error));
    }
  };

  const persistCreatedInventoryItem = (item: InventoryItem & { isArchived?: boolean }) => {
    if (inventorySource !== "supabase" || !isSupabaseConfigured()) return;
    void createInventoryItemInSupabase(item)
      .then((saved) => {
        setInventoryItems(prev => prev.map(entry => entry.id === item.id ? saved : entry));
        setInventoryError(null);
      })
      .catch((error) => {
        console.error(formatInventorySupabaseError(error));
        setInventoryItems(prev => prev.filter(entry => entry.id !== item.id));
        setInventoryError(formatInventorySupabaseError(error));
      });
  };

  const persistUpdatedInventoryItem = (
    id: string,
    updates: Partial<InventoryItem & { isArchived?: boolean }>,
    previousItems: (InventoryItem & { isArchived?: boolean })[]
  ) => {
    if (inventorySource !== "supabase" || !isSupabaseConfigured()) return;
    void updateInventoryItemInSupabase(id, updates)
      .then((saved) => {
        setInventoryItems(prev => prev.map(entry => entry.id === id ? saved : entry));
        setInventoryError(null);
      })
      .catch((error) => {
        console.error(formatInventorySupabaseError(error));
        setInventoryItems(previousItems);
        setInventoryError(formatInventorySupabaseError(error));
      });
  };

  // Inventory logic
  const addInventoryItem = (item: Omit<InventoryItem, "id" | "status">) => {
    const id = `item-${Math.random().toString(36).substring(2, 9)}`;
    const newItem: InventoryItem & { isArchived?: boolean } = {
      ...item,
      id,
      status: item.category === "asset" ? "active" : helperCalculateStatus(item.quantityOnHand, item.reorderPoint),
      isArchived: false
    };
    setInventoryItems(prev => [newItem, ...prev]);
    persistCreatedInventoryItem(newItem);
    
    // Add transaction and log
    addStockTransaction({
      inventoryItemId: id,
      type: "stock_in",
      quantity: item.quantityOnHand,
      unit: item.unit,
      reason: "Initial inventory setup"
    });
    
    addActivityLog({
      actorName: "Mara Santos",
      action: `Created inventory item ${newItem.name} (${newItem.sku})`,
      entityType: "inventory_item",
      entityId: id
    });
    
    return newItem;
  };

  const updateInventoryItem = (id: string, updates: Partial<InventoryItem & { isArchived?: boolean }>) => {
    const previousItems = inventoryItems;
    setInventoryItems(prev => prev.map(item => {
      if (item.id === id) {
        const nextQty = updates.quantityOnHand !== undefined ? updates.quantityOnHand : item.quantityOnHand;
        const nextReorder = updates.reorderPoint !== undefined ? updates.reorderPoint : item.reorderPoint;
        const nextStatus = item.category === "asset" ? "active" : helperCalculateStatus(nextQty, nextReorder);
        return {
          ...item,
          ...updates,
          status: nextStatus
        };
      }
      return item;
    }));
    const currentItem = inventoryItems.find(item => item.id === id);
    const nextQty = updates.quantityOnHand !== undefined ? updates.quantityOnHand : currentItem?.quantityOnHand;
    const nextReorder = updates.reorderPoint !== undefined ? updates.reorderPoint : currentItem?.reorderPoint;
    const nextStatus = currentItem && nextQty !== undefined && nextReorder !== undefined
      ? currentItem.category === "asset" ? "active" : helperCalculateStatus(nextQty, nextReorder)
      : updates.status;
    persistUpdatedInventoryItem(id, nextStatus ? { ...updates, status: nextStatus } : updates, previousItems);

    if (updates.unitCost !== undefined) {
      addActivityLog({
        actorName: "Mara Santos",
        action: `Edited unit cost for item ID ${id} to ${updates.unitCost}`,
        entityType: "inventory_item",
        entityId: id
      });
    } else {
      addActivityLog({
        actorName: "Mara Santos",
        action: `Updated inventory item attributes for item ID ${id}`,
        entityType: "inventory_item",
        entityId: id
      });
    }
  };

  const archiveInventoryItem = (id: string) => {
    const previousItems = inventoryItems;
    setInventoryItems(prev => prev.map(item => {
      if (item.id === id) return { ...item, isArchived: true };
      return item;
    }));
    persistUpdatedInventoryItem(id, { isArchived: true }, previousItems);
    
    addActivityLog({
      actorName: "Mara Santos",
      action: `Archived inventory item ID ${id}`,
      entityType: "inventory_item",
      entityId: id
    });
  };

  const duplicateInventoryItem = (id: string) => {
    const original = inventoryItems.find(item => item.id === id);
    if (!original) throw new Error("Original item not found");
    
    const newId = `item-${Math.random().toString(36).substring(2, 9)}`;
    const newSku = `${original.sku}-COPY`;
    const newName = `${original.name} Copy`;
    
    const duplicate: InventoryItem & { isArchived?: boolean } = {
      ...original,
      id: newId,
      sku: newSku,
      name: newName,
      quantityOnHand: 0,
      status: original.category === "asset" ? "active" : "critical",
      isArchived: false
    };
    
    setInventoryItems(prev => [duplicate, ...prev]);
    persistCreatedInventoryItem(duplicate);
    
    addActivityLog({
      actorName: "Mara Santos",
      action: `Duplicated item ${original.name} into ${newName}`,
      entityType: "inventory_item",
      entityId: newId
    });
    
    return duplicate;
  };

  const deleteInventoryItem = (id: string) => {
    if (inventorySource === "supabase") {
      archiveInventoryItem(id);
      addActivityLog({
        actorName: "Mara Santos",
        action: `Permanent delete disabled for Supabase inventory. Archived item ID ${id} instead`,
        entityType: "inventory_item",
        entityId: id
      });
      return;
    }

    setInventoryItems(prev => prev.filter(item => item.id !== id));
    
    addActivityLog({
      actorName: "Mara Santos",
      action: `Permanently deleted inventory item ID ${id}`,
      entityType: "inventory_item",
      entityId: id
    });
  };

  const exportInventoryBackup = () => {
    const backup = {
      app: "NORTHVALE INV",
      type: "inventory-local-backup",
      version: 1,
      exportedAt: new Date().toISOString(),
      items: safeParseArray<InventoryItem & { isArchived?: boolean }>(
        localStorage.getItem("prodstock_inventory"),
        []
      )
    };
    return JSON.stringify(backup, null, 2);
  };

  const importLocalInventoryBackup = async () => {
    const localItems = safeParseArray<InventoryItem & { isArchived?: boolean }>(
      localStorage.getItem("prodstock_inventory"),
      []
    );
    const summary = await importInventoryBackupToSupabase(localItems);
    await refreshInventoryItems();
    addActivityLog({
      actorName: "Admin",
      action: `Imported local inventory backup: ${summary.added} added, ${summary.skipped} skipped, ${summary.updated} updated`,
      entityType: "inventory_item",
      entityId: "inventory-import"
    });
    return summary;
  };

  // Product Logic
  const addProduct = (product: Omit<Product, "id">, bom: Omit<ProductBomLine, "id" | "productId">[]) => {
    const id = `prod-${Math.random().toString(36).substring(2, 9)}`;
    
    // Check if dynamic finished good item needs to be created or linked
    let finishedGoodItemId = product.finishedGoodItemId;
    if (!finishedGoodItemId) {
      const item = addInventoryItem({
        sku: product.sku,
        name: product.name,
        category: "finished",
        unit: product.outputUnit,
        quantityOnHand: 0,
        reorderPoint: 10,
        locationId: "loc-a3",
        unitCost: 0
      });
      finishedGoodItemId = item.id;
    }

    const newProduct: Product = {
      ...product,
      id,
      finishedGoodItemId,
      isArchived: false
    };
    
    setProducts(prev => [newProduct, ...prev]);

    // Create BOM lines
    const linesToInsert: ProductBomLine[] = bom.map(line => ({
      ...line,
      id: `bom-${Math.random().toString(36).substring(2, 9)}`,
      productId: id
    }));
    
    setProductBomLines(prev => [...prev, ...linesToInsert]);

    addActivityLog({
      actorName: "Mara Santos",
      action: `Product created: ${product.name} (${product.sku})`,
      entityType: "product",
      entityId: id
    });

    return newProduct;
  };

  const updateProduct = (id: string, updates: Partial<Product>) => {
    setProducts(prev => prev.map(p => {
      if (p.id === id) {
        return { ...p, ...updates };
      }
      return p;
    }));

    addActivityLog({
      actorName: "Mara Santos",
      action: `Product edited: ID ${id}`,
      entityType: "product",
      entityId: id
    });
  };

  const archiveProduct = (id: string) => {
    setProducts(prev => prev.map(p => {
      if (p.id === id) return { ...p, isArchived: true };
      return p;
    }));

    // Soft archive the linked finished good item as well
    const product = products.find(p => p.id === id);
    if (product?.finishedGoodItemId) {
      archiveInventoryItem(product.finishedGoodItemId);
    }

    addActivityLog({
      actorName: "Mara Santos",
      action: `Product archived: ID ${id}`,
      entityType: "product",
      entityId: id
    });
  };

  const duplicateProduct = (id: string) => {
    const original = products.find(p => p.id === id);
    if (!original) throw new Error("Original product not found");

    const newId = `prod-${Math.random().toString(36).substring(2, 9)}`;
    const newSku = `${original.sku}-COPY`;
    const newName = `${original.name} Copy`;

    let dupFinishedGoodItemId = "";
    if (original.finishedGoodItemId) {
      try {
        const dupItem = duplicateInventoryItem(original.finishedGoodItemId);
        dupFinishedGoodItemId = dupItem.id;
      } catch {
        dupFinishedGoodItemId = `item-${Math.random().toString(36).substring(2, 9)}`;
      }
    }

    const duplicate: Product = {
      ...original,
      id: newId,
      sku: newSku,
      name: newName,
      brand: original.brand ? `${original.brand} Copy` : undefined,
      finishedGoodItemId: dupFinishedGoodItemId,
      isArchived: false
    };

    setProducts(prev => [duplicate, ...prev]);

    // Copy BOM lines
    const originalBomLines = productBomLines.filter(line => line.productId === id);
    const duplicatedBomLines = originalBomLines.map(line => ({
      ...line,
      id: `bom-${Math.random().toString(36).substring(2, 9)}`,
      productId: newId
    }));
    setProductBomLines(prev => [...prev, ...duplicatedBomLines]);

    addActivityLog({
      actorName: "Mara Santos",
      action: `Product duplicated: ${original.name} to ${newName}`,
      entityType: "product",
      entityId: newId
    });

    return duplicate;
  };

  const deleteProduct = (id: string) => {
    setProducts(prev => prev.filter(p => p.id !== id));
    setProductBomLines(prev => prev.filter(line => line.productId !== id));

    addActivityLog({
      actorName: "Mara Santos",
      action: `Product deleted permanently: ID ${id}`,
      entityType: "product",
      entityId: id
    });
  };

  // BOM Actions
  const updateProductBom = (productId: string, bomLines: Omit<ProductBomLine, "id" | "productId">[]) => {
    // Delete existing bom lines for this product and insert new ones
    setProductBomLines(prev => {
      const filtered = prev.filter(line => line.productId !== productId);
      const newLines = bomLines.map(line => ({
        ...line,
        id: `bom-${Math.random().toString(36).substring(2, 9)}`,
        productId
      }));
      return [...filtered, ...newLines];
    });

    // Detect which line was added, edited, or deleted for logging
    const oldLinesCount = productBomLines.filter(line => line.productId === productId).length;
    const newLinesCount = bomLines.length;

    let logMessage = `BOM specifications updated for product ID ${productId}`;
    if (newLinesCount > oldLinesCount) {
      logMessage = `BOM line added to product ID ${productId}`;
    } else if (newLinesCount < oldLinesCount) {
      logMessage = `BOM line deleted from product ID ${productId}`;
    } else if (newLinesCount > 0) {
      logMessage = `BOM line edited for product ID ${productId}`;
    }

    addActivityLog({
      actorName: "Mara Santos",
      action: logMessage,
      entityType: "product",
      entityId: productId
    });
  };

  // Production Logic
  const addProductionJob = (job: Omit<ProductionJob, "id" | "jobNumber">) => {
    const id = `job-${Math.random().toString(36).substring(2, 9)}`;
    const jobNumber = `PRD-2026-${Math.floor(100 + Math.random() * 900)}`;
    const newJob: ProductionJob = {
      ...job,
      id,
      jobNumber,
      status: job.status || "draft",
      createdAt: job.createdAt ?? new Date().toISOString()
    };

    setProductionJobs(prev => [newJob, ...prev]);

    // Log product line additions
    if (newJob.productLines && newJob.productLines.length > 0) {
      newJob.productLines.forEach(line => {
        const prod = products.find(p => p.id === line.productId);
        addActivityLog({
          actorName: "Mara Santos",
          action: `Product added to production plan: ${prod?.name ?? "Unknown"} (${line.plannedBatchQty} batches) in ${jobNumber}`,
          entityType: "production_job",
          entityId: id
        });
      });
    } else {
      const prod = products.find(p => p.id === job.productId);
      addActivityLog({
        actorName: "Mara Santos",
        action: `Product added to production plan: ${prod?.name ?? "Unknown"} (${job.plannedBatchQty} batches) in ${jobNumber}`,
        entityType: "production_job",
        entityId: id
      });
    }

    // Log manual material additions
    if (newJob.additionalMaterials && newJob.additionalMaterials.length > 0) {
      newJob.additionalMaterials.forEach(mat => {
        const item = inventoryItems.find(i => i.id === mat.inventoryItemId);
        addActivityLog({
          actorName: "Mara Santos",
          action: `Manual material added to plan: ${item?.name ?? "Unknown"} (${mat.quantity} ${mat.unit}) in ${jobNumber}`,
          entityType: "production_job",
          entityId: id
        });
      });
    }

    addActivityLog({
      actorName: "Mara Santos",
      action: `Created production job ${jobNumber}`,
      entityType: "production_job",
      entityId: id
    });

    return newJob;
  };

  const updateProductionJob = (id: string, updates: Partial<ProductionJob>) => {
    setProductionJobs(prev => prev.map(job => {
      if (job.id === id) {
        return {
          ...job,
          ...updates
        };
      }
      return job;
    }));

    addActivityLog({
      actorName: "Mara Santos",
      action: `Updated production job status/details for job ID ${id}`,
      entityType: "production_job",
      entityId: id
    });
  };

  const getProductionRequirements = (job: ProductionJob) => {
    const productLines = job.productLines && job.productLines.length > 0
      ? job.productLines
      : [{ productId: job.productId, plannedBatchQty: job.plannedBatchQty }];

    const requirements: Record<string, { required: number; unit: string }> = {};

    productLines.forEach(line => {
      productBomLines
        .filter(bom => bom.productId === line.productId && bom.inventoryItemId)
        .forEach(bom => {
          const itemId = bom.inventoryItemId as string;
          const wastage = bom.wastagePercent ? 1 + bom.wastagePercent / 100 : 1;
          if (!requirements[itemId]) {
            requirements[itemId] = { required: 0, unit: bom.unit || "kg" };
          }
          requirements[itemId].required += bom.quantityPerBatch * line.plannedBatchQty * wastage;
        });
    });

    job.additionalMaterials?.forEach(mat => {
      if (!requirements[mat.inventoryItemId]) {
        requirements[mat.inventoryItemId] = { required: 0, unit: mat.unit };
      }
      requirements[mat.inventoryItemId].required += mat.quantity;
    });

    return Object.entries(requirements).map(([itemId, data]) => ({
      itemId,
      required: data.required,
      unit: data.unit
    }));
  };

  const duplicateProductionJob = (id: string) => {
    const original = productionJobs.find(job => job.id === id);
    if (!original) throw new Error("Original production job not found");

    const newId = `job-${Math.random().toString(36).substring(2, 9)}`;
    const duplicate: ProductionJob = {
      ...original,
      id: newId,
      jobNumber: `PRD-2026-${Math.floor(100 + Math.random() * 900)}`,
      status: "draft",
      completedAt: undefined,
      startedAt: undefined,
      createdAt: new Date().toISOString(),
      isNew: true,
      isArchived: false,
      dueDate: original.dueDate ?? original.scheduledFor,
      referenceNote: original.referenceNote ?? `Custom order ${original.jobNumber} Copy`,
      notes: original.notes ? `${original.notes} Copy` : "Duplicated production plan draft.",
      productLines: original.productLines ? original.productLines.map(line => ({ ...line })) : undefined,
      additionalMaterials: original.additionalMaterials ? original.additionalMaterials.map(mat => ({ ...mat })) : undefined
    };

    setProductionJobs(prev => [duplicate, ...prev]);
    addActivityLog({
      actorName: "Admin",
      action: `Production plan duplicated as draft from ${original.jobNumber}`,
      entityType: "production_job",
      entityId: newId
    });

    return duplicate;
  };

  const archiveProductionJob = (id: string) => {
    const job = productionJobs.find(entry => entry.id === id);
    setProductionJobs(prev => prev.map(entry => (
      entry.id === id ? { ...entry, isArchived: true } : entry
    )));

    addActivityLog({
      actorName: "Admin",
      action: `Plan ${job?.jobNumber ?? id} archived`,
      entityType: "production_job",
      entityId: id
    });
  };

  const deleteProductionJob = (id: string) => {
    const job = productionJobs.find(entry => entry.id === id);
    setProductionJobs(prev => prev.map(entry => (
      entry.id === id ? { ...entry, isArchived: true } : entry
    )));

    addActivityLog({
      actorName: "Admin",
      action: `Permanent delete disabled. Plan ${job?.jobNumber ?? id} archived instead`,
      entityType: "production_job",
      entityId: id
    });
  };

  const moveProductionJobToProcess = (id: string) => {
    const job = productionJobs.find(entry => entry.id === id);
    if (!job) return { ok: false, shortages: [] };
    if (job.status === "to_process" || job.status === "completed") return { ok: true, shortages: [] };

    const requirements = getProductionRequirements(job);
    const shortages = requirements
      .map(req => {
        const item = inventoryItems.find(entry => entry.id === req.itemId);
        return {
          itemName: item?.name ?? "Unknown material",
          required: req.required,
          available: item?.quantityOnHand ?? 0,
          unit: item?.unit ?? req.unit
        };
      })
      .filter(req => req.available < req.required);

    if (shortages.length > 0) return { ok: false, shortages };

    setInventoryItems(prev => prev.map(item => {
      const req = requirements.find(entry => entry.itemId === item.id);
      if (!req) return item;
      const nextQty = Math.max(0, item.quantityOnHand - req.required);
      return {
        ...item,
        quantityOnHand: nextQty,
        status: item.category === "asset" ? "active" : helperCalculateStatus(nextQty, item.reorderPoint)
      };
    }));

    requirements.forEach(req => {
      const item = inventoryItems.find(entry => entry.id === req.itemId);
      if (!item) return;
      const afterQuantity = Math.max(0, item.quantityOnHand - req.required);

      addStockTransaction({
        inventoryItemId: item.id,
        type: "production_release",
        quantity: req.required,
        unit: item.unit,
        productionJobId: id,
        reference: id,
        beforeQuantity: item.quantityOnHand,
        afterQuantity,
        reason: `Released ${item.name} for production plan ${job.jobNumber}`
      });

      addActivityLog({
        actorName: "Admin",
        action: `Released ${item.name} ${req.required} ${item.unit} for Production Plan ${job.jobNumber}`,
        entityType: "production_job",
        entityId: id
      });
    });

    setProductionJobs(prev => prev.map(entry => (
      entry.id === id ? { ...entry, status: "to_process", startedAt: entry.startedAt ?? new Date().toISOString() } : entry
    )));

    addActivityLog({
      actorName: "Admin",
      action: `Moved production plan ${job.jobNumber} to To Process`,
      entityType: "production_job",
      entityId: id
    });

    return { ok: true, shortages: [] };
  };

  const releaseJobMaterials = (jobId: string, itemReleases: { itemId: string; qty: number }[]) => {
    const job = productionJobs.find(j => j.id === jobId);
    if (!job) return;

    // We deduct inventory quantities and add stock transactions
    setInventoryItems(prev => prev.map(item => {
      const release = itemReleases.find(r => r.itemId === item.id);
      if (release) {
        const nextQty = Math.max(0, item.quantityOnHand - release.qty);
        return {
          ...item,
          quantityOnHand: nextQty,
          status: item.category === "asset" ? "active" : helperCalculateStatus(nextQty, item.reorderPoint)
        };
      }
      return item;
    }));

    // Record stock transactions
    itemReleases.forEach(release => {
      const item = inventoryItems.find(i => i.id === release.itemId);
      if (item) {
        addStockTransaction({
          inventoryItemId: release.itemId,
          type: "production_consume",
          quantity: release.qty,
          unit: item.unit,
          productionJobId: jobId,
          reason: `Released materials for production ${job.jobNumber}`
        });
      }
    });

    addActivityLog({
      actorName: "Mara Santos",
      action: `Released raw materials for job ${job.jobNumber}`,
      entityType: "production_job",
      entityId: jobId
    });
  };

  const completeProductionJob = (jobId: string, finishedGoodQtyMap?: Record<string, number> | number) => {
    const job = productionJobs.find(j => j.id === jobId);
    if (!job) return;

    // 1. Mark the job completed
    updateProductionJob(jobId, {
      status: "completed",
      completedAt: new Date().toISOString(),
      startedAt: job.startedAt ?? new Date().toISOString()
    });

    // 2. Increase finished goods inventory for each product line
    if (job.productLines && job.productLines.length > 0) {
      job.productLines.forEach(line => {
        const product = products.find(p => p.id === line.productId);
        if (!product) return;

        let qty = product.batchSize * line.plannedBatchQty;
        if (finishedGoodQtyMap && typeof finishedGoodQtyMap === "object") {
          qty = finishedGoodQtyMap[product.id] !== undefined ? finishedGoodQtyMap[product.id] : qty;
        }

        setInventoryItems(prev => prev.map(item => {
          if (item.id === product.finishedGoodItemId) {
            const nextQty = item.quantityOnHand + qty;
            return {
              ...item,
              quantityOnHand: nextQty,
              status: helperCalculateStatus(nextQty, item.reorderPoint)
            };
          }
          return item;
        }));

        const fgItem = inventoryItems.find(i => i.id === product.finishedGoodItemId);
        if (fgItem) {
          addStockTransaction({
            inventoryItemId: product.finishedGoodItemId,
            type: "production_output",
            quantity: qty,
            unit: fgItem.unit,
            productionJobId: jobId,
            reason: `Production output completed for ${job.jobNumber}`
          });
        }
      });
    } else {
      // Fallback for single product jobs
      const product = products.find(p => p.id === job.productId);
      if (!product) return;

      let qty = product.batchSize * job.plannedBatchQty;
      if (typeof finishedGoodQtyMap === "number") {
        qty = finishedGoodQtyMap;
      }

      setInventoryItems(prev => prev.map(item => {
        if (item.id === product.finishedGoodItemId) {
          const nextQty = item.quantityOnHand + qty;
          return {
            ...item,
            quantityOnHand: nextQty,
            status: helperCalculateStatus(nextQty, item.reorderPoint)
          };
        }
        return item;
      }));

      const fgItem = inventoryItems.find(i => i.id === product.finishedGoodItemId);
      if (fgItem) {
        addStockTransaction({
          inventoryItemId: product.finishedGoodItemId,
          type: "production_output",
          quantity: qty,
          unit: fgItem.unit,
          productionJobId: jobId,
          reason: `Production output completed for ${job.jobNumber}`
        });
      }
    }

    addActivityLog({
      actorName: "Mara Santos",
      action: `Completed job ${job.jobNumber}`,
      entityType: "production_job",
      entityId: jobId
    });
  };

  const addCompoundToJob = (jobId: string, itemId: string, qty: number, reason: string = "Additional material requirement") => {
    const job = productionJobs.find(j => j.id === jobId);
    if (!job) return;
    const item = inventoryItems.find(i => i.id === itemId);
    if (!item) return;

    // Deduct inventory
    setInventoryItems(prev => prev.map(invItem => {
      if (invItem.id === itemId) {
        const nextQty = Math.max(0, invItem.quantityOnHand - qty);
        return {
          ...invItem,
          quantityOnHand: nextQty,
          status: invItem.category === "asset" ? "active" : helperCalculateStatus(nextQty, invItem.reorderPoint)
        };
      }
      return invItem;
    }));

    // Add transaction
    addStockTransaction({
      inventoryItemId: itemId,
      type: "production_consume",
      quantity: qty,
      unit: item.unit,
      productionJobId: jobId,
      reason: `Extra ingredient release: ${reason}`
    });

    addActivityLog({
      actorName: "Mara Santos",
      action: `Manual material added: ${qty} ${item.unit} of ${item.name} to job ${job.jobNumber}`,
      entityType: "production_job",
      entityId: jobId
    });
  };

  // Add stock transaction helper
  const addStockTransaction = (txn: Omit<StockTransaction, "id" | "createdAt">) => {
    const newTxn: StockTransaction = {
      ...txn,
      id: `txn-${Math.random().toString(36).substring(2, 9)}`,
      createdAt: new Date().toISOString()
    };
    setStockTransactions(prev => [newTxn, ...prev]);
  };

  // Add activity log helper
  const addActivityLog = (log: Omit<ActivityLog, "id" | "createdAt">) => {
    const newLog: ActivityLog = {
      ...log,
      id: `act-${Math.random().toString(36).substring(2, 9)}`,
      createdAt: new Date().toISOString()
    };
    setActivityLogs(prev => [newLog, ...prev]);
  };

  return (
    <AppContext.Provider
      value={{
        inventoryItems,
        products,
        productBomLines,
        productionJobs,
        stockTransactions,
        activityLogs,
        locations,
        hydrated,
        inventorySource,
        inventoryError,
        addInventoryItem,
        updateInventoryItem,
        archiveInventoryItem,
        duplicateInventoryItem,
        deleteInventoryItem,
        refreshInventoryItems,
        importLocalInventoryBackup,
        exportInventoryBackup,
        addProduct,
        updateProduct,
        archiveProduct,
        duplicateProduct,
        deleteProduct,
        updateProductBom,
        addProductionJob,
        updateProductionJob,
        duplicateProductionJob,
        archiveProductionJob,
        deleteProductionJob,
        moveProductionJobToProcess,
        releaseJobMaterials,
        completeProductionJob,
        addCompoundToJob,
        addStockTransaction,
        addActivityLog
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const context = useContext(AppContext);
  if (context === undefined) {
    throw new Error("useApp must be used within an AppProvider");
  }
  return context;
}
