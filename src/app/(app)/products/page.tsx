"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useApp } from "@/context/app-context";
import {
  Plus,
  GitBranch,
  Copy,
  Archive,
  Trash2,
  Edit,
  Eye,
  EyeOff,
  MoreVertical,
  X,
  Sparkles,
  Info
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { Product, ProductBomLine } from "@/types/domain";

export default function ProductsPage() {
  const {
    products,
    productBomLines,
    inventoryItems,
    updateProduct,
    archiveProduct,
    duplicateProduct,
    deleteProduct,
    updateProductBom,
    addActivityLog
  } = useApp();

  const [searchQuery, setSearchQuery] = useState("");
  const [showArchived, setShowArchived] = useState(false);
  const [activeMenuId, setActiveMenuId] = useState<string | null>(null);

  // Modal states
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDuplicateOpen, setIsDuplicateOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [isArchiveOpen, setIsArchiveOpen] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [isCopyBOMOpen, setIsCopyBOMOpen] = useState(false);

  // Edit Product Form state
  const [editBrand, setEditBrand] = useState("");
  const [editCode, setEditCode] = useState("");
  const [editName, setEditName] = useState("");
  const [editScent, setEditScent] = useState("");
  const [editFamily, setEditFamily] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editBatchSize, setEditBatchSize] = useState(100);
  const [editOutputUnit, setEditOutputUnit] = useState("pcs");
  const [editNotes, setEditNotes] = useState("");

  // Copy BOM Form state
  const [copySourceProductId, setCopySourceProductId] = useState("");
  const [copyMethod, setCopyMethod] = useState<"replace" | "append">("replace");

  // Toast banner state
  const [banner, setBanner] = useState<{ message: string; type: "success" | "info" | "error" } | null>(null);

  const triggerBanner = (message: string, type: "success" | "info" | "error" = "success") => {
    setBanner({ message, type });
    setTimeout(() => setBanner(null), 4000);
  };

  // Helper to resolve product BOM status
  const getBomStatus = (productId: string) => {
    const lines = productBomLines.filter((l) => l.productId === productId);
    if (lines.length === 0) return { label: "No BOM yet", tone: "critical" };
    
    const hasRaw = lines.some((l) => l.lineType === "raw_material");
    const hasPkg = lines.some((l) => l.lineType === "packaging");
    
    if (hasRaw && hasPkg) return { label: "BOM complete", tone: "good" };
    return { label: "Partial BOM", tone: "low" };
  };

  // Filter and search products
  const filteredProducts = useMemo(() => {
    return products
      .filter((p) => (showArchived ? p.isArchived : !p.isArchived))
      .filter((p) => {
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        return (
          p.name.toLowerCase().includes(q) ||
          p.sku.toLowerCase().includes(q) ||
          (p.brand && p.brand.toLowerCase().includes(q)) ||
          (p.scent && p.scent.toLowerCase().includes(q))
        );
      });
  }, [products, showArchived, searchQuery]);

  // Handle Edit Action
  const openEditModal = (prod: Product) => {
    setEditingProduct(prod);
    setEditBrand(prod.brand ?? "");
    setEditCode(prod.sku);
    setEditName(prod.name);
    setEditScent(prod.scent ?? "");
    setEditFamily(prod.family ?? "Floral");
    setEditCategory(prod.category ?? "Air Care");
    setEditBatchSize(prod.batchSize);
    setEditOutputUnit(prod.outputUnit);
    setEditNotes(prod.notes ?? "");
    setIsEditModalOpen(true);
    setActiveMenuId(null);
  };

  const handleSaveProduct = () => {
    if (!editingProduct) return;
    
    // Combine full name if brand and scent are added
    const combinedName = `${editBrand} ${editName} ${editScent}`.trim();

    updateProduct(editingProduct.id, {
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

    setIsEditModalOpen(false);
    triggerBanner("Product specifications saved successfully!");
  };

  // Handle Duplicate Action
  const triggerDuplicate = (prod: Product) => {
    setSelectedProduct(prod);
    setIsDuplicateOpen(true);
    setActiveMenuId(null);
  };

  const handleDuplicate = () => {
    if (!selectedProduct) return;
    const duplicated = duplicateProduct(selectedProduct.id);
    setIsDuplicateOpen(false);
    triggerBanner(`Product duplicated: "${duplicated.name}"`, "success");
  };

  // Handle Archive Action
  const triggerArchive = (prod: Product) => {
    setSelectedProduct(prod);
    setIsArchiveOpen(true);
    setActiveMenuId(null);
  };

  const handleArchive = () => {
    if (!selectedProduct) return;
    archiveProduct(selectedProduct.id);
    setIsArchiveOpen(false);
    triggerBanner(`"${selectedProduct.name}" has been archived.`, "info");
  };

  // Handle Delete Action
  const triggerDelete = (prod: Product) => {
    setSelectedProduct(prod);
    setIsDeleteOpen(true);
    setActiveMenuId(null);
  };

  const handleDelete = () => {
    if (!selectedProduct) return;
    // MVP policy: Permanent delete is disabled, archive instead
    archiveProduct(selectedProduct.id);
    setIsDeleteOpen(false);
    triggerBanner("Permanent delete is disabled for MVP. Product was archived instead.", "error");
  };

  // Handle Copy BOM Modal
  const triggerCopyBOM = (prod: Product) => {
    setSelectedProduct(prod);
    setCopySourceProductId("");
    setCopyMethod("replace");
    setIsCopyBOMOpen(true);
    setActiveMenuId(null);
  };

  const handleCopyBOM = () => {
    if (!selectedProduct || !copySourceProductId) return;
    
    const sourceBomLines = productBomLines.filter((l) => l.productId === copySourceProductId);
    if (sourceBomLines.length === 0) {
      triggerBanner("Selected source product has an empty BOM.", "error");
      return;
    }

    const linesToImport = sourceBomLines.map((line) => ({
      inventoryItemId: line.inventoryItemId,
      quantityPerBatch: line.quantityPerBatch,
      unit: line.unit,
      lineType: line.lineType,
      costOverride: line.costOverride,
      wastagePercent: line.wastagePercent,
      notes: line.notes
    }));

    if (copyMethod === "replace") {
      updateProductBom(selectedProduct.id, linesToImport);
    } else {
      // Append and merge
      const currentLines = productBomLines.filter((l) => l.productId === selectedProduct.id);
      const merged = currentLines.map((l) => ({
        inventoryItemId: l.inventoryItemId,
        quantityPerBatch: l.quantityPerBatch,
        unit: l.unit,
        lineType: l.lineType,
        costOverride: l.costOverride,
        wastagePercent: l.wastagePercent,
        notes: l.notes
      }));

      linesToImport.forEach((importedLine) => {
        const idx = merged.findIndex(
          (l) => l.inventoryItemId === importedLine.inventoryItemId && l.lineType === importedLine.lineType
        );
        if (idx > -1) {
          merged[idx].quantityPerBatch += importedLine.quantityPerBatch;
        } else {
          merged.push(importedLine);
        }
      });
      
      updateProductBom(selectedProduct.id, merged);
    }

    addActivityLog({
      actorName: "Mara Santos",
      action: `Copied BOM from product ${copySourceProductId} to ${selectedProduct.name}`,
      entityType: "product",
      entityId: selectedProduct.id
    });

    setIsCopyBOMOpen(false);
    triggerBanner("BOM copied successfully!", "success");
  };

  return (
    <AppShell>
      {/* Toast Alert */}
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

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-headline-md font-bold text-white">Products & BOMs</h2>
          <p className="text-body-sm text-on-surface-variant mt-0.5">Define formulations, batch settings, and cost recipes.</p>
        </div>
        <Button asChild>
          <Link href="/products/new">
            <Plus className="h-5 w-5 mr-1" /> Add Product
          </Link>
        </Button>
      </div>

      {/* Search & Archived Toggle */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-grow">
          <input
            type="text"
            className="flex h-12 w-full rounded-md border border-outline-variant bg-surface-container px-4 pl-10 text-body-md text-white placeholder-outline focus:outline-none focus:ring-1 focus:ring-primary"
            placeholder="Search products, brand, scent..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
          <span className="absolute left-3.5 top-3.5 text-outline text-body-md">🔍</span>
        </div>
        
        <Button
          variant={showArchived ? "secondary" : "ghost"}
          onClick={() => setShowArchived(!showArchived)}
          className="border border-outline-variant/30 flex items-center gap-2 h-12"
        >
          {showArchived ? <Eye className="h-5 w-5" /> : <EyeOff className="h-5 w-5" />}
          {showArchived ? "Viewing Archived" : "Show Archived"}
        </Button>
      </div>

      {/* Products Row Grid */}
      <div className="space-y-3 pb-16">
        {filteredProducts.length > 0 ? (
          filteredProducts.map((p) => {
            const bomStatus = getBomStatus(p.id);
            const bomCount = productBomLines.filter((l) => l.productId === p.id).length;
            
            // Generate initials for product thumbnail icon
            const initials = p.name ? p.name.split(" ").map(w => w[0]).join("").substring(0, 2).toUpperCase() : "PD";

            return (
              <div 
                key={p.id}
                className="flex items-center justify-between p-4 bg-surface-container border border-outline-variant/20 rounded-xl hover:border-primary/20 transition relative group"
              >
                <div className="flex items-center gap-4 min-w-0">
                  {/* Thumbnail placeholder */}
                  <div className="w-12 h-12 rounded-lg bg-navy flex items-center justify-center font-bold text-primary text-body-lg shrink-0">
                    {initials}
                  </div>
                  
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-body-md font-bold text-white truncate max-w-[200px] sm:max-w-xs">{p.name}</h3>
                      <span className={cn(
                        "text-[10px] font-bold uppercase px-2 py-0.5 rounded border tracking-wider",
                        bomStatus.tone === "good"
                          ? "bg-success/10 border-success/20 text-success"
                          : bomStatus.tone === "low"
                          ? "bg-warning/10 border-warning/20 text-warning"
                          : "bg-error/10 border-error/20 text-error"
                      )}>
                        {bomStatus.label}
                      </span>
                    </div>
                    <p className="text-body-xs text-on-surface-variant mt-1">
                      Code: <span className="text-white font-mono">{p.sku}</span> • Scent: {p.scent ?? "None"} • Cat: {p.category ?? "General"} • Batch: {p.batchSize} {p.outputUnit}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-body-xs text-on-surface-variant font-semibold hidden sm:inline-block">
                    {bomCount} recipe item{bomCount !== 1 ? "s" : ""}
                  </span>

                  {/* Actions Dropdown */}
                  <div className="relative">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      onClick={() => setActiveMenuId(activeMenuId === p.id ? null : p.id)}
                      className="rounded-full h-10 w-10"
                    >
                      <MoreVertical className="h-5 w-5" />
                    </Button>
                    
                    {activeMenuId === p.id && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setActiveMenuId(null)} />
                        <Card className="absolute right-0 mt-2 w-48 bg-surface-container-high border border-outline-variant/30 rounded-xl shadow-2xl z-50 overflow-hidden divide-y divide-outline-variant/10 text-body-sm">
                          <div className="py-1">
                            <Link 
                              href={`/inventory/${p.finishedGoodItemId || "sles"}`}
                              className="flex items-center gap-2 px-4 py-2.5 hover:bg-surface-container-highest transition text-white"
                              onClick={() => setActiveMenuId(null)}
                            >
                              <Eye className="h-4 w-4 text-primary" /> View Details
                            </Link>
                            <button 
                              onClick={() => openEditModal(p)}
                              className="flex w-full items-center gap-2 px-4 py-2.5 hover:bg-surface-container-highest transition text-white"
                            >
                              <Edit className="h-4 w-4 text-secondary" /> Edit Product
                            </button>
                            <Link 
                              href={`/inventory/${p.finishedGoodItemId || "sles"}?editBOM=true`}
                              className="flex items-center gap-2 px-4 py-2.5 hover:bg-surface-container-highest transition text-white"
                              onClick={() => setActiveMenuId(null)}
                            >
                              <GitBranch className="h-4 w-4 text-tertiary" /> Edit BOM
                            </Link>
                            <button 
                              onClick={() => triggerCopyBOM(p)}
                              className="flex w-full items-center gap-2 px-4 py-2.5 hover:bg-surface-container-highest transition text-white"
                            >
                              <Copy className="h-4 w-4 text-primary" /> Copy BOM
                            </button>
                            <button 
                              onClick={() => triggerDuplicate(p)}
                              className="flex w-full items-center gap-2 px-4 py-2.5 hover:bg-surface-container-highest transition text-white"
                            >
                              <Copy className="h-4 w-4 text-success" /> Duplicate
                            </button>
                          </div>
                          <div className="py-1">
                            {p.isArchived ? (
                              <button 
                                onClick={() => { updateProduct(p.id, { isArchived: false }); setActiveMenuId(null); triggerBanner("Product restored!"); }}
                                className="flex w-full items-center gap-2 px-4 py-2.5 hover:bg-surface-container-highest transition text-success"
                              >
                                <Archive className="h-4 w-4" /> Restore
                              </button>
                            ) : (
                              <button 
                                onClick={() => triggerArchive(p)}
                                className="flex w-full items-center gap-2 px-4 py-2.5 hover:bg-surface-container-highest transition text-warning"
                              >
                                <Archive className="h-4 w-4" /> Archive
                              </button>
                            )}
                            <button 
                              onClick={() => triggerDelete(p)}
                              className="flex w-full items-center gap-2 px-4 py-2.5 hover:bg-surface-container-highest transition text-error"
                            >
                              <Trash2 className="h-4 w-4" /> Delete / Fallback
                            </button>
                          </div>
                        </Card>
                      </>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="text-center py-12 bg-surface-container rounded-xl border border-outline-variant/20">
            <p className="text-on-surface-variant text-body-md">
              No products found matching filters.
            </p>
          </div>
        )}
      </div>

      {/* Edit Product Modal */}
      {isEditModalOpen && editingProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={() => setIsEditModalOpen(false)} />
          <Card className="relative z-10 w-full max-w-lg p-6 bg-surface-container border border-outline-variant/30 shadow-[0_20px_50px_rgba(0,0,0,0.5)] max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center pb-4 border-b border-outline-variant/20 mb-4">
              <h3 className="text-headline-sm font-bold text-white">Edit Product Profile</h3>
              <Button variant="ghost" size="icon" onClick={() => setIsEditModalOpen(false)} className="rounded-full h-8 w-8">
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
              <Button variant="ghost" onClick={() => setIsEditModalOpen(false)}>Cancel</Button>
              <Button onClick={handleSaveProduct}>Save Specifications</Button>
            </div>
          </Card>
        </div>
      )}

      {/* Duplicate Confirmation Modal */}
      {isDuplicateOpen && selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={() => setIsDuplicateOpen(false)} />
          <Card className="relative z-10 w-full max-w-sm p-6 bg-surface-container border border-outline-variant/30 shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
            <h3 className="text-headline-md font-bold text-white mb-2">Duplicate Product?</h3>
            <p className="text-body-md text-on-surface-variant mb-6">
              This will create a duplicate specification of "{selectedProduct.name}" and copy all BOM lines over. History logs will not be duplicated.
            </p>
            <div className="flex gap-3 justify-end">
              <Button variant="ghost" onClick={() => setIsDuplicateOpen(false)}>Cancel</Button>
              <Button onClick={handleDuplicate}>Duplicate</Button>
            </div>
          </Card>
        </div>
      )}

      {/* Archive Modal */}
      {isArchiveOpen && selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={() => setIsArchiveOpen(false)} />
          <Card className="relative z-10 w-full max-w-sm p-6 bg-surface-container border border-outline-variant/30 shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
            <h3 className="text-headline-md font-bold text-white mb-2">Archive Product?</h3>
            <p className="text-body-md text-on-surface-variant mb-6">
              This hides "{selectedProduct.name}" from active lists but keeps history and reports safe. You can restore it anytime.
            </p>
            <div className="flex gap-3 justify-end">
              <Button variant="ghost" onClick={() => setIsArchiveOpen(false)}>Cancel</Button>
              <Button onClick={handleArchive}>Archive</Button>
            </div>
          </Card>
        </div>
      )}

      {/* Delete Modal */}
      {isDeleteOpen && selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={() => setIsDeleteOpen(false)} />
          <Card className="relative z-10 w-full max-w-sm p-6 bg-surface-container border border-outline-variant/30 shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
            <h3 className="text-headline-md font-bold text-error mb-2">Delete Product?</h3>
            <p className="text-body-md text-on-surface-variant mb-6">
              This may affect history. Archive is highly recommended instead. Permanent delete is disabled for MVP.
            </p>
            <div className="flex flex-col gap-2">
              <Button variant="secondary" onClick={handleDelete}>
                Archive Instead (Recommended)
              </Button>
              <Button variant="ghost" onClick={() => setIsDeleteOpen(false)}>
                Cancel
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Copy BOM Modal */}
      {isCopyBOMOpen && selectedProduct && (
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
              <div className="p-3 bg-navy/20 border border-primary/20 rounded-xl flex items-start gap-2.5">
                <Info className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <p className="text-body-xs text-on-surface-variant">
                  This will copy ingredients, packaging, manpower, and other costs. You can edit them after copying.
                </p>
              </div>

              <div>
                <label className="text-label-sm text-outline uppercase font-bold">Source Product</label>
                <select 
                  value={copySourceProductId} 
                  onChange={e => setCopySourceProductId(e.target.value)}
                  className="mt-1 flex h-12 w-full rounded-md border border-outline bg-surface-container px-3 py-2 text-body-md text-white focus:outline-none"
                >
                  <option value="">Select source...</option>
                  {products
                    .filter(p => p.id !== selectedProduct.id)
                    .map(p => {
                      const count = productBomLines.filter(line => line.productId === p.id).length;
                      return (
                        <option key={p.id} value={p.id}>{p.name} ({p.sku} - {count} items)</option>
                      );
                    })}
                </select>
              </div>

              <div>
                <label className="text-label-sm text-outline uppercase font-bold">Copy Mode</label>
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
    </AppShell>
  );
}
