"use client";

import { use, useMemo, useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AppShell } from "@/components/layout/app-shell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useApp } from "@/context/app-context";
import {
  ArrowLeft,
  Calendar,
  CheckCircle,
  AlertTriangle,
  Info,
  Layers,
  Sparkles,
  Plus,
  Play,
  RotateCcw,
  Boxes,
  FileSpreadsheet,
  X
} from "lucide-react";
import { formatMoney, cn } from "@/lib/utils";

export default function ProductionJobDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const resolvedParams = use(params);
  const jobId = resolvedParams.id;

  const {
    productionJobs,
    products,
    productBomLines,
    inventoryItems,
    stockTransactions,
    activityLogs,
    updateProductionJob,
    duplicateProductionJob,
    moveProductionJobToProcess,
    releaseJobMaterials,
    completeProductionJob,
    addCompoundToJob,
    addActivityLog
  } = useApp();

  const job = useMemo(() => productionJobs.find((j) => j.id === jobId), [productionJobs, jobId]);

  // Transactions related to this job
  const jobTransactions = useMemo(() => 
    stockTransactions.filter((t) => t.productionJobId === jobId),
    [stockTransactions, jobId]
  );

  // Logs related to this job
  const jobLogs = useMemo(() => 
    activityLogs.filter((l) => l.entityId === jobId && l.entityType === "production_job"),
    [activityLogs, jobId]
  );

  const historyEntries = useMemo(() => {
    const transactionEntries = stockTransactions
      .filter((txn) => txn.productionJobId === jobId)
      .map((txn) => {
        const item = inventoryItems.find(i => i.id === txn.inventoryItemId);
        return {
          id: txn.id,
          action: txn.type === "production_output"
            ? `Finished goods added: ${item?.name ?? "Item"} ${txn.quantity} ${txn.unit}`
            : `Inventory deducted: ${item?.name ?? "Item"} ${txn.quantity} ${txn.unit}`,
          actorName: "Admin",
          createdAt: txn.createdAt
        };
      });

    return [...jobLogs, ...transactionEntries]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 6);
  }, [jobLogs, stockTransactions, inventoryItems, jobId]);

  // Local state for releases
  const [releaseQuantities, setReleaseQuantities] = useState<Record<string, string>>({});
  
  // State for manual compound addition
  const [additionalItemId, setAdditionalItemId] = useState("");
  const [additionalQty, setAdditionalQty] = useState("");
  const [additionalReason, setAdditionalReason] = useState("");

  // Modals & Toast State
  const [isCompleteModalOpen, setIsCompleteModalOpen] = useState(false);
  const [isToProcessModalOpen, setIsToProcessModalOpen] = useState(false);
  const [completedOutputs, setCompletedOutputs] = useState<Record<string, string>>({});
  const [trackingDraft, setTrackingDraft] = useState({
    dueDate: "",
    purpose: "stock" as "stock" | "order" | "custom",
    referenceNote: "",
    preparedBy: "",
    createdAt: "",
    startedAt: "",
    completedAt: ""
  });
  const [banner, setBanner] = useState<{ message: string; type: "success" | "info" | "error" } | null>(null);

  // Sync complete outputs map
  useEffect(() => {
    if (job) {
      const initialMap: Record<string, string> = {};
      if (job.productLines && job.productLines.length > 0) {
        job.productLines.forEach(line => {
          const prod = products.find(p => p.id === line.productId);
          if (prod) {
            initialMap[prod.id] = (prod.batchSize * line.plannedBatchQty).toString();
          }
        });
      } else {
        const prod = products.find(p => p.id === job.productId);
        if (prod) {
          initialMap[prod.id] = (prod.batchSize * job.plannedBatchQty).toString();
        }
      }
      setCompletedOutputs(initialMap);
      setTrackingDraft({
        dueDate: toDateTimeLocal(job.dueDate),
        purpose: job.purpose ?? (job.referenceNote ? "order" : "stock"),
        referenceNote: job.referenceNote ?? "",
        preparedBy: job.preparedBy ?? "",
        createdAt: toDateTimeLocal(job.createdAt),
        startedAt: toDateTimeLocal(job.startedAt),
        completedAt: toDateTimeLocal(job.completedAt)
      });
    }
  }, [job, products]);

  const triggerBanner = (message: string, type: "success" | "info" | "error" = "success") => {
    setBanner({ message, type });
    setTimeout(() => setBanner(null), 4000);
  };

  // Compile list of products in the plan
  const planProducts = useMemo(() => {
    if (!job) return [];
    if (job.productLines && job.productLines.length > 0) {
      return job.productLines.map(line => {
        const prod = products.find(p => p.id === line.productId);
        return {
          productId: line.productId,
          plannedBatchQty: line.plannedBatchQty,
          name: prod?.name ?? "Unknown Product",
          sku: prod?.sku ?? "N/A",
          batchSize: prod?.batchSize ?? 100,
          outputUnit: prod?.outputUnit ?? "pcs"
        };
      });
    }
    // Fallback
    const prod = products.find(p => p.id === job.productId);
    return [{
      productId: job.productId,
      plannedBatchQty: job.plannedBatchQty,
      name: prod?.name ?? "Unknown Product",
      sku: prod?.sku ?? "N/A",
      batchSize: prod?.batchSize ?? 100,
      outputUnit: prod?.outputUnit ?? "pcs"
    }];
  }, [job, products]);

  // Aggregate BOM Requirements across all products in plan + manual planned compounds
  const materialLines = useMemo(() => {
    if (!job) return [];

    const requirementsMap: Record<string, { required: number; unit: string; lineType: string }> = {};

    // 1. Accumulate BOM lines from all product lines in plan
    planProducts.forEach(prodLine => {
      const boms = productBomLines.filter(line => line.productId === prodLine.productId);
      boms.forEach(bom => {
        if (!bom.inventoryItemId) return;
        const requiredQty = bom.quantityPerBatch * prodLine.plannedBatchQty;
        const wastageMult = bom.wastagePercent ? (1 + bom.wastagePercent / 100) : 1;
        const finalQty = requiredQty * wastageMult;

        if (!requirementsMap[bom.inventoryItemId]) {
          requirementsMap[bom.inventoryItemId] = {
            required: 0,
            unit: bom.unit || "kg",
            lineType: bom.lineType
          };
        }
        requirementsMap[bom.inventoryItemId].required += finalQty;
      });
    });

    // 2. Accumulate pre-planned manual compounds
    if (job.additionalMaterials) {
      job.additionalMaterials.forEach(mat => {
        if (!mat.inventoryItemId) return;
        if (!requirementsMap[mat.inventoryItemId]) {
          requirementsMap[mat.inventoryItemId] = {
            required: 0,
            unit: mat.unit || "kg",
            lineType: "raw_material"
          };
        }
        requirementsMap[mat.inventoryItemId].required += mat.quantity;
      });
    }

    // 3. Resolve status
    return Object.entries(requirementsMap).map(([itemId, data]) => {
      const item = inventoryItems.find(i => i.id === itemId);
      const requiredQty = data.required;
      
      // Calculate already released from consume transactions
      const alreadyReleased = jobTransactions
        .filter(t => t.inventoryItemId === itemId && (t.type === "production_consume" || t.type === "production_release"))
        .reduce((sum, t) => sum + t.quantity, 0);

      const remainingNeeded = Math.max(0, requiredQty - alreadyReleased);
      const onHand = item ? item.quantityOnHand : 0;
      const isShortage = onHand < remainingNeeded;

      return {
        itemId,
        name: item?.name ?? "Unknown Item",
        sku: item?.sku ?? "N/A",
        category: data.lineType,
        requiredQty,
        alreadyReleased,
        remainingNeeded,
        onHand,
        unit: data.unit,
        isShortage
      };
    });
  }, [job, planProducts, productBomLines, inventoryItems, jobTransactions]);

  if (!job) {
    return (
      <AppShell>
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-error text-headline-md font-semibold">Job not found</p>
          <Button className="mt-5" asChild>
            <Link href="/production">Back to Production</Link>
          </Button>
        </div>
      </AppShell>
    );
  }

  const isFullyReleased = materialLines.every((line) => line.remainingNeeded <= 0);
  const materialSummary = {
    total: materialLines.length,
    ok: materialLines.filter(line => !line.isShortage).length,
    short: materialLines.filter(line => line.isShortage).length
  };

  // Individual manual release
  const handleReleaseItem = (itemId: string, maxQty: number) => {
    const qtyStr = releaseQuantities[itemId];
    const qty = Number(qtyStr);
    
    if (!qtyStr || isNaN(qty) || qty <= 0) {
      triggerBanner("Please enter a valid positive release quantity.", "error");
      return;
    }

    const item = inventoryItems.find(i => i.id === itemId);
    if (!item) return;

    if (qty > item.quantityOnHand) {
      triggerBanner(`Cannot release. Only ${item.quantityOnHand} ${item.unit} available.`, "error");
      return;
    }

    // Release materials
    releaseJobMaterials(job.id, [{ itemId, qty }]);
    setReleaseQuantities(prev => ({ ...prev, [itemId]: "" }));
    triggerBanner(`Released ${qty} ${item.unit} of ${item.name}`, "success");
  };

  // Release Full remaining
  const handleReleaseFull = (itemId: string, remainingQty: number) => {
    const item = inventoryItems.find(i => i.id === itemId);
    if (!item) return;

    const qtyToRelease = Math.min(remainingQty, item.quantityOnHand);
    if (qtyToRelease <= 0) {
      triggerBanner(`No stock available for ${item.name}.`, "error");
      return;
    }

    releaseJobMaterials(job.id, [{ itemId, qty: qtyToRelease }]);
    triggerBanner(`Released ${qtyToRelease} ${item.unit} of ${item.name}`, "success");
  };

  // Release All Available
  const handleReleaseAllAvailable = () => {
    const releases: { itemId: string; qty: number }[] = [];
    materialLines.forEach(line => {
      if (line.remainingNeeded > 0 && line.onHand > 0) {
        releases.push({ itemId: line.itemId, qty: Math.min(line.remainingNeeded, line.onHand) });
      }
    });

    if (releases.length === 0) {
      triggerBanner("No materials available for release.", "info");
      return;
    }

    releaseJobMaterials(job.id, releases);
    triggerBanner("Released all available materials successfully.", "success");
  };

  // Issue manual compound
  const handleAddAdditionalCompound = () => {
    const qty = Number(additionalQty);
    if (!additionalItemId || isNaN(qty) || qty <= 0) {
      triggerBanner("Select item and specify quantity.", "error");
      return;
    }

    const item = inventoryItems.find(i => i.id === additionalItemId);
    if (!item) return;

    if (qty > item.quantityOnHand) {
      triggerBanner(`Insufficient stock: only ${item.quantityOnHand} ${item.unit} available.`, "error");
      return;
    }

    addCompoundToJob(job.id, additionalItemId, qty, additionalReason || undefined);
    setAdditionalItemId("");
    setAdditionalQty("");
    setAdditionalReason("");
    triggerBanner(`Issued ${qty} ${item.unit} of ${item.name} manually to run.`);
  };

  // Mark run completed
  const handleCompleteJob = () => {
    const outputMap: Record<string, number> = {};
    let hasError = false;

    Object.entries(completedOutputs).forEach(([prodId, val]) => {
      const num = Number(val);
      if (isNaN(num) || num <= 0) {
        hasError = true;
      }
      outputMap[prodId] = num;
    });

    if (hasError) {
      triggerBanner("Please enter a valid positive quantity for all products.", "error");
      return;
    }

    completeProductionJob(job.id, outputMap);
    const completedAt = new Date().toISOString();
    const computedDuration = formatDuration(job.startedAt ?? completedAt, completedAt);
    addActivityLog({
      actorName: job.preparedBy || "Admin",
      action: `Marked Done for ${job.jobNumber}`,
      entityType: "production_job",
      entityId: job.id
    });
    addActivityLog({
      actorName: job.preparedBy || "Admin",
      action: `Duration computed for ${job.jobNumber}: ${computedDuration}`,
      entityType: "production_job",
      entityId: job.id
    });
    setIsCompleteModalOpen(false);
    triggerBanner(`Run ${job.jobNumber} completed. Finished stock updated!`);
    
    setTimeout(() => {
      router.push("/production");
    }, 1500);
  };

  const handleResetToDraft = () => {
    updateProductionJob(job.id, { status: "draft" });
    triggerBanner("Job reset to Draft.");
  };

  const handleDuplicatePlan = () => {
    const duplicated = duplicateProductionJob(job.id);
    triggerBanner("Production plan duplicated as draft.");
    setTimeout(() => router.push(`/production/${duplicated.id}`), 600);
  };

  const handleConfirmToProcess = () => {
    const result = moveProductionJobToProcess(job.id);
    if (!result.ok) {
      triggerBanner("Not enough stock for some materials.", "error");
      return;
    }
    addActivityLog({
      actorName: job.preparedBy || "Admin",
      action: `Marked To Process for ${job.jobNumber}`,
      entityType: "production_job",
      entityId: job.id
    });
    setIsToProcessModalOpen(false);
    triggerBanner("Moved to To Process. Started at was set automatically.");
  };

  const handleSaveTracking = () => {
    if (job.status !== "draft") {
      triggerBanner("Tracking fields are read-only after Draft.", "info");
      return;
    }

    const nextDraftDate = parseOperationalDate(trackingDraft.createdAt) ?? job.createdAt;
    const nextTargetDate = parseOperationalDate(trackingDraft.dueDate);

    updateProductionJob(job.id, {
      dueDate: nextTargetDate,
      purpose: trackingDraft.purpose,
      referenceNote: trackingDraft.referenceNote.trim() || undefined,
      preparedBy: trackingDraft.preparedBy.trim() || undefined,
      createdAt: job.status === "draft" ? nextDraftDate : job.createdAt
    });

    if (job.status === "draft" && nextDraftDate && nextDraftDate !== job.createdAt) {
      addActivityLog({
        actorName: trackingDraft.preparedBy || "Admin",
        action: `Prepared date changed for ${job.jobNumber}`,
        entityType: "production_job",
        entityId: job.id
      });
    }

    if (nextTargetDate !== job.dueDate) {
      addActivityLog({
        actorName: trackingDraft.preparedBy || "Admin",
        action: `Target date changed for ${job.jobNumber}`,
        entityType: "production_job",
        entityId: job.id
      });
    }

    triggerBanner("Tracking details saved.");
  };

  const shortMaterialLines = materialLines.filter(line => line.isShortage);
  const durationText = formatDuration(
    job.startedAt,
    job.completedAt
  );
  const isDraft = job.status === "draft";

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

      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild className="rounded-full h-10 w-10">
            <Link href="/production" aria-label="Back">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <span className="text-label-sm text-primary uppercase font-bold tracking-wider">Manufacturing Execution</span>
            <h2 className="text-headline-md font-bold text-white flex items-center gap-2 mt-0.5">
              {job.jobNumber}
              <span className={cn(
                "text-label-xs uppercase px-2.5 py-1 rounded-full font-bold border",
                job.status === "completed"
                  ? "bg-success/10 border-success/20 text-success"
                  : job.status === "ready" || job.status === "to_process"
                  ? "bg-primary/10 border-primary/20 text-primary"
                  : job.status === "blocked"
                  ? "bg-error/10 border-error/20 text-error"
                  : "bg-outline-variant/30 border-outline-variant/40 text-on-surface-variant"
              )}>
                {job.status.replace("_", " ")}
              </span>
            </h2>
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="ghost" className="h-9 border border-outline-variant/30" onClick={handleDuplicatePlan}>
            <RotateCcw className="h-4 w-4" />
            Duplicate
          </Button>
          {job.status === "draft" && (
            <Button size="sm" className="h-9" onClick={() => setIsToProcessModalOpen(true)}>
              <Play className="h-4 w-4" />
              To Process
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 pb-20">
        {/* Left column - Info, Release Panels */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Multi-product Info Card */}
          <Card className="p-6 bg-surface-container border border-outline-variant/30">
            <h3 className="text-headline-sm font-bold text-white mb-4">Plan Specifications</h3>
            
            <div className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pb-4 border-b border-outline-variant/15">
                <div>
                  <p className="text-label-sm text-outline uppercase font-bold">Scheduled Time</p>
                  <p className="text-body-md font-semibold text-white mt-1 flex items-center gap-1.5">
                    <Calendar className="h-4.5 w-4.5 text-primary" />
                    {job.scheduledFor ? new Date(job.scheduledFor).toLocaleString() : "Not Scheduled"}
                  </p>
                </div>
                {job.notes && (
                  <div>
                    <p className="text-label-sm text-outline uppercase font-bold">Production Notes</p>
                    <p className="text-body-sm text-warning mt-1">{job.notes}</p>
                  </div>
                )}
              </div>

              {/* Product Lines list */}
              <div>
                <p className="text-label-sm text-outline uppercase font-bold mb-2">Products in Plan</p>
                <div className="space-y-2">
                  {planProducts.map((p, idx) => (
                    <div key={idx} className="flex justify-between items-center p-3 bg-surface-container-low border border-outline-variant/10 rounded-lg">
                      <div>
                        <p className="text-body-sm font-bold text-white">{p.name}</p>
                        <p className="text-body-xs text-on-surface-variant mt-0.5">SKU: {p.sku}</p>
                      </div>
                      <div className="text-right">
                        <span className="text-body-sm font-semibold text-white">
                          {p.plannedBatchQty} Batch{p.plannedBatchQty > 1 ? "es" : ""}
                        </span>
                        <span className="text-body-xs text-on-surface-variant block mt-0.5">
                          Target: {p.batchSize * p.plannedBatchQty} {p.outputUnit}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Preplanned Manual compounds */}
              {job.additionalMaterials && job.additionalMaterials.length > 0 && (
                <div>
                  <p className="text-label-sm text-outline uppercase font-bold mb-2">Planned Manual Additions</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {job.additionalMaterials.map((mat, idx) => {
                      const item = inventoryItems.find(i => i.id === mat.inventoryItemId);
                      return (
                        <div key={idx} className="p-2.5 bg-surface-container-low border border-outline-variant/10 rounded-lg text-body-sm">
                          <span className="font-semibold text-white block">{item?.name ?? "Overhead"}</span>
                          <span className="text-body-xs text-on-surface-variant">
                            Qty: {mat.quantity} {mat.unit} {mat.reason ? `• Reason: ${mat.reason}` : ""}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </Card>

          {/* Aggregated Material Release Control */}
          <Card className="rounded-lg border border-outline-variant/30 bg-surface-container p-3">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-[15px] font-semibold text-white">Material requirements</h3>
                <p className="mt-0.5 text-[12px] text-on-surface-variant">
                  {materialSummary.total} materials {"\u2022"} {materialSummary.ok} OK {"\u2022"} {materialSummary.short} short
                </p>
              </div>
              {job.status !== "completed" && job.status !== "draft" && (
                <Button variant="secondary" size="sm" className="h-8 px-2 text-[12px]" onClick={handleReleaseAllAvailable}>
                  Release All Available
                </Button>
              )}
            </div>

            <div className="space-y-1.5">
              {materialLines.map((line) => {
                const isItemFullyReleased = line.remainingNeeded <= 0;
                return (
                  <div key={line.itemId} className="flex flex-col gap-2 rounded-md border border-outline-variant/20 bg-surface-container-low p-2.5">
                    <div className="min-w-0">
                      <p className="truncate text-[14.5px] font-semibold leading-5 text-white">{line.name}</p>
                      <p className="truncate text-[12.5px] text-on-surface-variant">
                        SKU: {line.sku} • Category: <span className="capitalize">{line.category.replace("_", " ")}</span>
                      </p>
                      <div className="mt-1 flex items-center gap-2">
                        <span className="text-[12px] font-semibold text-primary">
                          Issued: {line.alreadyReleased.toFixed(1)} / {line.requiredQty.toFixed(1)} {line.unit}
                        </span>
                        {isItemFullyReleased ? (
                          <span className="rounded-full border border-success/20 bg-success/10 px-2 py-0.5 text-[12px] font-semibold text-success">
                            Issued
                          </span>
                        ) : (
                          <span className={cn(
                            "rounded-full border px-2 py-0.5 text-[12px] font-semibold",
                            line.isShortage ? "border-error/25 bg-error/10 text-error" : "border-warning/25 bg-warning/10 text-warning"
                          )}>
                            Need {line.remainingNeeded.toFixed(1)} • Stock: {line.onHand.toFixed(1)}
                          </span>
                        )}
                      </div>
                    </div>

                    {job.status !== "completed" && job.status !== "draft" && (
                      <div className="flex items-center justify-end gap-2">
                        {!isItemFullyReleased && (
                          <>
                            <div className="relative">
                              <Input
                                type="number"
                                placeholder="Qty"
                                value={releaseQuantities[line.itemId] || ""}
                                onChange={(e) => setReleaseQuantities({ ...releaseQuantities, [line.itemId]: e.target.value })}
                                className="w-24 text-right pr-8 h-10 text-body-sm"
                                disabled={line.onHand <= 0}
                              />
                              <span className="absolute right-2.5 top-2.5 text-body-xs text-on-surface-variant font-bold">
                                {line.unit}
                              </span>
                            </div>
                            <Button 
                              size="sm" 
                              onClick={() => handleReleaseItem(line.itemId, line.remainingNeeded)}
                              disabled={line.onHand <= 0}
                              className="h-10 text-body-xs"
                            >
                              Release
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleReleaseFull(line.itemId, line.remainingNeeded)}
                              disabled={line.onHand <= 0}
                              className="h-10 border border-outline-variant/30 text-body-xs px-2"
                            >
                              Full
                            </Button>
                          </>
                        )}
                        {isItemFullyReleased && (
                          <span className="text-success font-bold text-body-sm">
                            ✓ Ready
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </Card>
        </div>

        {/* Right column - Execution details & manual compounds */}
        <div className="space-y-6">
          <Card className="rounded-lg border border-outline-variant/30 bg-surface-container p-3">
            <div className="mb-3 flex items-center justify-between gap-2">
              <div>
                <h3 className="text-[15px] font-semibold text-white">Plan tracking</h3>
                <p className="mt-0.5 text-[12px] text-on-surface-variant">
                  {isDraft ? "Draft fields are editable" : "Tracking timestamps are read-only"}
                </p>
              </div>
              <Button size="sm" className="h-8 px-2 text-[12px]" onClick={handleSaveTracking} disabled={!isDraft}>
                Save
              </Button>
            </div>

            <div className="space-y-2">
              <CompactField label="Target date">
                <Input
                  type="datetime-local"
                  value={trackingDraft.dueDate}
                  onChange={(e) => setTrackingDraft(prev => ({ ...prev, dueDate: e.target.value }))}
                  onInput={(e) => {
                    const value = e.currentTarget.value;
                    setTrackingDraft(prev => ({ ...prev, dueDate: value }));
                  }}
                  disabled={!isDraft}
                  className="h-9 text-[12.5px]"
                />
              </CompactField>

              <div className="grid grid-cols-2 gap-2">
                <CompactField label="Purpose">
                  <select
                    value={trackingDraft.purpose}
                    onChange={(e) => setTrackingDraft(prev => ({ ...prev, purpose: e.target.value as "stock" | "order" | "custom" }))}
                    disabled={!isDraft}
                    className="flex h-9 w-full rounded-md border border-outline bg-surface-container px-2 text-[12.5px] text-white focus:outline-none"
                  >
                    <option value="stock">For stock</option>
                    <option value="order">For order</option>
                    <option value="custom">Custom</option>
                  </select>
                </CompactField>
                <CompactField label="Duration">
                  <div className="flex h-9 items-center rounded-md border border-outline-variant/30 bg-surface-container-low px-2 text-[12.5px] font-semibold text-primary">
                    {durationText}
                  </div>
                </CompactField>
              </div>

              <CompactField label="Reference no.">
                <Input
                  value={trackingDraft.referenceNote}
                  onChange={(e) => setTrackingDraft(prev => ({ ...prev, referenceNote: e.target.value }))}
                  placeholder="Custom order #001"
                  disabled={!isDraft}
                  className="h-9 text-[12.5px]"
                />
              </CompactField>

              <CompactField label="Prepared / processed by">
                <Input
                  value={trackingDraft.preparedBy}
                  onChange={(e) => setTrackingDraft(prev => ({ ...prev, preparedBy: e.target.value }))}
                  placeholder="Name"
                  disabled={!isDraft}
                  className="h-9 text-[12.5px]"
                />
              </CompactField>

              <div className="grid grid-cols-1 gap-2">
                <CompactField label="Draft date">
                  <Input
                    type="datetime-local"
                    value={trackingDraft.createdAt}
                    onChange={(e) => setTrackingDraft(prev => ({ ...prev, createdAt: e.target.value }))}
                    onInput={(e) => {
                      const value = e.currentTarget.value;
                      setTrackingDraft(prev => ({ ...prev, createdAt: value }));
                    }}
                    disabled={!isDraft}
                    className="h-9 text-[12.5px]"
                  />
                </CompactField>
                <CompactField label="Started at">
                  <ReadOnlyDate value={job.startedAt} fallback="Not started" />
                </CompactField>
                <CompactField label="Completed at">
                  <ReadOnlyDate value={job.completedAt} fallback="Not done" />
                </CompactField>
              </div>
            </div>
          </Card>

          <Card className="p-6 bg-surface-container border border-outline-variant/30">
            <h3 className="text-headline-sm font-bold text-white mb-4">Run Controls</h3>
            
            <div className="space-y-3">
              {job.status === "draft" && (
                <Button className="w-full py-5 flex items-center justify-center gap-2" onClick={() => setIsToProcessModalOpen(true)}>
                  <Play className="h-5 w-5" /> Move to To Process
                </Button>
              )}

              {job.status !== "completed" && job.status !== "draft" && (
                <Button 
                  className={cn(
                    "w-full py-6 flex items-center justify-center gap-2 text-black font-bold",
                    isFullyReleased ? "bg-success hover:bg-success/90" : "bg-warning hover:bg-warning/90"
                  )}
                  onClick={() => setIsCompleteModalOpen(true)}
                >
                  <CheckCircle className="h-5 w-5" /> Mark Done
                </Button>
              )}

              {job.status === "completed" && (
                <div className="p-4 bg-success/10 border border-success/20 rounded-xl text-center">
                  <p className="text-success text-headline-sm font-bold">✓ Completed</p>
                  <p className="text-body-xs text-on-surface-variant mt-1.5">
                    Marked completed on {job.completedAt ? new Date(job.completedAt).toLocaleString() : "recent date"}
                  </p>
                </div>
              )}

              {job.status !== "draft" && job.status !== "completed" && (
                <Button variant="ghost" className="w-full border border-outline-variant/30 text-on-surface-variant hover:text-white" onClick={handleResetToDraft}>
                  <RotateCcw className="h-4 w-4 mr-1.5" /> Reset to Draft
                </Button>
              )}
            </div>

            {job.status !== "completed" && !isFullyReleased && (
              <div className="mt-4 p-3 bg-error-container/20 border border-error/30 rounded-xl flex items-start gap-2 text-error">
                <AlertTriangle className="h-5 w-5 mt-0.5 flex-shrink-0" />
                <p className="text-body-xs font-semibold">
                  Note: Outstanding component requirements exist. Move to To Process first to deduct materials before marking Done.
                </p>
              </div>
            )}
          </Card>

          {/* Issue Manual Compounds (During production run) */}
          {job.status !== "completed" && (
            <Card className="p-6 bg-surface-container border border-outline-variant/30">
              <h3 className="text-headline-sm font-bold text-white mb-2">Issue Extra Compounds</h3>
              <p className="text-body-xs text-on-surface-variant mb-4">
                Record extra material or packaging lines added during execution.
              </p>

              <div className="space-y-4 text-body-sm">
                <div>
                  <label className="text-label-sm text-outline uppercase font-bold">Select Material</label>
                  <select 
                    value={additionalItemId} 
                    onChange={e => setAdditionalItemId(e.target.value)}
                    className="mt-1 flex h-12 w-full rounded-md border border-outline bg-surface-container px-3 text-white focus:outline-none"
                  >
                    <option value="">Choose item...</option>
                    {inventoryItems
                      .filter((i) => !i.isArchived && (i.category === "raw" || i.category === "packaging"))
                      .map((i) => (
                        <option key={i.id} value={i.id}>{i.name} ({i.sku})</option>
                      ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="text-label-sm text-outline uppercase font-bold">Quantity</label>
                    <div className="relative">
                      <Input
                        type="number"
                        placeholder="0.0"
                        value={additionalQty}
                        onChange={e => setAdditionalQty(e.target.value)}
                        className="mt-1 pr-12 w-full"
                      />
                      <span className="absolute right-3 top-4 text-body-sm text-on-surface-variant font-bold">
                        {inventoryItems.find(i => i.id === additionalItemId)?.unit ?? ""}
                      </span>
                    </div>
                  </div>
                  <div>
                    <label className="text-label-sm text-outline uppercase font-bold font-semibold">Stock</label>
                    <div className="mt-4 font-bold text-white">
                      {additionalItemId 
                        ? `${inventoryItems.find(i => i.id === additionalItemId)?.quantityOnHand} ${inventoryItems.find(i => i.id === additionalItemId)?.unit}`
                        : "—"}
                    </div>
                  </div>
                </div>

                <div>
                  <label className="text-label-sm text-outline uppercase font-bold">Reason / Notes</label>
                  <Input 
                    type="text" 
                    placeholder="e.g. spilled, adjustment needed" 
                    value={additionalReason}
                    onChange={e => setAdditionalReason(e.target.value)}
                    className="mt-1"
                  />
                </div>

                <Button className="w-full" variant="secondary" onClick={handleAddAdditionalCompound} disabled={!additionalItemId}>
                  <Plus className="h-4 w-4 mr-1.5" /> Issue Compound
                </Button>
              </div>
            </Card>
          )}
        </div>
      </div>

      {/* History logs specific to this Job */}
      <section className="space-y-2 pb-24">
        <h3 className="text-[15px] font-semibold text-white">History</h3>
        <Card className="overflow-hidden rounded-lg border border-outline-variant/30 bg-surface-container">
          {historyEntries.length > 0 ? (
            historyEntries.map((entry) => (
              <div key={entry.id} className="border-b border-outline-variant/15 px-3 py-2 last:border-b-0">
                <p className="truncate text-[12.5px] font-medium leading-4 text-white">{entry.action}</p>
                <p className="mt-0.5 text-[11.5px] text-on-surface-variant">
                  {entry.actorName} {"\u2022"} {formatRelativeTime(entry.createdAt)}
                </p>
              </div>
            ))
          ) : (
            <div className="px-3 py-3 text-[12.5px] text-on-surface-variant">Plan saved as draft</div>
          )}
        </Card>
        <Card className="hidden overflow-hidden divide-y divide-outline-variant/20 border border-outline-variant/30 bg-surface-container">
          {jobTransactions.length > 0 ? (
            jobTransactions.map((txn) => {
              const matchedItem = inventoryItems.find(i => i.id === txn.inventoryItemId);
              const isOutput = txn.type === "production_output";
              return (
                <div key={txn.id} className="p-4 flex items-center justify-between hover:bg-surface-container-high/30 transition text-body-sm">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      "w-8 h-8 rounded-full flex items-center justify-center border font-bold text-body-md",
                      isOutput
                        ? "bg-success/15 border-success/20 text-success" 
                        : "bg-warning/15 border-warning/20 text-warning"
                    )}>
                      {isOutput ? "+" : "-"}
                    </div>
                    <div>
                      <p className="font-bold text-white">
                        {isOutput ? "Finished Good Output" : "Component Issued"}: {matchedItem?.name ?? "Water"}
                      </p>
                      <p className="text-on-surface-variant text-body-xs mt-0.5">
                        Qty: {txn.quantity} {txn.unit} • {txn.reason || "Manufacturing recipe consume"}
                      </p>
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
              No audit logs captured for this production run yet.
            </div>
          )}
        </Card>
      </section>

      {isToProcessModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={() => setIsToProcessModalOpen(false)} />
          <Card className="relative z-10 max-h-[82vh] w-full max-w-md overflow-hidden border border-outline-variant/30 bg-surface-container p-4 shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
            <div className="flex items-start justify-between gap-3 border-b border-outline-variant/20 pb-3">
              <div>
                <h3 className="text-[18px] font-bold text-white">Move to To Process?</h3>
                <p className="mt-1 text-[12.5px] leading-5 text-on-surface-variant">
                  This will deduct required raw materials and packaging from inventory and log the release for this production plan.
                </p>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setIsToProcessModalOpen(false)} className="h-8 w-8 shrink-0 rounded-full">
                <X className="h-4 w-4" />
              </Button>
            </div>

            {shortMaterialLines.length > 0 && (
              <div className="mt-3 rounded-lg border border-error/30 bg-error/10 p-3 text-[12.5px] font-semibold text-error">
                Not enough stock for some materials. To Process is blocked until shortages are resolved.
              </div>
            )}

            <div className="mt-3 rounded-md border border-outline-variant/25 bg-surface-container-low px-3 py-2">
              <p className="text-[11px] font-bold uppercase text-outline">Started at</p>
              <p className="mt-0.5 text-[12.5px] font-semibold text-white">Set automatically when confirmed</p>
            </div>

            <div className="mt-3 max-h-[42vh] space-y-1.5 overflow-y-auto pr-1">
              {materialLines.map((line) => (
                <div key={line.itemId} className="flex items-center justify-between gap-3 rounded-md bg-surface-container-low px-2.5 py-2">
                  <span className="min-w-0 truncate text-[13px] font-medium text-white">{line.name}</span>
                  <span className={cn("shrink-0 text-[12px] font-semibold", line.isShortage ? "text-error" : "text-on-surface-variant")}>
                    {line.requiredQty.toFixed(1)} {line.unit}
                  </span>
                </div>
              ))}
            </div>

            <div className="mt-4 flex gap-2 border-t border-outline-variant/20 pt-3">
              <Button variant="ghost" className="h-10 flex-1 border border-outline-variant/30" onClick={() => setIsToProcessModalOpen(false)}>
                Cancel
              </Button>
              <Button className="h-10 flex-1" onClick={handleConfirmToProcess} disabled={shortMaterialLines.length > 0}>
                Confirm and deduct
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Completion Modal supporting multiple outputs */}
      {isCompleteModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/75 backdrop-blur-sm" onClick={() => setIsCompleteModalOpen(false)} />
          <Card className="relative z-10 w-full max-w-md p-6 bg-surface-container border border-outline-variant/30 shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
            <div className="flex justify-between items-center pb-4 border-b border-outline-variant/20 mb-4">
              <h3 className="text-headline-md font-bold text-white">Mark Done</h3>
              <Button variant="ghost" size="icon" onClick={() => setIsCompleteModalOpen(false)} className="rounded-full h-8 w-8">
                <X className="h-4 w-4" />
              </Button>
            </div>

            <div className="space-y-4 text-body-sm">
              {!isFullyReleased && (
                <div className="p-3 bg-warning-container/20 border border-warning/30 rounded-xl flex items-start gap-2.5 text-warning">
                  <AlertTriangle className="h-5 w-5 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-bold text-white">Outstanding Recipe Issues</p>
                    <p className="text-body-xs mt-0.5">
                       outstanding planned components will be auto-deducted from available inventory upon confirmation.
                    </p>
                  </div>
                </div>
              )}

              {/* Output inputs for each product line */}
              <div className="space-y-3">
                <div className="rounded-md border border-outline-variant/25 bg-surface-container-low px-3 py-2">
                  <p className="text-[11px] font-bold uppercase text-outline">Completed at</p>
                  <p className="mt-0.5 text-[12.5px] font-semibold text-white">Set automatically when recorded complete</p>
                </div>
                    <p className="text-label-sm text-outline uppercase font-bold">Record Output Quantities</p>
                {planProducts.map((p) => (
                  <div key={p.productId} className="space-y-1">
                    <label className="text-body-xs text-white font-semibold">{p.name}</label>
                    <div className="relative">
                      <Input
                        type="number"
                        value={completedOutputs[p.productId] || ""}
                        onChange={e => setCompletedOutputs({ ...completedOutputs, [p.productId]: e.target.value })}
                        className="w-full pr-12 text-right"
                      />
                      <span className="absolute right-3 top-3.5 text-body-xs font-bold text-on-surface-variant uppercase">
                        {p.outputUnit}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="flex gap-3 justify-end pt-6 border-t border-outline-variant/20 mt-6">
              <Button variant="ghost" onClick={() => setIsCompleteModalOpen(false)}>Cancel</Button>
              <Button onClick={handleCompleteJob} className="bg-success text-black font-semibold hover:bg-success/90">
                Mark Done
              </Button>
            </div>
          </Card>
        </div>
      )}
    </AppShell>
  );
}

function formatRelativeTime(value: string) {
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return "Recently";

  const diffMs = Date.now() - timestamp;
  const minute = 60 * 1000;
  const hour = 60 * minute;
  const day = 24 * hour;

  if (diffMs < minute) return "Just now";
  if (diffMs < hour) return `${Math.max(1, Math.floor(diffMs / minute))}m ago`;
  if (diffMs < day) return `${Math.floor(diffMs / hour)}h ago`;
  if (diffMs < 2 * day) return "Yesterday";
  return `${Math.floor(diffMs / day)}d ago`;
}

function toDateTimeLocal(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offsetMs = date.getTimezoneOffset() * 60000;
  return new Date(date.getTime() - offsetMs).toISOString().slice(0, 16);
}

function parseOperationalDate(value: string) {
  if (!value.trim()) return undefined;
  const normalized = value.trim().replace(" ", "T");
  const date = new Date(normalized);
  return Number.isNaN(date.getTime()) ? undefined : date.toISOString();
}

function formatDuration(start?: string, end?: string) {
  if (!start) return "Not started";
  if (!end) return "In progress";
  const startMs = new Date(start).getTime();
  const endMs = new Date(end).getTime();
  if (Number.isNaN(startMs) || Number.isNaN(endMs) || endMs < startMs) return "In progress";

  const totalMinutes = Math.max(1, Math.round((endMs - startMs) / 60000));
  const days = Math.floor(totalMinutes / 1440);
  const hours = Math.floor((totalMinutes % 1440) / 60);
  const minutes = totalMinutes % 60;

  if (days > 0) return `${days} day${days > 1 ? "s" : ""} ${hours}h`;
  if (hours > 0) return `${hours}h ${minutes}m`;
  return `${minutes}m`;
}

function CompactField({ label, children }: Readonly<{ label: string; children: React.ReactNode }>) {
  return (
    <label className="block space-y-1">
      <span className="text-[10.5px] font-bold uppercase text-outline">{label}</span>
      {children}
    </label>
  );
}

function ReadOnlyDate({ value, fallback }: Readonly<{ value?: string; fallback: string }>) {
  return (
    <div className="flex min-h-9 items-center rounded-md border border-outline-variant/30 bg-surface-container-low px-2 text-[12.5px] font-semibold text-on-surface-variant">
      {value ? formatDateTime(value) : fallback}
    </div>
  );
}

function formatDateTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Invalid date";
  return date.toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}
