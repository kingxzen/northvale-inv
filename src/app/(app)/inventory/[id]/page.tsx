"use client";

import { use, useId, useMemo, useRef, useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useApp } from "@/context/app-context";
import {
  ArrowLeft,
  MapPin,
  Edit3,
  ArrowDownToLine,
  ArrowUpFromLine,
  Sliders,
  Archive,
  Copy,
  Trash2,
  X,
  Plus,
  GitBranch,
  Info,
  DollarSign,
  AlertTriangle,
  FileText,
  UserCheck,
  Zap,
  Trash,
  Search,
  PackagePlus
} from "lucide-react";
import { formatMoney, cn } from "@/lib/utils";
import type { Product, ProductBomLine, InventoryUnit } from "@/types/domain";
import { canConvertUnit, convertUnit } from "@/lib/units";
import {
  estimateBomCost,
  getMasterBoms,
  getProductBomAssignments,
  saveProductBomAssignments,
  type MasterBom
} from "@/lib/operations-store";
import {
  formatSupabaseOperationalError,
  listMasterBomsFromSupabase
} from "@/lib/supabase/repositories/bom-packing";

export default function InventoryItemDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editBOMParam = searchParams.get("editBOM") === "true";
  const resolvedParams = use(params);
  const id = resolvedParams.id;

  const {
    inventoryItems,
    locations,
    stockTransactions,
    products,
    productBomLines,
    updateInventoryItem,
    archiveInventoryItem,
    duplicateInventoryItem,
    deleteInventoryItem,
    addInventoryItem,
    addProduct,
    updateProduct,
    archiveProduct,
    duplicateProduct,
    deleteProduct,
    updateProductBom,
    addActivityLog
  } = useApp();

  // Map 'sles' to the actual item id 'item-sles'
  const itemId = id === "sles" ? "item-sles" : id;
  
  const item = useMemo(() => inventoryItems.find((i) => i.id === itemId), [inventoryItems, itemId]);
  const location = useMemo(() => locations.find((l) => l.id === item?.locationId), [locations, item]);

  // Filter transactions for this item
  const transactions = useMemo(() => 
    stockTransactions.filter((txn) => txn.inventoryItemId === itemId),
    [stockTransactions, itemId]
  );

  // Find linked product by finishedGoodItemId
  const product = useMemo(() => 
    products.find((p) => p.finishedGoodItemId === itemId),
    [products, itemId]
  );

  // BOM lines for this product
  const bomLines = useMemo(() => 
    product ? productBomLines.filter((line) => line.productId === product.id) : [],
    [productBomLines, product]
  );

  // History logs specific to this item or product
  const activityHistory = useMemo(() => {
    const itemLogs = useMemo; // local placeholder
    const list = useMemo; // local placeholder
    return []; // We will render logs directly from context and item ID
  }, []);

  // Local Modal States
  const [isArchiveOpen, setIsArchiveOpen] = useState(false);
  const [isDuplicateOpen, setIsDuplicateOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  
  // Product Modals
  const [isEditProductOpen, setIsEditProductOpen] = useState(false);
  const [isEditBOMOpen, setIsEditBOMOpen] = useState(editBOMParam);
  const [isCopyBOMOpen, setIsCopyBOMOpen] = useState(false);
  
  // Edit Product Profile States
  const [editBrand, setEditBrand] = useState("");
  const [editCode, setEditCode] = useState("");
  const [editName, setEditName] = useState("");
  const [editScent, setEditScent] = useState("");
  const [editFamily, setEditFamily] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editBatchSize, setEditBatchSize] = useState(100);
  const [editOutputUnit, setEditOutputUnit] = useState("pcs");
  const [editNotes, setEditNotes] = useState("");

  // Edit Item Unit Cost State
  const [isEditUnitCostOpen, setIsEditUnitCostOpen] = useState(false);
  const [newUnitCost, setNewUnitCost] = useState("");

  // Edit BOM States
  const [bomBatchSize, setBomBatchSize] = useState(100);
  const [bomOutputUnit, setBomOutputUnit] = useState("pcs");
  const [tempBomLines, setTempBomLines] = useState<Omit<ProductBomLine, "id" | "productId">[]>([]);
  
  // Add BOM Line Sub-form state
  const [isAddingLine, setIsAddingLine] = useState(false);
  const [subFormType, setSubFormType] = useState<"raw_material" | "packaging" | "manpower" | "other_cost">("raw_material");
  const [bomItemId, setBomItemId] = useState("");
  const [bomQty, setBomQty] = useState("");
  const [bomUnit, setBomUnit] = useState("");
  const [bomCostOverride, setBomCostOverride] = useState("");
  const [bomWastage, setBomWastage] = useState("");
  const [bomNotes, setBomNotes] = useState("");
  const [showDuplicateWarning, setShowDuplicateWarning] = useState(false);
  const [bomSearch, setBomSearch] = useState("");
  const [isQuickAddOpen, setIsQuickAddOpen] = useState(false);
  const [quickItemName, setQuickItemName] = useState("");
  const [quickItemType, setQuickItemType] = useState<"raw" | "packaging" | "asset">("raw");
  const [quickItemUnit, setQuickItemUnit] = useState<InventoryUnit>("kg");
  const [quickItemCost, setQuickItemCost] = useState("");
  const [quickItemArea, setQuickItemArea] = useState("");

  // Edit single BOM Line state
  const [editingLineIndex, setEditingLineIndex] = useState<number | null>(null);
  const [deleteLineIndex, setDeleteLineIndex] = useState<number | null>(null);

  // Copy BOM States
  const [copySourceProductId, setCopySourceProductId] = useState("");
  const [copyMethod, setCopyMethod] = useState<"replace" | "append">("replace");
  const [masterBoms, setMasterBoms] = useState<MasterBom[]>([]);
  const [masterBomLoadError, setMasterBomLoadError] = useState<string | null>(null);
  const [isLoadingMasterBoms, setIsLoadingMasterBoms] = useState(false);
  const [bomAssignments, setBomAssignments] = useState(getProductBomAssignments());
  const [selectedMasterBomId, setSelectedMasterBomId] = useState("");
  const [masterBomSearch, setMasterBomSearch] = useState("");
  const [isChangeMasterBomOpen, setIsChangeMasterBomOpen] = useState(false);

  // Alert Banner State
  const [banner, setBanner] = useState<{ message: string; type: "success" | "info" | "error" } | null>(null);

  // Sync state for Product specs & BOM editor
  useEffect(() => {
    if (product) {
      setEditBrand(product.brand ?? "Keeva");
      setEditCode(product.sku);
      setEditName(product.name);
      setEditScent(product.scent ?? "");
      setEditFamily(product.family ?? "Floral");
      setEditCategory(product.category ?? "Air Care");
      setEditBatchSize(product.batchSize);
      setEditOutputUnit(product.outputUnit);
      setEditNotes(product.notes ?? "");

      setBomBatchSize(product.batchSize);
      setBomOutputUnit(product.outputUnit);
      setTempBomLines(bomLines.map(({ inventoryItemId, quantityPerBatch, unit, lineType, costOverride, wastagePercent, notes }) => ({
        inventoryItemId,
        quantityPerBatch,
        unit,
        lineType,
        costOverride,
        wastagePercent,
        notes
      })));
    }
  }, [product, bomLines, isEditBOMOpen]);

  useEffect(() => {
    let active = true;
    async function loadMasterBoms() {
      setIsLoadingMasterBoms(true);
      setMasterBomLoadError(null);
      try {
        const boms = await listMasterBomsFromSupabase();
        if (!active) return;
        const assignments = getProductBomAssignments();
        setMasterBoms(boms);
        setBomAssignments(assignments);
        if (product) {
          const current = assignments.find(entry => entry.productId === product.id);
          setSelectedMasterBomId(current?.bomId ?? boms.find(bom => bom.status === "active")?.id ?? "");
        }
      } catch (error) {
        if (!active) return;
        const fallbackBoms = getMasterBoms();
        const assignments = getProductBomAssignments();
        setMasterBoms(fallbackBoms);
        setBomAssignments(assignments);
        setMasterBomLoadError(`${formatSupabaseOperationalError(error)} Showing local fallback only.`);
        if (product) {
          const current = assignments.find(entry => entry.productId === product.id);
          setSelectedMasterBomId(current?.bomId ?? fallbackBoms.find(bom => bom.status === "active")?.id ?? "");
        }
      } finally {
        if (active) setIsLoadingMasterBoms(false);
      }
    }
    void loadMasterBoms();
    return () => {
      active = false;
    };
  }, [product]);

  useEffect(() => {
    const activeBoms = masterBoms.filter(bom => bom.status === "active");
    if (activeBoms.length > 0 && !activeBoms.some(bom => bom.id === selectedMasterBomId)) {
      setSelectedMasterBomId(activeBoms[0].id);
    }
  }, [masterBoms, selectedMasterBomId]);

  useEffect(() => {
    const assignments = getProductBomAssignments();
    setBomAssignments(assignments);
  }, [product]);

  if (!item) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-error text-headline-md font-semibold">Item not found</p>
          <p className="text-on-surface-variant text-body-md mt-2">The inventory item you are looking for does not exist.</p>
          <Button className="mt-5" asChild>
            <Link href="/inventory">Back to Inventory</Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  const isFinishedGood = item.category === "finished";

  // Trigger banner auto-dismissal
  const triggerBanner = (message: string, type: "success" | "info" | "error" = "success") => {
    setBanner({ message, type });
    setTimeout(() => setBanner(null), 4000);
  };

  // Resolve BOM Status
  const bomStatus = () => {
    if (bomLines.length === 0) return { label: "No BOM yet", tone: "critical" };
    const hasRaw = bomLines.some(l => l.lineType === "raw_material");
    const hasPkg = bomLines.some(l => l.lineType === "packaging");
    if (hasRaw && hasPkg) return { label: "BOM complete", tone: "good" };
    return { label: "Partial BOM", tone: "low" };
  };

  const unitOptions: InventoryUnit[] = ["kg", "g", "liter", "ml", "gallon", "pcs"];

  const calculateLineCost = (line: Omit<ProductBomLine, "id" | "productId">) => {
    if (line.lineType === "manpower" || line.lineType === "other_cost") {
      if (typeof line.costOverride !== "number") return { cost: 0, missing: true, incompatible: false };
      return { cost: line.costOverride * line.quantityPerBatch, missing: false, incompatible: false };
    }

    const matched = inventoryItems.find(i => i.id === line.inventoryItemId);
    if (!matched || typeof matched.unitCost !== "number") {
      return { cost: 0, missing: true, incompatible: false };
    }

    const fromUnit = (line.unit ?? matched.unit) as InventoryUnit;
    if (!canConvertUnit(fromUnit, matched.unit)) {
      return { cost: 0, missing: true, incompatible: true };
    }

    return {
      cost: convertUnit(line.quantityPerBatch, fromUnit, matched.unit) * matched.unitCost,
      missing: false,
      incompatible: false
    };
  };

  const calculateTotals = (lines = tempBomLines) => {
    return lines.reduce(
      (acc, line) => {
        const lineCost = calculateLineCost(line);
        acc[line.lineType] += lineCost.cost;
        acc.total += lineCost.cost;
        if (lineCost.missing || lineCost.incompatible) acc.hasMissing = true;
        return acc;
      },
      { raw_material: 0, packaging: 0, manpower: 0, other_cost: 0, total: 0, hasMissing: false }
    );
  };

  const calculateTotalBOMCost = () => calculateTotals(bomLines).total;

  // 1. Save Product Details
  const handleSaveProductProfile = () => {
    if (!product) return;
    const combinedName = `${editBrand} ${editName} ${editScent}`.trim();
    updateProduct(product.id, {
      brand: editBrand,
      sku: editCode,
      name: combinedName || editName,
      scent: editScent,
      family: editFamily,
      category: editCategory,
      batchSize: editBatchSize,
      outputUnit: editOutputUnit as any,
      notes: editNotes
    });
    setIsEditProductOpen(false);
    triggerBanner("Product profile specifications updated.");
  };

  // 2. Duplicate Product
  const handleDuplicateProduct = () => {
    if (!product) return;
    const dup = duplicateProduct(product.id);
    setIsDuplicateOpen(false);
    triggerBanner(`Product duplicated: "${dup.name}"`);
    router.push(`/inventory/${dup.finishedGoodItemId}`);
  };

  // 3. Archive Product
  const handleArchiveProduct = () => {
    if (!product) return;
    archiveProduct(product.id);
    setIsArchiveOpen(false);
    triggerBanner("Product archived successfully.");
    setTimeout(() => router.push("/inventory"), 1000);
  };

  // 4. Delete Product Fallback
  const handleDeleteProduct = () => {
    if (!product) return;
    archiveProduct(product.id);
    setIsDeleteOpen(false);
    triggerBanner("Permanent delete is disabled for MVP. Product was archived instead.", "error");
    setTimeout(() => router.push("/inventory"), 1000);
  };

  // 5. Initialize Product profile if missing
  const handleCreateProductProfile = () => {
    const defaultProduct = {
      sku: item.sku,
      name: item.name,
      outputUnit: item.unit,
      batchSize: 100,
      finishedGoodItemId: item.id,
      brand: "Keeva",
      scent: item.name.replace("Keeva Airzen", "").trim(),
      family: "Floral",
      category: "Air Care",
      notes: "Auto-generated manufacturing profile.",
      isArchived: false
    };
    addProduct(defaultProduct, []);
    triggerBanner("Manufacturing profile & BOM initialized.", "success");
  };

  // 6. Save Item Unit Cost (Editable Cost)
  const handleSaveUnitCost = () => {
    updateInventoryItem(item.id, { unitCost: Number(newUnitCost) || 0 });
    setIsEditUnitCostOpen(false);
    triggerBanner(`Unit cost updated to ${formatMoney(Number(newUnitCost) || 0)}`);
  };

  // 7. Add BOM line to temp list
  const handleAddBOMItem = (bypassWarning = false) => {
    const isCostLine = subFormType === "manpower" || subFormType === "other_cost";
    
    if (!isCostLine && !bomItemId) {
      triggerBanner("Please select an inventory item.", "error");
      return;
    }

    if (!bomQty || isNaN(Number(bomQty)) || Number(bomQty) <= 0) {
      triggerBanner("Please enter a valid positive quantity.", "error");
      return;
    }

    // Check duplicate warning for raw/packaging
    if (!isCostLine && !bypassWarning) {
      const isDuplicate = tempBomLines.some(l => l.inventoryItemId === bomItemId && l.lineType === subFormType);
      if (isDuplicate) {
        setShowDuplicateWarning(true);
        return;
      }
    }

    const matchedItem = inventoryItems.find(i => i.id === bomItemId);
    const lineUnit = isCostLine ? (bomUnit || "pcs") : (bomUnit || matchedItem?.unit || "kg");
    const costOverrideNum = isCostLine && bomCostOverride !== "" ? Number(bomCostOverride) : undefined;
    const wastageNum = bomWastage !== "" ? Number(bomWastage) : undefined;

    const newLine: Omit<ProductBomLine, "id" | "productId"> = {
      inventoryItemId: isCostLine ? undefined : bomItemId,
      quantityPerBatch: Number(bomQty),
      unit: lineUnit,
      lineType: subFormType,
      costOverride: costOverrideNum,
      wastagePercent: wastageNum,
      notes: bomNotes || (isCostLine ? (subFormType === "manpower" ? "Manpower labor cost" : "Other manufacturing cost") : undefined)
    };

    setTempBomLines(prev => [...prev, newLine]);
    
    // Reset fields
    setBomItemId("");
    setBomQty("");
    setBomUnit("");
    setBomCostOverride("");
    setBomWastage("");
    setBomNotes("");
    setBomSearch("");
    setIsQuickAddOpen(false);
    setShowDuplicateWarning(false);
    setIsAddingLine(false);
    triggerBanner("Added item draft to BOM.");
  };

  const handleSelectBomItem = (selectedItemId: string) => {
    const matched = inventoryItems.find(i => i.id === selectedItemId);
    if (!matched) return;
    setBomItemId(matched.id);
    setBomUnit(matched.unit);
    setBomSearch(matched.name);
    setIsQuickAddOpen(false);
  };

  const confirmDeleteLine = (index: number) => {
    setDeleteLineIndex(index);
  };

  const executeDeleteLine = () => {
    if (deleteLineIndex !== null) {
      setTempBomLines(prev => prev.filter((_, i) => i !== deleteLineIndex));
      setDeleteLineIndex(null);
      triggerBanner("Removed item draft from BOM.");
    }
  };

  const cancelDeleteLine = () => {
    setDeleteLineIndex(null);
  };

  const handleDuplicateBOMItem = (index: number) => {
    const target = tempBomLines[index];
    const newTarget = { ...target };
    setTempBomLines(prev => {
      const updated = [...prev];
      updated.splice(index + 1, 0, newTarget);
      return updated;
    });
    triggerBanner("BOM line duplicated.");
  };

  // Edit Inline BOM Line Actions
  const handleOpenLineEdit = (index: number) => {
    setEditingLineIndex(index);
    setIsAddingLine(true);
    const target = tempBomLines[index];
    setSubFormType(target.lineType);
    setBomItemId(target.inventoryItemId ?? "");
    setBomQty(target.quantityPerBatch.toString());
    setBomUnit(target.unit ?? "");
    setBomCostOverride(target.costOverride !== undefined && target.costOverride !== null ? target.costOverride.toString() : "");
    setBomWastage(target.wastagePercent !== undefined && target.wastagePercent !== null ? target.wastagePercent.toString() : "");
    setBomNotes(target.notes ?? "");
    setBomSearch(inventoryItems.find(i => i.id === target.inventoryItemId)?.name ?? "");
    setIsQuickAddOpen(false);
  };

  const handleOpenAddLine = (type: "raw_material" | "packaging" | "manpower" | "other_cost") => {
    setSubFormType(type);
    setIsAddingLine(true);
    setEditingLineIndex(null);
    setBomItemId("");
    setBomQty("");
    setBomUnit("");
    setBomCostOverride("");
    setBomWastage("");
    setBomNotes("");
    setBomSearch("");
    setIsQuickAddOpen(false);
    setQuickItemType(type === "packaging" ? "packaging" : "raw");
    setQuickItemUnit(type === "packaging" ? "pcs" : "kg");
  };

  const handleSaveLineEdit = () => {
    if (editingLineIndex === null) return;
    
    const isCostLine = subFormType === "manpower" || subFormType === "other_cost";
    const matchedItem = inventoryItems.find(i => i.id === bomItemId);
    const lineUnit = isCostLine ? (bomUnit || "pcs") : (bomUnit || matchedItem?.unit || "kg");
    const costOverrideNum = isCostLine && bomCostOverride !== "" ? Number(bomCostOverride) : undefined;
    const wastageNum = bomWastage !== "" ? Number(bomWastage) : undefined;

    const updated = [...tempBomLines];
    updated[editingLineIndex] = {
      inventoryItemId: isCostLine ? undefined : bomItemId,
      quantityPerBatch: Number(bomQty),
      unit: lineUnit,
      lineType: subFormType,
      costOverride: costOverrideNum,
      wastagePercent: wastageNum,
      notes: bomNotes
    };

    setTempBomLines(updated);
    setEditingLineIndex(null);
    
    // Clear subform
    setBomItemId("");
    setBomQty("");
    setBomUnit("");
    setBomCostOverride("");
    setBomWastage("");
    setBomNotes("");
    setBomSearch("");
    setIsQuickAddOpen(false);
    setIsAddingLine(false);
    triggerBanner("Updated line specs.");
  };

  const handleInlineLineChange = (index: number, updates: Partial<Omit<ProductBomLine, "id" | "productId">>) => {
    setTempBomLines(prev => prev.map((line, idx) => idx === index ? { ...line, ...updates } : line));
  };

  const handleQuickAddInventoryItem = () => {
    if (!quickItemName.trim()) {
      triggerBanner("Item name is required.", "error");
      return;
    }

    const newItem = addInventoryItem({
      sku: `BOM-${quickItemName.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 18) || "ITEM"}`,
      name: quickItemName.trim(),
      category: quickItemType,
      unit: quickItemUnit,
      quantityOnHand: 0,
      reorderPoint: 0,
      locationId: quickItemArea || locations[0]?.id || "loc-a1",
      unitCost: quickItemCost === "" ? undefined : Number(quickItemCost)
    });

    setBomItemId(newItem.id);
    setBomUnit(newItem.unit);
    setBomSearch(newItem.name);
    setQuickItemName("");
    setQuickItemCost("");
    setQuickItemArea("");
    setIsQuickAddOpen(false);
    triggerBanner("Inventory item added and selected.");
  };

  const handleSaveBOMEditor = () => {
    if (!product) return;
    
    // Save batch size and output unit back to product profile
    updateProduct(product.id, {
      batchSize: bomBatchSize,
      outputUnit: bomOutputUnit as any
    });

    updateProductBom(product.id, tempBomLines);
    setIsEditBOMOpen(false);
    triggerBanner("BOM saved successfully!");
  };

  // Copy BOM action
  const handleCopyBOM = () => {
    if (!product || !copySourceProductId) return;
    
    const sourceBomLines = productBomLines.filter((l) => l.productId === copySourceProductId);
    if (sourceBomLines.length === 0) {
      triggerBanner("Source product has no BOM specifications.", "error");
      return;
    }

    const linesToImport = sourceBomLines.map(({ inventoryItemId, quantityPerBatch, unit, lineType, costOverride, wastagePercent, notes }) => ({
      inventoryItemId,
      quantityPerBatch,
      unit,
      lineType,
      costOverride,
      wastagePercent,
      notes
    }));

    if (copyMethod === "replace") {
      setTempBomLines(linesToImport);
      triggerBanner("Replaced BOM draft with copied specs.");
    } else {
      // Append
      setTempBomLines(prev => {
        const merged = [...prev];
        linesToImport.forEach(importedLine => {
          const matchIndex = merged.findIndex(
            l => l.inventoryItemId === importedLine.inventoryItemId && l.lineType === importedLine.lineType
          );
          if (matchIndex > -1 && importedLine.inventoryItemId) {
            merged[matchIndex].quantityPerBatch += importedLine.quantityPerBatch;
          } else {
            merged.push(importedLine);
          }
        });
        return merged;
      });
      triggerBanner("Appended copied specs into BOM draft.");
    }

    setIsCopyBOMOpen(false);
    setIsEditBOMOpen(true);
  };

  const currentBomAssignment = product ? bomAssignments.find(entry => entry.productId === product.id) : undefined;
  const linkedMasterBom = masterBoms.find(bom => bom.id === currentBomAssignment?.bomId);
  const effectiveMasterLines = currentBomAssignment?.type === "custom" && currentBomAssignment.customLines
    ? currentBomAssignment.customLines
    : linkedMasterBom?.lines ?? [];
  const assignedBomCost = estimateBomCost(effectiveMasterLines, inventoryItems);

  const saveAssignment = (assignment: typeof bomAssignments[number]) => {
    const next = [...bomAssignments.filter(entry => entry.productId !== assignment.productId), assignment];
    setBomAssignments(next);
    saveProductBomAssignments(next);
  };

  const applyMasterBomToProduct = (masterBom: MasterBom, mode: "linked" | "custom") => {
    if (!product) return;
    const linesToApply = masterBom.lines.map(line => ({
      inventoryItemId: line.inventoryItemId,
      quantityPerBatch: line.quantityPerBatch,
      unit: line.unit,
      lineType: line.lineType,
      costOverride: line.costOverride,
      notes: line.notes
    }));
    updateProductBom(product.id, linesToApply);
    setTempBomLines(linesToApply);
    saveAssignment({
      productId: product.id,
      bomId: masterBom.id,
      type: mode,
      customLines: mode === "custom" ? masterBom.lines.map(line => ({ ...line })) : undefined
    });
    setSelectedMasterBomId(masterBom.id);
    setIsChangeMasterBomOpen(false);
    triggerBanner(mode === "linked" ? "Linked master BOM assigned." : "Master BOM copied into custom product BOM.");
  };

  return (
    <AppShell>
      {/* Toast Banner */}
      {banner && (
        <div className={cn(
          "fixed top-4 left-1/2 -translate-x-1/2 z-[100] w-full max-w-md p-4 rounded-xl shadow-glow border flex items-center justify-between transition-all",
          banner.type === "success" 
            ? "bg-success/15 border-success/30 text-success" 
            : banner.type === "error"
            ? "bg-error/15 border-error/30 text-error"
            : "bg-primary/15 border-primary/30 text-primary"
        )}>
          <span className="font-semibold text-body-md">{banner.message}</span>
          <button onClick={() => setBanner(null)} className="p-1 hover:bg-white/10 rounded-full">
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Top Header Navigation */}
      <div className="flex items-center gap-3 mb-6">
        <Button variant="ghost" size="icon" asChild className="rounded-full h-10 w-10">
          <Link href="/inventory" aria-label="Back">
            <ArrowLeft className="h-5 w-5" />
          </Link>
        </Button>
        <div>
          <span className="text-label-sm text-primary uppercase font-bold tracking-wider">
            {isFinishedGood ? "Finished Product Profile" : "Material Profile"}
          </span>
          <h2 className="text-headline-md font-bold text-white mt-0.5">{item.name}</h2>
        </div>
      </div>

      {isFinishedGood ? (
        /* ==================== FINISHED GOOD VIEW ==================== */
        <div className="space-y-6">
          {/* Finished Good Specs Bento */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2 p-6 bg-surface-container border border-outline-variant/30 flex flex-col justify-between relative overflow-hidden">
              <div className="absolute -right-10 -top-10 w-40 h-40 bg-primary/5 rounded-full blur-3xl animate-pulse" />
              <div>
                <div className="flex justify-between items-start gap-4 flex-wrap mb-4">
                  <div>
                    <span className="px-3 py-1 rounded-full font-bold text-label-xs uppercase tracking-wider mb-2 inline-block border bg-primary/10 border-primary/20 text-primary">
                      {bomStatus().label}
                    </span>
                    <h3 className="text-headline-md font-bold text-white mt-1">
                      {product ? `${product.brand ?? "Keeva"} ${product.name}` : item.name}
                    </h3>
                    <p className="text-body-sm text-on-surface-variant mt-1">
                      Code: <span className="text-white font-mono">{product?.sku ?? item.sku}</span> • Scent: {product?.scent ?? "N/A"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-label-sm text-outline uppercase font-bold">Finished Stock</p>
                    <p className="text-headline-lg font-bold text-white mt-1">
                      {item.quantityOnHand} <span className="text-body-sm font-medium text-on-surface-variant">{item.unit}</span>
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mt-6 pt-6 border-t border-outline-variant/10">
                  <div>
                    <span className="text-label-sm text-outline uppercase font-bold">Brand</span>
                    <p className="text-body-sm font-bold text-white mt-1">{product?.brand ?? "Keeva"}</p>
                  </div>
                  <div>
                    <span className="text-label-sm text-outline uppercase font-bold">Scent</span>
                    <p className="text-body-sm font-bold text-white mt-1">{product?.scent ?? "Lavender"}</p>
                  </div>
                  <div>
                    <span className="text-label-sm text-outline uppercase font-bold">Family</span>
                    <p className="text-body-sm font-bold text-white mt-1">{product?.family ?? "Floral"}</p>
                  </div>
                  <div>
                    <span className="text-label-sm text-outline uppercase font-bold">Category</span>
                    <p className="text-body-sm font-bold text-white mt-1">{product?.category ?? "Air Care"}</p>
                  </div>
                </div>
              </div>
            </Card>

            <Card className="p-6 bg-surface-container border border-outline-variant/30 flex flex-col justify-between">
              <div>
                <span className="text-label-sm text-outline uppercase font-bold flex items-center gap-1.5 mb-3">
                  <MapPin className="h-4 w-4 text-primary" /> Storage Area
                </span>
                <div className="p-3 bg-surface-container-low border border-outline-variant/20 rounded-lg">
                  <p className="text-headline-sm font-bold text-primary">{location?.name ?? "Finished Warehouse"}</p>
                  <p className="text-body-sm text-on-surface-variant mt-0.5">Zone {location?.code ?? "A3"}</p>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-outline-variant/10 space-y-2 text-body-sm">
                <div className="flex justify-between">
                  <span className="text-on-surface-variant">Batch Size</span>
                  <span className="font-semibold text-white">{product?.batchSize ?? "100"} {product?.outputUnit ?? "gallon"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-on-surface-variant">BOM Items</span>
                  <span className="font-semibold text-white">{bomLines.length} component(s)</span>
                </div>
              </div>
            </Card>
          </div>

          {/* Finished Goods Action row */}
          <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-3">
            <Button asChild className="bg-secondary-container text-on-secondary-container hover:opacity-90 transition">
              <Link href={`/inventory/stock-movement?type=in&itemId=${item.id}`}>
                <ArrowDownToLine className="h-4 w-4 mr-1.5" /> Stock In
              </Link>
            </Button>
            <Button asChild variant="ghost" className="border border-outline-variant/30 text-on-surface hover:text-white">
              <Link href={`/inventory/stock-movement?type=out&itemId=${item.id}`}>
                <ArrowUpFromLine className="h-4 w-4 mr-1.5" /> Stock Out
              </Link>
            </Button>
            
            {product ? (
              <>
                <Button variant="ghost" className="border border-outline-variant/30 text-white" onClick={() => setIsEditProductOpen(true)}>
                  <Edit3 className="h-4 w-4 mr-1.5" /> Edit Product
                </Button>
                <Button variant="ghost" className="border border-outline-variant/30 text-white" onClick={() => setIsEditBOMOpen(true)}>
                  <GitBranch className="h-4 w-4 mr-1.5" /> Edit BOM
                </Button>
                <Button variant="ghost" className="border border-outline-variant/30 text-white" onClick={() => setIsCopyBOMOpen(true)}>
                  <Copy className="h-4 w-4 mr-1.5" /> Copy BOM Specs
                </Button>
                <Button variant="ghost" className="border border-outline-variant/30 text-white" onClick={() => setIsDuplicateOpen(true)}>
                  <Copy className="h-4 w-4 mr-1.5" /> Duplicate Product
                </Button>
                <Button variant="ghost" className="border border-outline-variant/30 text-warning" onClick={() => setIsArchiveOpen(true)}>
                  <Archive className="h-4 w-4 mr-1.5" /> Archive Product
                </Button>
                <Button variant="ghost" className="border border-outline-variant/30 text-error hover:bg-error/5" onClick={() => setIsDeleteOpen(true)}>
                  <Trash2 className="h-4 w-4 mr-1.5" /> Delete Product
                </Button>
              </>
            ) : (
              <Button onClick={handleCreateProductProfile}>
                Create Manufacturing Profile
              </Button>
            )}
          </div>

          {product && (
            <Card className="rounded-lg border border-outline-variant/30 bg-surface-container p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-label-sm font-bold uppercase text-primary">BOM assignment</p>
                  <h3 className="mt-1 truncate text-[17px] font-bold text-white">
                    {linkedMasterBom?.name ?? (bomLines.length > 0 ? "Custom product BOM" : "No BOM yet")}
                  </h3>
                  <p className="mt-1 text-[12.5px] text-on-surface-variant">
                    {currentBomAssignment?.type === "linked" ? "Linked master BOM" : currentBomAssignment?.type === "custom" ? "Custom product BOM" : "No BOM yet"}
                    {"\u2022"} {linkedMasterBom ? `Yield ${linkedMasterBom.yieldQty} ${linkedMasterBom.yieldUnit}` : `${product.batchSize} ${product.outputUnit}`}
                    {"\u2022"} {assignedBomCost.missingCost ? "Cost pending" : formatMoney(assignedBomCost.total)}
                  </p>
                </div>
                <span className="shrink-0 rounded-full border border-outline-variant/35 px-2 py-0.5 text-[11px] font-bold uppercase text-on-surface-variant">
                  {currentBomAssignment?.type ?? "none"}
                </span>
              </div>

              {isChangeMasterBomOpen && (
                <div className="mt-3 rounded-md border border-outline-variant/25 bg-surface-container-low p-2">
                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[10px] font-bold uppercase text-outline">Search BOM Library</span>
                      <span className="text-[10.5px] text-on-surface-variant">
                        {isLoadingMasterBoms ? "Loading..." : `${masterBoms.filter(bom => bom.status === "active").length} active`}
                      </span>
                    </div>
                    <SearchableBomPicker
                      boms={masterBoms.filter(bom => bom.status === "active")}
                      query={masterBomSearch}
                      value={selectedMasterBomId}
                      onQueryChange={setMasterBomSearch}
                      onChange={(bomId) => setSelectedMasterBomId(bomId)}
                    />
                    {masterBomLoadError && (
                      <p className="rounded-md border border-warning/25 bg-warning/10 px-2 py-1.5 text-[11.5px] leading-5 text-warning">
                        {masterBomLoadError}
                      </p>
                    )}
                    {!isLoadingMasterBoms && masterBoms.filter(bom => bom.status === "active").length === 0 && (
                      <p className="rounded-md border border-outline-variant/20 bg-surface-container px-2 py-2 text-[12px] text-on-surface-variant">
                        No active BOMs found. Create one in BOM Library first.
                      </p>
                    )}
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <Button size="sm" variant="ghost" onClick={() => {
                      const bom = masterBoms.find(entry => entry.id === selectedMasterBomId);
                      if (bom && window.confirm(`Change product to linked BOM "${bom.name}"?`)) applyMasterBomToProduct(bom, "linked");
                    }} disabled={!selectedMasterBomId}>
                      Use linked BOM
                    </Button>
                    <Button size="sm" onClick={() => {
                      const bom = masterBoms.find(entry => entry.id === selectedMasterBomId);
                      if (bom) applyMasterBomToProduct(bom, "custom");
                    }} disabled={!selectedMasterBomId}>
                      Copy customize
                    </Button>
                  </div>
                </div>
              )}

              <div className="mt-3 grid grid-cols-3 gap-1.5">
                <Button size="sm" variant="ghost" className="h-8 px-1 text-[11.5px]" onClick={() => setIsChangeMasterBomOpen(open => !open)}>Change BOM</Button>
                <Button size="sm" variant="ghost" className="h-8 px-1 text-[11.5px]" onClick={() => {
                  const bom = linkedMasterBom ?? masterBoms[0];
                  if (bom) applyMasterBomToProduct(bom, "custom");
                }}>Copy/custom</Button>
                <Button size="sm" className="h-8 px-1 text-[11.5px]" onClick={() => setIsEditBOMOpen(true)}>Edit Product BOM</Button>
              </div>
            </Card>
          )}

          {/* Inline BOM Editing Section */}
          <Card className="p-4 sm:p-5 bg-surface-container border border-outline-variant/30 mb-8">
            {product ? (() => {
              const linesForView = isEditBOMOpen ? tempBomLines : bomLines;
              const totals = calculateTotals(linesForView);
              const sections = [
                { key: "raw_material", title: "INGREDIENTS", add: "+ Add ingredient", empty: "No ingredients configured." },
                { key: "packaging", title: "PACKAGING", add: "+ Add packaging", empty: "No packaging configured." },
                { key: "manpower", title: "MANPOWER LABOR", add: "+ Add cost", empty: "No labor cost configured." },
                { key: "other_cost", title: "OTHER COSTS", add: "+ Add cost", empty: "No other overhead costs configured." }
              ] as const;

              return (
                <div className="space-y-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <h3 className="text-headline-sm font-bold text-white">Bill of Materials</h3>
                      <p className="text-body-sm text-outline font-semibold">
                        Total Cost: {formatMoney(totals.total)}
                        {totals.hasMissing && <span className="ml-2 text-warning">Incomplete cost</span>}
                      </p>
                    </div>
                    {isEditBOMOpen ? (
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          className="h-10 border border-outline-variant/30 px-3"
                          onClick={() => {
                            setTempBomLines(bomLines.map(({ inventoryItemId, quantityPerBatch, unit, lineType, costOverride, wastagePercent, notes }) => ({
                              inventoryItemId,
                              quantityPerBatch,
                              unit,
                              lineType,
                              costOverride,
                              wastagePercent,
                              notes
                            })));
                            setIsAddingLine(false);
                            setIsQuickAddOpen(false);
                            setIsEditBOMOpen(false);
                          }}
                        >
                          Cancel
                        </Button>
                        <Button className="h-10 px-3" onClick={handleSaveBOMEditor}>Save BOM</Button>
                      </div>
                    ) : (
                      <Button className="h-10 px-3" onClick={() => setIsEditBOMOpen(true)}>
                        {bomLines.length > 0 ? "Edit BOM" : "Add BOM"}
                      </Button>
                    )}
                  </div>

                  {!isEditBOMOpen && bomLines.length === 0 ? (
                    <div className="rounded-lg border border-outline-variant/20 bg-surface-container-low p-5 text-center">
                      <AlertTriangle className="h-8 w-8 text-warning mx-auto mb-2" />
                      <h4 className="font-bold text-white text-body-lg">No BOM yet</h4>
                      <p className="text-body-sm text-on-surface-variant mt-1 mb-4">
                        Add ingredients and packaging before production release.
                      </p>
                      <Button onClick={() => setIsEditBOMOpen(true)}>
                        <Plus className="h-4 w-4 mr-1.5" /> Add BOM
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-5">
                      {sections.map(section => {
                        const sectionLines = linesForView
                          .map((line, index) => ({ line, index }))
                          .filter(({ line }) => line.lineType === section.key);
                        const suggestions = inventoryItems
                          .filter(i => {
                            const wanted = subFormType === "raw_material" ? "raw" : "packaging";
                            const haystack = `${i.name} ${i.sku}`.toLowerCase();
                            return !i.isArchived && i.category === wanted && haystack.includes(bomSearch.toLowerCase().trim());
                          })
                          .slice(0, 5);

                        return (
                          <section key={section.key} className="space-y-2">
                            <div className="flex items-center justify-between border-b border-outline-variant/20 pb-2">
                              <h4 className="text-label-md font-bold uppercase text-white">{section.title}</h4>
                              {isEditBOMOpen && (
                                <button
                                  type="button"
                                  className="min-h-9 rounded-md px-2 text-label-sm font-bold text-primary hover:bg-primary/10"
                                  onClick={() => handleOpenAddLine(section.key)}
                                >
                                  {section.add}
                                </button>
                              )}
                            </div>

                            {sectionLines.length === 0 && (!isAddingLine || subFormType !== section.key) && (
                              <p className="py-1 text-body-xs italic text-on-surface-variant">{section.empty}</p>
                            )}

                            <div className="space-y-2">
                              {sectionLines.map(({ line, index }) => {
                                const matched = inventoryItems.find(i => i.id === line.inventoryItemId);
                                const lineCost = calculateLineCost(line);
                                const labelName = matched?.name ?? line.notes ?? "Cost line";
                                const costText = lineCost.missing
                                  ? lineCost.incompatible ? "Unit mismatch" : "Missing cost"
                                  : formatMoney(lineCost.cost);

                                return (
                                  <div key={`${line.inventoryItemId ?? line.notes}-${index}`} className="rounded-lg border border-outline-variant/20 bg-surface-container-low p-3">
                                    <div className="flex items-start justify-between gap-3">
                                      <div className="min-w-0">
                                        <p className="truncate text-body-sm font-semibold text-white">{labelName}</p>
                                        <p className={cn("mt-0.5 text-body-xs", lineCost.missing ? "text-warning" : "text-on-surface-variant")}>
                                          Qty: {line.quantityPerBatch} {line.unit ?? "pcs"} • {costText}
                                        </p>
                                      </div>
                                      {isEditBOMOpen && (
                                        <div className="flex shrink-0 gap-1">
                                          <Button aria-label="Duplicate BOM line" size="icon" variant="ghost" className="h-9 w-9 text-secondary" onClick={() => handleDuplicateBOMItem(index)}>
                                            <Copy className="h-4 w-4" />
                                          </Button>
                                          <Button aria-label="Delete BOM line" size="icon" variant="ghost" className="h-9 w-9 text-error" onClick={() => setTempBomLines(prev => prev.filter((_, idx) => idx !== index))}>
                                            <Trash className="h-4 w-4" />
                                          </Button>
                                        </div>
                                      )}
                                    </div>

                                    {isEditBOMOpen && (
                                      <div className="mt-3 grid grid-cols-[minmax(0,1fr)_96px] gap-2">
                                        <Input
                                          aria-label={`Quantity for ${labelName}`}
                                          type="number"
                                          min="0"
                                          step="0.01"
                                          value={line.quantityPerBatch}
                                          onChange={e => handleInlineLineChange(index, { quantityPerBatch: Number(e.target.value) || 0 })}
                                          className="h-10"
                                        />
                                        <select
                                          aria-label={`Unit for ${labelName}`}
                                          value={line.unit ?? matched?.unit ?? "pcs"}
                                          onChange={e => handleInlineLineChange(index, { unit: e.target.value })}
                                          className="h-10 rounded-md border border-outline-variant bg-surface-container px-2 text-body-sm text-white"
                                        >
                                          {unitOptions.map(unit => <option key={unit} value={unit}>{unit}</option>)}
                                        </select>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>

                            {isEditBOMOpen && isAddingLine && subFormType === section.key && (
                              <div className="rounded-lg border border-primary/30 bg-surface-container-high p-3 space-y-3">
                                {section.key === "raw_material" || section.key === "packaging" ? (
                                  <>
                                    <div className="relative">
                                      <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-outline" />
                                      <Input
                                        value={bomSearch}
                                        onChange={e => {
                                          setBomSearch(e.target.value);
                                          setBomItemId("");
                                          setIsQuickAddOpen(false);
                                        }}
                                        placeholder="Search raw material, packaging, or code..."
                                        className="h-10 pl-9"
                                      />
                                    </div>
                                    <div className="space-y-1">
                                      {suggestions.map(suggestion => {
                                        const loc = locations.find(l => l.id === suggestion.locationId);
                                        return (
                                          <button
                                            type="button"
                                            key={suggestion.id}
                                            className={cn(
                                              "w-full rounded-md border p-3 text-left transition",
                                              bomItemId === suggestion.id ? "border-primary bg-primary/10" : "border-outline-variant/20 bg-surface-container-low hover:border-primary/40"
                                            )}
                                            onClick={() => handleSelectBomItem(suggestion.id)}
                                          >
                                            <p className="text-body-sm font-semibold text-white">{suggestion.name}</p>
                                            <p className="mt-0.5 text-body-xs text-on-surface-variant">
                                              {suggestion.category === "raw" ? "Raw material" : "Packaging"} • {loc?.code ?? "No area"} • Unit cost: {typeof suggestion.unitCost === "number" ? `${formatMoney(suggestion.unitCost)}/${suggestion.unit}` : "Missing cost"}
                                            </p>
                                          </button>
                                        );
                                      })}
                                      {suggestions.length === 0 && (
                                        <button
                                          type="button"
                                          className="flex min-h-10 w-full items-center gap-2 rounded-md border border-dashed border-primary/40 bg-primary/5 px-3 text-left text-body-sm font-semibold text-primary"
                                          onClick={() => {
                                            setQuickItemName(bomSearch);
                                            setQuickItemType(section.key === "packaging" ? "packaging" : "raw");
                                            setQuickItemUnit(section.key === "packaging" ? "pcs" : "kg");
                                            setIsQuickAddOpen(true);
                                          }}
                                        >
                                          <PackagePlus className="h-4 w-4" /> + Add new inventory item
                                        </button>
                                      )}
                                    </div>

                                    {isQuickAddOpen && (
                                      <div className="rounded-lg border border-outline-variant/20 bg-surface-container-low p-3 space-y-3">
                                        <Input value={quickItemName} onChange={e => setQuickItemName(e.target.value)} placeholder="Item name" className="h-10" />
                                        <div className="grid grid-cols-3 gap-2">
                                          {(["raw", "packaging", "asset"] as const).map(type => (
                                            <button
                                              key={type}
                                              type="button"
                                              className={cn("min-h-9 rounded-md border px-2 text-label-sm capitalize", quickItemType === type ? "border-primary bg-primary/15 text-primary" : "border-outline-variant/30 text-on-surface-variant")}
                                              onClick={() => setQuickItemType(type)}
                                            >
                                              {type === "asset" ? "Other" : type === "raw" ? "Raw material" : "Packaging"}
                                            </button>
                                          ))}
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                          <select value={quickItemUnit} onChange={e => setQuickItemUnit(e.target.value as InventoryUnit)} className="h-10 rounded-md border border-outline-variant bg-surface-container px-2 text-body-sm text-white">
                                            {unitOptions.map(unit => <option key={unit} value={unit}>{unit}</option>)}
                                          </select>
                                          <Input value={quickItemCost} onChange={e => setQuickItemCost(e.target.value)} type="number" step="0.01" placeholder="Unit cost optional" className="h-10" />
                                        </div>
                                        <select value={quickItemArea} onChange={e => setQuickItemArea(e.target.value)} className="h-10 w-full rounded-md border border-outline-variant bg-surface-container px-2 text-body-sm text-white">
                                          <option value="">Area optional</option>
                                          {locations.map(loc => <option key={loc.id} value={loc.id}>{loc.name}</option>)}
                                        </select>
                                        <div className="flex justify-end gap-2">
                                          <Button size="sm" variant="ghost" onClick={() => setIsQuickAddOpen(false)}>Cancel</Button>
                                          <Button size="sm" onClick={handleQuickAddInventoryItem}>Save item</Button>
                                        </div>
                                      </div>
                                    )}
                                  </>
                                ) : (
                                  <Input value={bomNotes} onChange={e => setBomNotes(e.target.value)} placeholder={section.key === "manpower" ? "Labor cost name" : "Overhead cost name"} className="h-10" />
                                )}

                                <div className="grid grid-cols-[minmax(0,1fr)_96px] gap-2">
                                  <Input type="number" min="0" step="0.01" value={bomQty} onChange={e => setBomQty(e.target.value)} placeholder={section.key === "raw_material" || section.key === "packaging" ? "Quantity" : "Cost"} className="h-10" />
                                  <select value={bomUnit || (section.key === "packaging" ? "pcs" : "kg")} onChange={e => setBomUnit(e.target.value)} className="h-10 rounded-md border border-outline-variant bg-surface-container px-2 text-body-sm text-white">
                                    {unitOptions.map(unit => <option key={unit} value={unit}>{unit}</option>)}
                                  </select>
                                </div>

                                {(section.key === "manpower" || section.key === "other_cost") && (
                                  <Input value={bomCostOverride} onChange={e => setBomCostOverride(e.target.value)} type="number" step="0.01" placeholder="Cost amount" className="h-10" />
                                )}

                                {(section.key === "raw_material" || section.key === "packaging") && (
                                  <Input value={bomNotes} onChange={e => setBomNotes(e.target.value)} placeholder="Notes optional" className="h-10" />
                                )}

                                {showDuplicateWarning && (
                                  <div className="flex items-center justify-between rounded-md border border-warning/30 bg-warning/10 p-2 text-warning">
                                    <span className="text-body-xs font-semibold">Item already exists. Add duplicate?</span>
                                    <Button size="sm" className="h-8 bg-warning text-black" onClick={() => handleAddBOMItem(true)}>Confirm</Button>
                                  </div>
                                )}

                                <div className="flex justify-end gap-2 border-t border-outline-variant/10 pt-2">
                                  <Button size="sm" variant="ghost" onClick={() => { setIsAddingLine(false); setEditingLineIndex(null); setIsQuickAddOpen(false); }}>Cancel</Button>
                                  <Button size="sm" onClick={() => editingLineIndex !== null ? handleSaveLineEdit() : handleAddBOMItem(false)}>
                                    {editingLineIndex !== null ? "Save line" : "Add to BOM"}
                                  </Button>
                                </div>
                              </div>
                            )}
                          </section>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })() : (
              <div className="text-center py-8">
                <AlertTriangle className="h-10 w-10 text-warning mx-auto mb-2" />
                <h4 className="font-bold text-white text-body-lg">No manufacturing profile yet</h4>
                <p className="text-body-sm text-on-surface-variant mt-1 mb-4">
                  Create a product profile before adding a BOM.
                </p>
                <Button onClick={handleCreateProductProfile}>Create Manufacturing Profile</Button>
              </div>
            )}
          </Card>

          {/* Legacy BOM Listing Section */}
          <Card className="hidden p-6 bg-surface-container border border-outline-variant/30">
            {product && bomLines.length > 0 ? (
              <div className="space-y-6">
                <div className="flex items-center justify-between">
                  <h3 className="text-headline-sm font-bold text-white">Bill of Materials</h3>
                  <span className="text-body-sm text-outline font-semibold">Total Cost: {formatMoney(calculateTotalBOMCost())}</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Ingredients Section */}
                  <div>
                    <h4 className="text-label-md font-bold text-primary uppercase border-b border-outline-variant/20 pb-2 mb-3">
                      Ingredients
                    </h4>
                    {bomLines.filter(l => l.lineType === "raw_material").length > 0 ? (
                      <div className="space-y-2">
                        {bomLines.filter(l => l.lineType === "raw_material").map(l => {
                          const matched = inventoryItems.find(i => i.id === l.inventoryItemId);
                          const cost = l.costOverride !== undefined ? l.costOverride : (matched?.unitCost ?? 0);
                          return (
                            <div key={l.id} className="flex justify-between items-center py-1.5 border-b border-outline-variant/10 text-body-sm text-on-surface-variant">
                              <span className="font-semibold text-white">{matched?.name ?? "Water"}</span>
                              <span>
                                {l.quantityPerBatch} {l.unit} • {formatMoney(cost * l.quantityPerBatch)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-body-xs text-on-surface-variant italic">No raw ingredients configured.</p>
                    )}
                  </div>

                  {/* Packaging Section */}
                  <div>
                    <h4 className="text-label-md font-bold text-secondary uppercase border-b border-outline-variant/20 pb-2 mb-3">
                      Packaging
                    </h4>
                    {bomLines.filter(l => l.lineType === "packaging").length > 0 ? (
                      <div className="space-y-2">
                        {bomLines.filter(l => l.lineType === "packaging").map(l => {
                          const matched = inventoryItems.find(i => i.id === l.inventoryItemId);
                          const cost = l.costOverride !== undefined ? l.costOverride : (matched?.unitCost ?? 0);
                          return (
                            <div key={l.id} className="flex justify-between items-center py-1.5 border-b border-outline-variant/10 text-body-sm text-on-surface-variant">
                              <span className="font-semibold text-white">{matched?.name ?? "Bottle"}</span>
                              <span>
                                {l.quantityPerBatch} {l.unit} • {formatMoney(cost * l.quantityPerBatch)}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-body-xs text-on-surface-variant italic">No packaging configured.</p>
                    )}
                  </div>

                  {/* Manpower Section */}
                  <div>
                    <h4 className="text-label-md font-bold text-tertiary uppercase border-b border-outline-variant/20 pb-2 mb-3">
                      Manpower labor
                    </h4>
                    {bomLines.filter(l => l.lineType === "manpower").length > 0 ? (
                      <div className="space-y-2">
                        {bomLines.filter(l => l.lineType === "manpower").map(l => (
                          <div key={l.id} className="flex justify-between items-center py-1.5 border-b border-outline-variant/10 text-body-sm text-on-surface-variant">
                            <span className="font-semibold text-white">{l.notes || "Labor"}</span>
                            <span className="text-white font-semibold">
                              {formatMoney(l.costOverride ?? 0)}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-body-xs text-on-surface-variant italic">No labor cost configured.</p>
                    )}
                  </div>

                  {/* Other Costs Section */}
                  <div>
                    <h4 className="text-label-md font-bold text-outline uppercase border-b border-outline-variant/20 pb-2 mb-3">
                      Other Costs
                    </h4>
                    {bomLines.filter(l => l.lineType === "other_cost").length > 0 ? (
                      <div className="space-y-2">
                        {bomLines.filter(l => l.lineType === "other_cost").map(l => (
                          <div key={l.id} className="flex justify-between items-center py-1.5 border-b border-outline-variant/10 text-body-sm text-on-surface-variant">
                            <span className="font-semibold text-white">{l.notes || "Other overhead"}</span>
                            <span className="text-white font-semibold">
                              {formatMoney(l.costOverride ?? 0)}
                            </span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-body-xs text-on-surface-variant italic">No other overhead costs configured.</p>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-10">
                <AlertTriangle className="h-10 w-10 text-warning mx-auto mb-2" />
                <h4 className="font-bold text-white text-body-lg">No BOM yet</h4>
                <p className="text-body-sm text-on-surface-variant mt-1 mb-4">
                  Add ingredients and packaging before production release.
                </p>
                <Button onClick={() => setIsEditBOMOpen(true)}>
                  <Plus className="h-4 w-4 mr-1.5" /> Add BOM
                </Button>
              </div>
            )}
          </Card>
        </div>
      ) : (
        /* ==================== GENERIC MATERIAL VIEW ==================== */
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <Card className="md:col-span-2 p-6 bg-surface-container border border-outline-variant/30 flex flex-col justify-between relative overflow-hidden">
              <div className="absolute -right-10 -top-10 w-40 h-40 bg-primary/5 rounded-full blur-3xl animate-pulse" />
              <div>
                <div className="flex justify-between items-start gap-4 flex-wrap mb-4">
                  <div>
                    <span className="px-3 py-1 rounded-full font-bold text-label-xs uppercase tracking-wider mb-2 inline-block border bg-primary/10 border-primary/20 text-primary">
                      {item.status} Stock
                    </span>
                    <h3 className="text-headline-md font-bold text-white mt-1">{item.name}</h3>
                    <p className="text-body-sm text-on-surface-variant mt-1 capitalize">
                      {item.category} Component • SKU: {item.sku}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-label-sm text-outline uppercase font-bold flex items-center justify-end gap-1">
                      Unit Cost
                      <button onClick={() => { setNewUnitCost(item.unitCost?.toString() ?? ""); setIsEditUnitCostOpen(true); }} className="text-primary hover:text-white p-0.5">
                        ✏️
                      </button>
                    </p>
                    <p className="text-headline-md text-secondary font-bold mt-1">
                      {item.unitCost ? formatMoney(item.unitCost) : "₱0.00"}/{item.unit}
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6 mt-6">
                  <div>
                    <span className="text-label-sm text-outline uppercase font-bold">Current Stock</span>
                    <p className="text-headline-lg font-bold text-white mt-1">
                      {item.quantityOnHand} <span className="text-body-sm font-medium text-on-surface-variant">{item.unit}</span>
                    </p>
                  </div>
                  <div>
                    <span className="text-label-sm text-outline uppercase font-bold">Reorder Point</span>
                    <p className="text-headline-lg font-bold text-white mt-1">
                      {item.reorderPoint} <span className="text-body-sm font-medium text-on-surface-variant">{item.unit}</span>
                    </p>
                  </div>
                </div>
              </div>
            </Card>

            <Card className="p-6 bg-surface-container border border-outline-variant/30 flex flex-col justify-between">
              <div>
                <span className="text-label-sm text-outline uppercase font-bold flex items-center gap-1.5 mb-3">
                  <MapPin className="h-4 w-4 text-primary" /> Location
                </span>
                <div className="p-3 bg-surface-container-low border border-outline-variant/20 rounded-lg">
                  <p className="text-headline-sm font-bold text-primary">{location?.name ?? "Warehouse Area"}</p>
                  <p className="text-body-sm text-on-surface-variant mt-0.5">Zone {location?.code ?? "N/A"}</p>
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-outline-variant/10 space-y-2 text-body-sm text-on-surface-variant">
                <div className="flex justify-between">
                  <span>Lead Time</span>
                  <span className="font-semibold text-white">3-5 Days</span>
                </div>
                <div className="flex justify-between">
                  <span>Vendor</span>
                  <span className="font-semibold text-primary">ChemPrime Inc.</span>
                </div>
              </div>
            </Card>
          </div>

          <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-3">
            <Button asChild className="bg-secondary-container text-on-secondary-container hover:opacity-90 transition">
              <Link href={`/inventory/stock-movement?type=in&itemId=${item.id}`}>
                <ArrowDownToLine className="h-4 w-4 mr-1.5" /> Stock In
              </Link>
            </Button>
            <Button asChild variant="ghost" className="border border-outline-variant/30 text-on-surface hover:text-white">
              <Link href={`/inventory/stock-movement?type=out&itemId=${item.id}`}>
                <ArrowUpFromLine className="h-4 w-4 mr-1.5" /> Stock Out
              </Link>
            </Button>
            <Button asChild variant="ghost" className="border border-outline-variant/30 text-on-surface hover:text-white">
              <Link href={`/inventory/stock-movement?type=adjustment&itemId=${item.id}`}>
                <Sliders className="h-4 w-4 mr-1.5" /> Adjust Count
              </Link>
            </Button>
            <Button asChild variant="ghost" className="border border-outline-variant/30 text-on-surface hover:text-white">
              <Link href={`/inventory/add?id=${item.id}`}>
                <Edit3 className="h-4 w-4 mr-1.5" /> Edit Item
              </Link>
            </Button>
            {item.isArchived ? (
              <Button variant="ghost" className="border border-outline-variant/30 text-success" onClick={() => updateInventoryItem(item.id, { isArchived: false })}>
                Restore
              </Button>
            ) : (
              <Button variant="ghost" className="border border-outline-variant/30 text-warning" onClick={() => setIsArchiveOpen(true)}>
                <Archive className="h-4 w-4 mr-1.5" /> Archive
              </Button>
            )}
            <Button variant="ghost" className="border border-outline-variant/30 text-error hover:bg-error/5" onClick={() => setIsDeleteOpen(true)}>
              <Trash2 className="h-4 w-4 mr-1.5" /> Delete Item
            </Button>
          </div>
        </div>
      )}

      {/* History Log Audit Section (Common to both) */}
      <section className="space-y-4 mt-8 pb-20">
        <h3 className="text-headline-sm font-bold text-white">Activity History</h3>
        <Card className="overflow-hidden divide-y divide-outline-variant/20 border border-outline-variant/30 bg-surface-container">
          {transactions.length > 0 ? (
            transactions.map((txn) => {
              const isStockIn = txn.type === "stock_in";
              const isConsume = txn.type === "production_consume";
              const isOutput = txn.type === "production_output";
              return (
                <div key={txn.id} className="p-4 flex items-center justify-between hover:bg-surface-container-high/30 transition text-body-sm">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center border font-bold",
                      isStockIn || isOutput
                        ? "bg-success/15 border-success/20 text-success" 
                        : isConsume
                        ? "bg-warning/15 border-warning/20 text-warning"
                        : "bg-error/15 border-error/20 text-error"
                    )}>
                      {isStockIn || isOutput ? "+" : "-"}
                    </div>
                    <div>
                      <p className="font-bold text-white capitalize">
                        {txn.type.replace("_", " ")}: {isStockIn || isOutput ? "+" : "-"}{txn.quantity} {txn.unit}
                      </p>
                      <p className="text-on-surface-variant text-body-xs mt-0.5">{txn.reason || "BOM allocation"}</p>
                    </div>
                  </div>
                  <div className="text-right text-body-xs text-on-surface-variant">
                    <p className="font-semibold text-white">{new Date(txn.createdAt).toLocaleDateString()}</p>
                    <p className="mt-0.5">{new Date(txn.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="p-6 text-center text-on-surface-variant italic">
              No transactions recorded for this item.
            </div>
          )}
        </Card>
      </section>

      {/* Edit Item Unit Cost Modal */}
      {isEditUnitCostOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={() => setIsEditUnitCostOpen(false)} />
          <Card className="relative z-10 w-full max-w-sm p-6 bg-surface-container border border-outline-variant/30 shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
            <h3 className="text-headline-md font-bold text-white mb-4">Edit Unit Cost</h3>
            <div className="space-y-1">
              <label className="text-label-sm text-outline uppercase font-bold">Unit Cost (₱)</label>
              <Input type="number" value={newUnitCost} onChange={e => setNewUnitCost(e.target.value)} />
            </div>
            <div className="flex gap-3 justify-end mt-6 pt-4 border-t border-outline-variant/20">
              <Button variant="ghost" onClick={() => setIsEditUnitCostOpen(false)}>Cancel</Button>
              <Button onClick={handleSaveUnitCost}>Save Cost</Button>
            </div>
          </Card>
        </div>
      )}

      {/* Edit Product Modal */}
      {isEditProductOpen && product && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={() => setIsEditProductOpen(false)} />
          <Card className="relative z-10 w-full max-w-lg p-6 bg-surface-container border border-outline-variant/30 shadow-[0_20px_50px_rgba(0,0,0,0.5)] max-h-[85vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-4 border-b border-outline-variant/20 mb-4">
              <h3 className="text-headline-sm font-bold text-white">Edit Product Profile</h3>
              <Button variant="ghost" size="icon" onClick={() => setIsEditProductOpen(false)} className="rounded-full h-8 w-8">
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-label-sm text-outline uppercase font-bold">Brand</label>
                  <Input value={editBrand} onChange={(e) => setEditBrand(e.target.value)} placeholder="Keeva" />
                </div>
                <div className="space-y-1">
                  <label className="text-label-sm text-outline uppercase font-bold">Product Code</label>
                  <Input value={editCode} onChange={(e) => setEditCode(e.target.value)} placeholder="KV-AIR-01" />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-label-sm text-outline uppercase font-bold">Product Name</label>
                <Input value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="Airzen" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-label-sm text-outline uppercase font-bold">Scent</label>
                  <Input value={editScent} onChange={(e) => setEditScent(e.target.value)} placeholder="Lavender" />
                </div>
                <div className="space-y-1">
                  <label className="text-label-sm text-outline uppercase font-bold">Family</label>
                  <Input value={editFamily} onChange={(e) => setEditFamily(e.target.value)} placeholder="Floral" />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-label-sm text-outline uppercase font-bold">Category</label>
                <Input value={editCategory} onChange={(e) => setEditCategory(e.target.value)} placeholder="Air Care" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <label className="text-label-sm text-outline uppercase font-bold">Default Batch Size</label>
                  <Input type="number" value={editBatchSize} onChange={(e) => setEditBatchSize(Number(e.target.value))} />
                </div>
                <div className="space-y-1">
                  <label className="text-label-sm text-outline uppercase font-bold">Output Unit</label>
                  <select 
                    value={editOutputUnit} 
                    onChange={e => setEditOutputUnit(e.target.value)} 
                    className="flex h-12 w-full rounded-md border border-outline bg-surface-container px-3 py-2 text-body-md text-white focus:outline-none"
                  >
                    <option value="pcs">pcs</option>
                    <option value="gallon">gallon</option>
                    <option value="liter">liter</option>
                    <option value="kg">kg</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-label-sm text-outline uppercase font-bold">Notes</label>
                <Textarea value={editNotes} onChange={(e) => setEditNotes(e.target.value)} placeholder="Product storage rules..." rows={3} />
              </div>
            </div>

            <div className="flex gap-3 justify-end pt-4 border-t border-outline-variant/20 mt-6">
              <Button variant="ghost" onClick={() => setIsEditProductOpen(false)}>Cancel</Button>
              <Button onClick={handleSaveProductProfile}>Save Specifications</Button>
            </div>
          </Card>
        </div>
      )}

      {/* Duplicate Product Modal */}
      {isDuplicateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={() => setIsDuplicateOpen(false)} />
          <Card className="relative z-10 w-full max-w-sm p-6 bg-surface-container border border-outline-variant/30 shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
            <h3 className="text-headline-md font-bold text-white mb-2">Duplicate Product Profile?</h3>
            <p className="text-body-md text-on-surface-variant mb-6">
              This will clone product fields and copy all BOM recipe lines over. Stock level will start at 0.
            </p>
            <div className="flex gap-3 justify-end">
              <Button variant="ghost" onClick={() => setIsDuplicateOpen(false)}>Cancel</Button>
              <Button onClick={handleDuplicateProduct}>Duplicate</Button>
            </div>
          </Card>
        </div>
      )}

      {/* Archive Modal */}
      {isArchiveOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={() => setIsArchiveOpen(false)} />
          <Card className="relative z-10 w-full max-w-sm p-6 bg-surface-container border border-outline-variant/30 shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
            <h3 className="text-headline-md font-bold text-white mb-2">Archive Item?</h3>
            <p className="text-body-md text-on-surface-variant mb-6">
              This hides it from active inventory list, keeping transaction history safe.
            </p>
            <div className="flex gap-3 justify-end">
              <Button variant="ghost" onClick={() => setIsArchiveOpen(false)}>Cancel</Button>
              <Button onClick={isFinishedGood ? handleArchiveProduct : () => { archiveInventoryItem(item.id); router.push("/inventory"); }}>Archive</Button>
            </div>
          </Card>
        </div>
      )}

      {/* Delete Product Modal */}
      {isDeleteOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={() => setIsDeleteOpen(false)} />
          <Card className="relative z-10 w-full max-w-sm p-6 bg-surface-container border border-outline-variant/30 shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
            <h3 className="text-headline-md font-bold text-error mb-2">Delete Item?</h3>
            <p className="text-body-md text-on-surface-variant mb-6">
              Permanent delete is disabled for MVP. We recommend archiving instead.
            </p>
            <div className="flex flex-col gap-2">
              <Button variant="secondary" onClick={isFinishedGood ? handleDeleteProduct : () => { archiveInventoryItem(item.id); router.push("/inventory"); }}>
                Archive Instead (Recommended)
              </Button>
              <Button variant="ghost" onClick={() => setIsDeleteOpen(false)}>Cancel</Button>
            </div>
          </Card>
        </div>
      )}

      {/* Copy BOM Modal */}
      {isCopyBOMOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={() => setIsCopyBOMOpen(false)} />
          <Card className="relative z-10 w-full max-w-md p-6 bg-surface-container border border-outline-variant/30 shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
            <div className="flex justify-between items-center pb-4 border-b border-outline-variant/20 mb-4">
              <h3 className="text-headline-md font-bold text-white">Copy BOM Specifications</h3>
              <Button variant="ghost" size="icon" onClick={() => setIsCopyBOMOpen(false)} className="rounded-full h-8 w-8">
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="text-label-sm text-outline uppercase font-bold">Source Product</label>
                <select 
                  value={copySourceProductId} 
                  onChange={e => setCopySourceProductId(e.target.value)}
                  className="mt-1 flex h-12 w-full rounded-md border border-outline bg-surface-container px-3 py-2 text-body-md text-white focus:outline-none"
                >
                  <option value="">Select source...</option>
                  {products
                    .filter(p => p.id !== product?.id)
                    .map(p => {
                      const count = productBomLines.filter(line => line.productId === p.id).length;
                      return (
                        <option key={p.id} value={p.id}>{p.name} ({p.sku} - {count} items)</option>
                      );
                    })}
                </select>
              </div>

              <div>
                <label className="text-label-sm text-outline uppercase font-bold">Copy Method</label>
                <div className="grid grid-cols-2 gap-3 mt-1">
                  <button 
                    type="button"
                    onClick={() => setCopyMethod("replace")}
                    className={cn(
                      "p-3 rounded-xl border text-center font-semibold text-body-md transition",
                      copyMethod === "replace" 
                        ? "bg-primary/10 border-primary text-primary" 
                        : "border-outline-variant/30 text-on-surface-variant hover:bg-surface-container-high"
                    )}
                  >
                    Replace Current BOM
                  </button>
                  <button 
                    type="button"
                    onClick={() => setCopyMethod("append")}
                    className={cn(
                      "p-3 rounded-xl border text-center font-semibold text-body-md transition",
                      copyMethod === "append" 
                        ? "bg-primary/10 border-primary text-primary" 
                        : "border-outline-variant/30 text-on-surface-variant hover:bg-surface-container-high"
                    )}
                  >
                    Append to BOM
                  </button>
                </div>
              </div>
            </div>

            <div className="flex gap-3 justify-end pt-6 border-t border-outline-variant/20 mt-6">
              <Button variant="ghost" onClick={() => setIsCopyBOMOpen(false)}>Cancel</Button>
              <Button onClick={handleCopyBOM} disabled={!copySourceProductId}>Copy Specs</Button>
            </div>
          </Card>
        </div>
      )}

      {/* Improved BOM Editor Modal */}
      {false && isEditBOMOpen && product && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={() => setIsEditBOMOpen(false)} />
          <Card className="relative z-10 w-full max-w-3xl max-h-[85vh] flex flex-col p-6 bg-surface-container border border-outline-variant/30 shadow-[0_20px_50px_rgba(0,0,0,0.5)] overflow-hidden">
            <div className="flex justify-between items-center pb-4 border-b border-outline-variant/20 mb-4 shrink-0">
              <h3 className="text-headline-md font-bold text-white flex items-center gap-2">
                <GitBranch className="h-5 w-5 text-primary shrink-0" /> <span className="truncate">BOM Editor</span>
              </h3>
              <Button variant="ghost" size="icon" onClick={() => setIsEditBOMOpen(false)} className="rounded-full h-8 w-8 shrink-0">
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="flex-grow overflow-y-auto space-y-6 pr-2">
              {/* Product batch configuration */}
              <div className="grid grid-cols-2 gap-4 bg-surface-container-low p-4 rounded-xl border border-outline-variant/10">
                <div>
                  <label className="text-label-sm text-outline uppercase font-bold">Batch Size</label>
                  <Input 
                    type="number" 
                    value={bomBatchSize} 
                    onChange={e => setBomBatchSize(Number(e.target.value))} 
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-label-sm text-outline uppercase font-bold">Output Unit</label>
                  <select 
                    value={bomOutputUnit} 
                    onChange={e => setBomOutputUnit(e.target.value)} 
                    className="mt-1 flex h-12 w-full rounded-md border border-outline bg-surface-container px-3 py-2 text-body-md text-white focus:outline-none"
                  >
                    <option value="pcs">pcs</option>
                    <option value="gallon">gallon</option>
                    <option value="liter">liter</option>
                    <option value="kg">kg</option>
                  </select>
                </div>
              </div>

              {/* Grouped BOM lines */}
              <div className="space-y-6">
                {(() => {
                  const totals = { raw_material: 0, packaging: 0, manpower: 0, other_cost: 0 };
                  tempBomLines.forEach(line => {
                    const matchedItem = inventoryItems.find(i => i.id === line.inventoryItemId);
                    const cost = line.costOverride !== undefined && line.costOverride !== null ? line.costOverride : (matchedItem?.unitCost ?? 0);
                    totals[line.lineType] += cost * line.quantityPerBatch;
                  });
                  const bomTotal = totals.raw_material + totals.packaging + totals.manpower + totals.other_cost;

                  return (
                    <>
                      {(["raw_material", "packaging", "manpower", "other_cost"] as const).map(section => {
                        const sectionLines = tempBomLines.filter(l => l.lineType === section);
                        const title = section === "raw_material" 
                          ? "INGREDIENTS" 
                          : section === "packaging" 
                          ? "PACKAGING" 
                          : section === "manpower" 
                          ? "MANPOWER" 
                          : "OTHER COSTS";
                        const addButtonLabel = section === "raw_material"
                          ? "+ Add ingredient"
                          : section === "packaging"
                          ? "+ Add packaging"
                          : "+ Add cost";

                        return (
                          <div key={section} className="space-y-3">
                            <div className="flex items-center justify-between border-b border-outline-variant/10 pb-1.5">
                              <h4 className="text-label-md font-bold uppercase text-white">
                                {title}
                              </h4>
                              <button 
                                type="button" 
                                className="text-primary hover:text-primary/80 font-bold text-label-sm"
                                onClick={() => handleOpenAddLine(section)}
                              >
                                {addButtonLabel}
                              </button>
                            </div>
                            
                            {sectionLines.length === 0 && (!isAddingLine || subFormType !== section) && (
                              <p className="text-body-xs text-on-surface-variant italic py-1">No items drafted in this section.</p>
                            )}
                            
                            <div className="space-y-2">
                              {tempBomLines.map((line, idx) => {
                                if (line.lineType !== section) return null;
                                const matchedItem = inventoryItems.find(i => i.id === line.inventoryItemId);
                                const cost = line.costOverride !== undefined && line.costOverride !== null
                                  ? line.costOverride 
                                  : (matchedItem?.unitCost ?? 0);
                                const labelName = matchedItem ? matchedItem.name : (line.notes || "Overhead");
                                
                                return (
                                  <div key={idx} className="flex flex-col sm:flex-row sm:items-center justify-between py-2 px-3 bg-surface-container-low border border-outline-variant/20 rounded-lg gap-3">
                                    <div className="flex-1 min-w-0">
                                      <p className="text-body-sm font-semibold text-white line-clamp-2">{labelName}</p>
                                      <p className="text-body-xs text-on-surface-variant mt-0.5">
                                        Qty: {line.quantityPerBatch} {line.unit} • Unit Cost: {formatMoney(cost)}
                                        {cost === 0 && <span className="text-warning font-semibold ml-1">• Missing cost</span>}
                                      </p>
                                    </div>
                                    
                                    {deleteLineIndex === idx ? (
                                      <div className="flex items-center gap-2 bg-surface-container-high p-2 rounded-md border border-error/20">
                                        <span className="text-body-xs text-error font-bold">Delete BOM line?</span>
                                        <Button size="sm" variant="ghost" className="h-8 text-xs px-2" onClick={cancelDeleteLine}>Cancel</Button>
                                        <Button size="sm" className="bg-error text-white h-8 text-xs px-2 hover:bg-error/90" onClick={executeDeleteLine}>Delete</Button>
                                      </div>
                                    ) : (
                                      <div className="flex items-center gap-1 mt-2 sm:mt-0 justify-end shrink-0">
                                        <Button size="icon" variant="ghost" className="h-9 w-9 text-secondary" onClick={() => handleOpenLineEdit(idx)}>
                                          <Edit3 className="h-4 w-4" />
                                        </Button>
                                        <Button size="icon" variant="ghost" className="h-9 w-9 text-success" onClick={() => handleDuplicateBOMItem(idx)}>
                                          <Copy className="h-4 w-4" />
                                        </Button>
                                        <Button size="icon" variant="ghost" className="h-9 w-9 text-error" onClick={() => confirmDeleteLine(idx)}>
                                          <Trash className="h-4 w-4" />
                                        </Button>
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                            
                            {/* Inline Add/Edit Form for this section */}
                            {isAddingLine && subFormType === section && (
                              <div className="p-4 bg-surface-container-high border border-primary/30 rounded-xl space-y-4 mt-2 shadow-lg">
                                <h4 className="text-label-sm font-bold text-white flex items-center gap-1">
                                  {editingLineIndex !== null ? "Edit BOM Line" : "Add BOM Line"}
                                </h4>
                                
                                <div className="grid grid-cols-1 gap-3">
                                  {subFormType === "raw_material" || subFormType === "packaging" ? (
                                    <div className="space-y-1">
                                      <select 
                                        value={bomItemId} 
                                        onChange={e => {
                                          setBomItemId(e.target.value);
                                          const matched = inventoryItems.find(i => i.id === e.target.value);
                                          if (matched) {
                                            setBomUnit(matched.unit);
                                            setBomCostOverride(matched.unitCost !== undefined ? matched.unitCost.toString() : "");
                                          }
                                        }}
                                        className="flex h-10 w-full rounded-md border border-outline bg-surface-container px-3 text-body-sm text-white focus:outline-none"
                                      >
                                        <option value="">Search raw material, packaging, or code...</option>
                                        <option value="NEW_ITEM">+ Add new inventory item</option>
                                        {inventoryItems
                                          .filter(i => i.category === (subFormType === "raw_material" ? "raw" : "packaging") && !i.isArchived)
                                          .map(i => (
                                            <option key={i.id} value={i.id}>{i.name} ({i.sku})</option>
                                          ))}
                                      </select>
                                    </div>
                                  ) : (
                                    <div className="space-y-1">
                                      <label className="text-label-xs text-outline uppercase font-semibold">Cost Name</label>
                                      <Input 
                                        placeholder="e.g. Labor per batch"
                                        value={bomNotes}
                                        onChange={e => setBomNotes(e.target.value)}
                                        className="h-10"
                                      />
                                    </div>
                                  )}

                                  <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                      <label className="text-label-xs text-outline uppercase font-semibold">Quantity</label>
                                      <div className="relative">
                                        <Input 
                                          type="number" 
                                          placeholder="0.0" 
                                          value={bomQty}
                                          onChange={e => setBomQty(e.target.value)}
                                          className="h-10 pr-12 text-right"
                                        />
                                        <span className="absolute right-3 top-2.5 text-body-sm text-on-surface-variant font-bold">
                                          {subFormType === "raw_material" || subFormType === "packaging"
                                            ? (inventoryItems.find(i => i.id === bomItemId)?.unit ?? "unit")
                                            : "unit"}
                                        </span>
                                      </div>
                                    </div>

                                    <div className="space-y-1">
                                      <label className="text-label-xs text-outline uppercase font-semibold">Unit Cost</label>
                                      <Input 
                                        type="number" 
                                        placeholder="Default" 
                                        value={bomCostOverride}
                                        onChange={e => setBomCostOverride(e.target.value)}
                                        className="h-10 text-right"
                                      />
                                    </div>
                                  </div>

                                  {(subFormType === "raw_material" || subFormType === "packaging") && (
                                    <div className="space-y-1">
                                      <label className="text-label-xs text-outline uppercase font-semibold">Notes (Optional)</label>
                                      <Input 
                                        placeholder="Optional notes" 
                                        value={bomNotes}
                                        onChange={e => setBomNotes(e.target.value)}
                                        className="h-10"
                                      />
                                    </div>
                                  )}
                                </div>

                                {showDuplicateWarning && (
                                  <div className="p-3 bg-warning-container/20 border border-warning/30 rounded-lg flex items-center justify-between text-warning">
                                    <span className="text-body-xs font-semibold">
                                      Item already exists. Add duplicate?
                                    </span>
                                    <div className="flex gap-2">
                                      <Button size="sm" className="bg-warning text-black h-8 text-xs" onClick={() => handleAddBOMItem(true)}>Confirm</Button>
                                    </div>
                                  </div>
                                )}

                                <div className="flex gap-2 justify-end pt-2 border-t border-outline-variant/10">
                                  <Button size="sm" variant="ghost" onClick={() => { setIsAddingLine(false); setEditingLineIndex(null); }}>Cancel</Button>
                                  {editingLineIndex !== null ? (
                                    <Button size="sm" onClick={handleSaveLineEdit}>Save line</Button>
                                  ) : (
                                    <Button size="sm" onClick={() => handleAddBOMItem(false)}>Add to BOM</Button>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}

                      <div className="p-4 bg-surface-container-low border border-outline-variant/10 rounded-xl mt-6 space-y-1">
                        <h4 className="text-label-sm font-bold text-white uppercase mb-2">Summary</h4>
                        <div className="flex justify-between text-body-sm text-on-surface-variant">
                          <span>Ingredients total:</span> <span>{formatMoney(totals.raw_material)}</span>
                        </div>
                        <div className="flex justify-between text-body-sm text-on-surface-variant">
                          <span>Packaging total:</span> <span>{formatMoney(totals.packaging)}</span>
                        </div>
                        <div className="flex justify-between text-body-sm text-on-surface-variant">
                          <span>Manpower total:</span> <span>{formatMoney(totals.manpower)}</span>
                        </div>
                        <div className="flex justify-between text-body-sm text-on-surface-variant">
                          <span>Other total:</span> <span>{formatMoney(totals.other_cost)}</span>
                        </div>
                        <div className="flex justify-between text-body-md font-bold text-white border-t border-outline-variant/10 pt-2 mt-2">
                          <span>BOM total:</span> <span>{formatMoney(bomTotal)}</span>
                        </div>
                      </div>
                    </>
                  );
                })()}
              </div>
            </div>

            <div className="flex gap-3 justify-end p-4 border-t border-outline-variant/20 bg-surface-container shrink-0 z-10 sticky bottom-0">
              <Button variant="ghost" onClick={() => setIsEditBOMOpen(false)}>Cancel</Button>
              <Button onClick={handleSaveBOMEditor}>Save BOM</Button>
            </div>
          </Card>
        </div>
      )}
    </AppShell>
  );
}

function SearchableBomPicker({
  boms,
  value,
  query,
  onQueryChange,
  onChange
}: Readonly<{
  boms: MasterBom[];
  value: string;
  query: string;
  onQueryChange: (value: string) => void;
  onChange: (bomId: string) => void;
}>) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const previousSelectedIdRef = useRef<string>("");
  const listboxId = useId();
  const [isOpen, setIsOpen] = useState(false);
  const selected = boms.find(bom => bom.id === value);

  useEffect(() => {
    if (selected && previousSelectedIdRef.current !== selected.id) {
      previousSelectedIdRef.current = selected.id;
      onQueryChange(`${selected.name} - ${selected.family}`);
    }
  }, [onQueryChange, selected]);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) setIsOpen(false);
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  const matches = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const source = normalized
      ? boms.filter(bom => `${bom.name} ${bom.family} ${bom.yieldQty} ${bom.yieldUnit}`.toLowerCase().includes(normalized))
      : boms;
    return source.slice(0, 10);
  }, [boms, query]);

  return (
    <div ref={wrapperRef} className="relative">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-3 h-4 w-4 text-outline" />
        <Input
          aria-autocomplete="list"
          aria-controls={listboxId}
          aria-expanded={isOpen}
          className="h-10 pl-9 text-[13px]"
          onChange={event => {
            onQueryChange(event.target.value);
            setIsOpen(true);
          }}
          onFocus={() => setIsOpen(true)}
          placeholder="Search BOM name, family, or yield..."
          role="combobox"
          value={query}
        />
      </div>
      {isOpen && (
        <div id={listboxId} className="absolute left-0 right-0 top-[calc(100%+4px)] z-50 max-h-64 overflow-y-auto rounded-md border border-outline-variant bg-surface-container-high p-1 shadow-xl">
          {matches.length === 0 ? (
            <p className="px-2 py-3 text-center text-[12px] text-on-surface-variant">No matching BOM found.</p>
          ) : matches.map(bom => (
            <button
              key={bom.id}
              type="button"
              role="option"
              aria-selected={bom.id === value}
              className={cn(
                "block w-full rounded px-2 py-2 text-left text-[12px] text-white hover:bg-surface-variant",
                bom.id === value && "bg-primary/15 text-primary"
              )}
              onClick={() => {
                onChange(bom.id);
                onQueryChange(`${bom.name} - ${bom.family}`);
                setIsOpen(false);
              }}
            >
              <span className="block truncate font-semibold">{bom.name}</span>
              <span className="block truncate text-[11px] text-on-surface-variant">
                {bom.family} &bull; Yield {bom.yieldQty} {bom.yieldUnit} &bull; {bom.lines.length} lines
              </span>
            </button>
          ))}
        </div>
      )}
      {selected && (
        <p className="mt-1 text-[11.5px] text-on-surface-variant">
          Selected: {selected.name} &bull; {selected.lines.length} BOM lines will sync to this product when applied.
        </p>
      )}
    </div>
  );
}
