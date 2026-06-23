"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Archive, ArrowLeft, Copy, Edit3, Plus, Save } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SearchableInventoryPicker } from "@/components/ui/searchable-inventory-picker";
import { useApp } from "@/context/app-context";
import { compatibleUnitsFor, toInventoryUnit } from "@/lib/units";
import { cn, formatMoney } from "@/lib/utils";
import {
  estimateBomCost,
  makeOpId,
  type MasterBom,
  type MasterBomLine
} from "@/lib/operations-store";
import {
  archiveMasterBomInSupabase,
  formatSupabaseOperationalError,
  listMasterBomsFromSupabase,
  saveMasterBomToSupabase
} from "@/lib/supabase/repositories/bom-packing";
import type { InventoryUnit } from "@/types/domain";

const units: InventoryUnit[] = ["kg", "g", "liter", "ml", "gallon", "pcs"];

export default function BomLibraryPage() {
  const { inventoryItems, addActivityLog } = useApp();
  const [boms, setBoms] = useState<MasterBom[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    let active = true;
    async function loadBoms() {
      setIsLoading(true);
      setLoadError(null);
      try {
        const records = await listMasterBomsFromSupabase();
        if (active) setBoms(records);
      } catch (error) {
        if (active) {
          setBoms([]);
          setLoadError(`${formatSupabaseOperationalError(error)} Apply 0002_persistence_expansion.sql before editing BOMs.`);
        }
      } finally {
        if (active) setIsLoading(false);
      }
    }
    void loadBoms();
    return () => {
      active = false;
    };
  }, []);

  const saveBomsState = (next: MasterBom[]) => {
    setBoms(next);
  };

  const updateBom = (id: string, updates: Partial<MasterBom>) => {
    saveBomsState(boms.map(bom => bom.id === id ? { ...bom, ...updates } : bom));
  };

  const persistBom = async (bom: MasterBom) => {
    setIsSaving(true);
    setLoadError(null);
    try {
      await saveMasterBomToSupabase(bom);
      addActivityLog({ actorName: "Admin", action: `Manufacturing BOM saved: ${bom.name}`, entityType: "bom", entityId: bom.id });
      return true;
    } catch (error) {
      setLoadError(formatSupabaseOperationalError(error));
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const addBom = async () => {
    const next: MasterBom = {
      id: makeOpId("bom"),
      name: "New Manufacturing BOM",
      family: "General",
      yieldQty: 1,
      yieldUnit: "liter",
      status: "active",
      lines: []
    };
    if (await persistBom(next)) {
      saveBomsState([next, ...boms]);
      setEditingId(next.id);
    }
  };

  const duplicateBom = async (bom: MasterBom) => {
    const next = {
      ...bom,
      id: makeOpId("bom"),
      name: `${bom.name} Copy`,
      status: "active" as const,
      lines: bom.lines.map(line => ({ ...line, id: makeOpId("bom-line") }))
    };
    if (await persistBom(next)) {
      saveBomsState([next, ...boms]);
      addActivityLog({ actorName: "Admin", action: `Manufacturing BOM duplicated: ${bom.name}`, entityType: "bom", entityId: next.id });
    }
  };

  const archiveBom = async (bom: MasterBom) => {
    setIsSaving(true);
    setLoadError(null);
    try {
      await archiveMasterBomInSupabase(bom);
      updateBom(bom.id, { status: "archived" });
      addActivityLog({ actorName: "Admin", action: `Manufacturing BOM archived: ${bom.name}`, entityType: "bom", entityId: bom.id });
    } catch (error) {
      setLoadError(formatSupabaseOperationalError(error));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <AppShell>
      <Button asChild variant="ghost" size="icon" className="mb-3 h-9 w-9">
        <Link href="/inventory" aria-label="Back to inventory">
          <ArrowLeft className="h-4 w-4" />
        </Link>
      </Button>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-label-sm uppercase text-primary">Manufacturing</p>
          <h2 className="mt-1 text-[32px] font-bold leading-tight text-white">BOM Library</h2>
        </div>
        <Button size="sm" className="mt-2 h-9 px-3" onClick={addBom}>
          <Plus className="h-4 w-4" /> New BOM
        </Button>
      </div>

      {loadError && (
        <Card className="mt-4 rounded-lg border border-error/25 bg-error/10 p-3 text-[12.5px] leading-5 text-error">
          {loadError}
        </Card>
      )}

      {isLoading && (
        <Card className="mt-4 rounded-lg border border-outline-variant/25 bg-surface-container p-3 text-[13px] text-on-surface-variant">
          Loading BOM Library from Supabase...
        </Card>
      )}

      <section className="mt-4 space-y-2 pb-16">
        {!isLoading && !loadError && boms.length === 0 && (
          <Card className="rounded-lg border border-outline-variant/25 bg-surface-container p-4 text-center text-[13px] text-on-surface-variant">
            No Supabase BOM records yet.
          </Card>
        )}
        {boms.map(bom => {
          const rawCount = bom.lines.filter(line => line.lineType === "raw_material").length;
          const packagingCount = bom.lines.filter(line => line.lineType === "packaging").length;
          const manpowerCost = bom.lines
            .filter(line => line.lineType === "manpower")
            .reduce((sum, line) => sum + (line.costOverride ?? 0) * line.quantityPerBatch, 0);
          const cost = estimateBomCost(bom.lines, inventoryItems);
          const isEditing = editingId === bom.id;

          return (
            <Card key={bom.id} className="rounded-lg border border-outline-variant/30 bg-surface-container p-3">
              {isEditing ? (
                <BomEditor
                  bom={bom}
                  inventoryItems={inventoryItems}
                  onChange={(updates) => updateBom(bom.id, updates)}
                  onDone={async () => {
                    if (await persistBom(bom)) {
                      setEditingId(null);
                      addActivityLog({ actorName: "Admin", action: `Manufacturing BOM edited: ${bom.name}`, entityType: "bom", entityId: bom.id });
                    }
                  }}
                  isSaving={isSaving}
                />
              ) : (
                <>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="truncate text-[15px] font-semibold text-white">{bom.name}</h3>
                      <p className="mt-0.5 text-[12px] text-on-surface-variant">{bom.family} {"\u2022"} Yield: {bom.yieldQty} {bom.yieldUnit}</p>
                    </div>
                    <span className={cn("rounded-full border px-2 py-0.5 text-[11px] font-bold uppercase", bom.status === "active" ? "border-success/20 bg-success/10 text-success" : "border-outline-variant/40 bg-surface-container-high text-on-surface-variant")}>{bom.status}</span>
                  </div>
                  <div className="mt-2 grid grid-cols-4 gap-1.5 text-center">
                    <Metric label="Raw" value={rawCount} />
                    <Metric label="Pack" value={packagingCount} />
                    <Metric label="Labor" value={formatMoney(manpowerCost)} />
                    <Metric label="Total" value={cost.missingCost ? "Cost pending" : formatMoney(cost.total)} />
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-1.5">
                    <SmallButton onClick={() => setEditingId(bom.id)} icon={<Edit3 className="h-3.5 w-3.5" />} label="Edit" />
                    <SmallButton onClick={() => void duplicateBom(bom)} icon={<Copy className="h-3.5 w-3.5" />} label="Duplicate" />
                    <SmallButton onClick={() => void archiveBom(bom)} icon={<Archive className="h-3.5 w-3.5" />} label="Archive" />
                  </div>
                </>
              )}
            </Card>
          );
        })}
      </section>
    </AppShell>
  );
}

function BomEditor({
  bom,
  inventoryItems,
  onChange,
  onDone,
  isSaving
}: Readonly<{ bom: MasterBom; inventoryItems: ReturnType<typeof useApp>["inventoryItems"]; onChange: (updates: Partial<MasterBom>) => void; onDone: () => void; isSaving: boolean }>) {
  const rawItems = inventoryItems.filter(item => item.category === "raw" && !item.isArchived);
  const packagingItems = inventoryItems.filter(item => item.category === "packaging" && !item.isArchived);

  const addLine = (lineType: MasterBomLine["lineType"]) => {
    const selectedItem = lineType === "raw_material" ? rawItems[0] : lineType === "packaging" ? packagingItems[0] : undefined;
    onChange({
      lines: [...bom.lines, {
        id: makeOpId("bom-line"),
        lineType,
        inventoryItemId: selectedItem?.id,
        quantityPerBatch: 1,
        unit: selectedItem?.unit ?? (lineType === "raw_material" ? "kg" : "pcs"),
        costOverride: lineType === "manpower" || lineType === "other_cost" ? 0 : undefined
      }]
    });
  };

  const updateLine = (lineId: string, updates: Partial<MasterBomLine>) => {
    onChange({ lines: bom.lines.map(line => line.id === lineId ? { ...line, ...updates } : line) });
  };

  return (
    <div>
      <div className="grid grid-cols-2 gap-2">
        <Field label="BOM name"><Input value={bom.name} onChange={e => onChange({ name: e.target.value })} className="h-9 text-[13px]" /></Field>
        <Field label="Family"><Input value={bom.family} onChange={e => onChange({ family: e.target.value })} className="h-9 text-[13px]" /></Field>
        <Field label="Yield qty"><Input type="number" value={bom.yieldQty} onChange={e => onChange({ yieldQty: Number(e.target.value) || 0 })} className="h-9 text-[13px]" /></Field>
        <Field label="Yield unit">
          <select value={bom.yieldUnit} onChange={e => onChange({ yieldUnit: e.target.value as InventoryUnit })} className="h-9 w-full rounded-md border border-outline bg-surface-container px-2 text-[13px] text-white">
            {units.map(unit => <option key={unit}>{unit}</option>)}
          </select>
        </Field>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-1.5">
        <Button size="sm" variant="ghost" onClick={() => addLine("raw_material")}>+ Raw</Button>
        <Button size="sm" variant="ghost" onClick={() => addLine("packaging")}>+ Packaging</Button>
        <Button size="sm" variant="ghost" onClick={() => addLine("manpower")}>+ Manpower</Button>
        <Button size="sm" variant="ghost" onClick={() => addLine("other_cost")}>+ Other</Button>
      </div>
      <div className="mt-2 space-y-2">
        {bom.lines.map(line => {
          const pickerItems = line.lineType === "raw_material" ? rawItems : line.lineType === "packaging" ? packagingItems : [];
          const selectedItem = pickerItems.find(item => item.id === line.inventoryItemId);
          const selectedLineUnit = toInventoryUnit(line.unit);
          const unitOptions = selectedItem ? compatibleUnitsFor(selectedItem.unit) : units;
          return (
            <div key={line.id} className="rounded-md bg-surface-container-low p-2">
              <p className="text-[11px] font-bold uppercase text-outline">{line.lineType.replace("_", " ")}</p>
              <div className="mt-1 grid grid-cols-[1fr_58px_72px] gap-1.5">
                {pickerItems.length > 0 ? (
                  <SearchableInventoryPicker
                    items={pickerItems}
                    onChange={(itemId, item) => updateLine(line.id, { inventoryItemId: itemId, unit: item.unit })}
                    placeholder={`Search ${line.lineType === "raw_material" ? "raw" : "packaging"}...`}
                    value={line.inventoryItemId}
                  />
                ) : (
                  <Input value={line.notes ?? ""} onChange={e => updateLine(line.id, { notes: e.target.value })} placeholder="Cost label" className="h-9 text-[12px]" />
                )}
                <Input type="number" value={line.quantityPerBatch} onChange={e => updateLine(line.id, { quantityPerBatch: Number(e.target.value) || 0 })} className="h-9 text-right text-[12px]" />
                {selectedItem ? (
                  <select value={selectedLineUnit ?? selectedItem.unit} onChange={e => updateLine(line.id, { unit: e.target.value })} className="h-9 rounded-md border border-outline bg-surface-container px-1 text-[12px] text-white">
                    {unitOptions.map(unit => <option key={unit} value={unit}>{unit}</option>)}
                  </select>
                ) : (
                  <Input value={line.unit} onChange={e => updateLine(line.id, { unit: e.target.value })} className="h-9 text-[12px]" />
                )}
              </div>
              {selectedItem && selectedLineUnit && selectedLineUnit !== selectedItem.unit && (
                <p className="mt-1 text-[11px] text-primary">Auto-converts {selectedLineUnit} to stock unit {selectedItem.unit} when used.</p>
              )}
              {(line.lineType === "manpower" || line.lineType === "other_cost") && (
                <Input type="number" value={line.costOverride ?? 0} onChange={e => updateLine(line.id, { costOverride: Number(e.target.value) || 0 })} className="mt-1 h-9 text-[12px]" placeholder="Cost" />
              )}
            </div>
          );
        })}
      </div>
      <Button size="sm" className="mt-3 h-9 w-full" onClick={onDone} disabled={isSaving}>
        <Save className="h-4 w-4" /> {isSaving ? "Saving..." : "Save BOM"}
      </Button>
    </div>
  );
}

function Field({ label, children }: Readonly<{ label: string; children: React.ReactNode }>) {
  return <label className="block space-y-1"><span className="text-[10px] font-bold uppercase text-outline">{label}</span>{children}</label>;
}

function Metric({ label, value }: Readonly<{ label: string; value: string | number }>) {
  return <div className="rounded-md bg-surface-container-low px-1.5 py-1.5"><p className="text-[10px] uppercase text-outline">{label}</p><p className="mt-0.5 truncate text-[12px] font-bold text-white">{value}</p></div>;
}

function SmallButton({ icon, label, onClick }: Readonly<{ icon: React.ReactNode; label: string; onClick: () => void }>) {
  return <button type="button" onClick={onClick} className="flex h-8 items-center justify-center gap-1 rounded-md border border-outline-variant/25 text-[11.5px] font-semibold text-on-surface-variant">{icon}{label}</button>;
}
