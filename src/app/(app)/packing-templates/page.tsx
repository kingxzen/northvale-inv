"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Archive, ArrowLeft, Copy, Edit3, Plus, Save } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SearchableInventoryPicker } from "@/components/ui/searchable-inventory-picker";
import { useApp } from "@/context/app-context";
import { compatibleUnitsFor } from "@/lib/units";
import { cn, formatMoney } from "@/lib/utils";
import {
  estimatePackingTemplateCost,
  makeOpId,
  type PackingTemplateRecord
} from "@/lib/operations-store";
import {
  archivePackingTemplateInSupabase,
  formatSupabaseOperationalError,
  listPackingTemplatesFromSupabase,
  savePackingTemplateToSupabase
} from "@/lib/supabase/repositories/bom-packing";

export default function PackingTemplatesPage() {
  const { inventoryItems, addActivityLog } = useApp();
  const [templates, setTemplates] = useState<PackingTemplateRecord[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const packagingItems = inventoryItems.filter(item => item.category === "packaging" && !item.isArchived);

  useEffect(() => {
    let active = true;
    async function loadTemplates() {
      setIsLoading(true);
      setLoadError(null);
      try {
        const records = await listPackingTemplatesFromSupabase();
        if (active) setTemplates(records);
      } catch (error) {
        if (active) {
          setTemplates([]);
          setLoadError(`${formatSupabaseOperationalError(error)} Apply 0002_persistence_expansion.sql before editing packing templates.`);
        }
      } finally {
        if (active) setIsLoading(false);
      }
    }
    void loadTemplates();
    return () => {
      active = false;
    };
  }, []);

  const saveTemplatesState = (next: PackingTemplateRecord[]) => {
    setTemplates(next);
  };

  const updateTemplate = (id: string, updates: Partial<PackingTemplateRecord>) => {
    saveTemplatesState(templates.map(template => template.id === id ? { ...template, ...updates } : template));
  };

  const persistTemplate = async (template: PackingTemplateRecord) => {
    setIsSaving(true);
    setLoadError(null);
    try {
      await savePackingTemplateToSupabase(template);
      addActivityLog({ actorName: "Admin", action: `Packing template saved: ${template.name}`, entityType: "packing_template", entityId: template.id });
      return true;
    } catch (error) {
      setLoadError(formatSupabaseOperationalError(error));
      return false;
    } finally {
      setIsSaving(false);
    }
  };

  const addTemplate = async () => {
    const next: PackingTemplateRecord = {
      id: makeOpId("pt"),
      name: "New packing template",
      capacity: 1,
      basis: "per_set",
      status: "active",
      materials: []
    };
    if (await persistTemplate(next)) {
      saveTemplatesState([next, ...templates]);
      setEditingId(next.id);
    }
  };

  const duplicateTemplate = async (template: PackingTemplateRecord) => {
    const next = { ...template, id: makeOpId("pt"), name: `${template.name} Copy`, status: "active" as const, materials: template.materials.map(line => ({ ...line, id: makeOpId("pt-line") })) };
    if (await persistTemplate(next)) {
      saveTemplatesState([next, ...templates]);
      addActivityLog({ actorName: "Admin", action: `Packing template duplicated: ${template.name}`, entityType: "packing_template", entityId: next.id });
    }
  };

  const archiveTemplate = async (template: PackingTemplateRecord) => {
    setIsSaving(true);
    setLoadError(null);
    try {
      await archivePackingTemplateInSupabase(template);
      updateTemplate(template.id, { status: "archived" });
      addActivityLog({ actorName: "Admin", action: `Packing template archived: ${template.name}`, entityType: "packing_template", entityId: template.id });
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
          <p className="text-label-sm uppercase text-primary">Ecommerce</p>
          <h2 className="mt-1 text-[32px] font-bold leading-tight text-white">Packing Templates</h2>
        </div>
        <Button size="sm" className="mt-2 h-9 px-3" onClick={addTemplate}>
          <Plus className="h-4 w-4" /> New
        </Button>
      </div>

      {loadError && (
        <Card className="mt-4 rounded-lg border border-error/25 bg-error/10 p-3 text-[12.5px] leading-5 text-error">
          {loadError}
        </Card>
      )}

      {isLoading && (
        <Card className="mt-4 rounded-lg border border-outline-variant/25 bg-surface-container p-3 text-[13px] text-on-surface-variant">
          Loading packing templates from Supabase...
        </Card>
      )}

      <section className="mt-4 space-y-2 pb-16">
        {!isLoading && !loadError && templates.length === 0 && (
          <Card className="rounded-lg border border-outline-variant/25 bg-surface-container p-4 text-center text-[13px] text-on-surface-variant">
            No Supabase packing templates yet.
          </Card>
        )}
        {templates.map(template => {
          const cost = estimatePackingTemplateCost(template, inventoryItems);
          const isEditing = editingId === template.id;
          return (
            <Card key={template.id} className="rounded-lg border border-outline-variant/30 bg-surface-container p-3">
              {isEditing ? (
                <TemplateEditor
                  template={template}
                  packagingItems={packagingItems}
                  onChange={(updates) => updateTemplate(template.id, updates)}
                  onDone={async () => {
                    if (await persistTemplate(template)) {
                      setEditingId(null);
                      addActivityLog({ actorName: "Admin", action: `Packing template edited: ${template.name}`, entityType: "packing_template", entityId: template.id });
                    }
                  }}
                  isSaving={isSaving}
                />
              ) : (
                <>
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="truncate text-[15px] font-semibold text-white">{template.name}</h3>
                      <p className="mt-0.5 text-[12px] text-on-surface-variant">Capacity {template.capacity} {"\u2022"} {template.materials.length} materials {"\u2022"} {template.basis.replace("_", " ")}</p>
                    </div>
                    <span className={cn("rounded-full border px-2 py-0.5 text-[11px] font-bold uppercase", template.status === "active" ? "border-success/20 bg-success/10 text-success" : "border-outline-variant/40 bg-surface-container-high text-on-surface-variant")}>{template.status}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between rounded-md bg-surface-container-low px-2.5 py-2">
                    <span className="text-[12px] text-on-surface-variant">Estimated packing cost</span>
                    <span className="text-[13px] font-bold text-white">{cost.missingCost ? "Cost pending" : formatMoney(cost.total)}</span>
                  </div>
                  <div className="mt-2 grid grid-cols-3 gap-1.5">
                    <SmallButton onClick={() => setEditingId(template.id)} icon={<Edit3 className="h-3.5 w-3.5" />} label="Edit" />
                    <SmallButton onClick={() => void duplicateTemplate(template)} icon={<Copy className="h-3.5 w-3.5" />} label="Duplicate" />
                    <SmallButton onClick={() => void archiveTemplate(template)} icon={<Archive className="h-3.5 w-3.5" />} label="Archive" />
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

function TemplateEditor({
  template,
  packagingItems,
  onChange,
  onDone,
  isSaving
}: Readonly<{ template: PackingTemplateRecord; packagingItems: ReturnType<typeof useApp>["inventoryItems"]; onChange: (updates: Partial<PackingTemplateRecord>) => void; onDone: () => void; isSaving: boolean }>) {
  const addLine = () => {
    if (!packagingItems[0]) return;
    onChange({
      materials: [...template.materials, {
        id: makeOpId("pt-line"),
        inventoryItemId: packagingItems[0].id,
        qty: 1,
        unit: packagingItems[0].unit,
        usageRule: "per_set"
      }]
    });
  };

  const updateLine = (id: string, updates: Partial<PackingTemplateRecord["materials"][number]>) => {
    onChange({ materials: template.materials.map(line => line.id === id ? { ...line, ...updates } : line) });
  };

  return (
    <div>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Template name"><Input value={template.name} onChange={e => onChange({ name: e.target.value })} className="h-9 text-[13px]" /></Field>
        <Field label="Capacity"><Input type="number" value={template.capacity} onChange={e => onChange({ capacity: Math.max(1, Number(e.target.value) || 1) })} className="h-9 text-[13px]" /></Field>
        <div className="col-span-2">
          <Field label="Basis">
            <select value={template.basis} onChange={e => onChange({ basis: e.target.value as PackingTemplateRecord["basis"] })} className="h-9 w-full rounded-md border border-outline bg-surface-container px-2 text-[13px] text-white">
              <option value="per_order">per order</option>
              <option value="per_item">per item</option>
              <option value="per_set">per set/package</option>
            </select>
          </Field>
        </div>
      </div>
      <Button size="sm" variant="ghost" className="mt-3 h-8 w-full" onClick={addLine}>+ Add packaging material</Button>
      <div className="mt-2 space-y-2">
        {template.materials.map(line => {
          const selectedItem = packagingItems.find(item => item.id === line.inventoryItemId);
          const unitOptions = selectedItem ? compatibleUnitsFor(selectedItem.unit) : [line.unit];
          return (
            <div key={line.id} className="rounded-md bg-surface-container-low p-2">
              <SearchableInventoryPicker
                items={packagingItems}
                onChange={(itemId, item) => updateLine(line.id, { inventoryItemId: itemId, unit: item.unit })}
                placeholder="Search packaging..."
                value={line.inventoryItemId}
              />
              <div className="mt-1.5 grid grid-cols-[64px_72px_1fr] gap-1.5">
                <Input type="number" value={line.qty} onChange={e => updateLine(line.id, { qty: Number(e.target.value) || 0 })} className="h-9 text-right text-[12px]" />
                <select value={line.unit} onChange={e => updateLine(line.id, { unit: e.target.value as PackingTemplateRecord["materials"][number]["unit"] })} className="h-9 rounded-md border border-outline bg-surface-container px-1 text-[12px] text-white">
                  {unitOptions.map(unit => <option key={unit} value={unit}>{unit}</option>)}
                </select>
                <select value={line.usageRule} onChange={e => updateLine(line.id, { usageRule: e.target.value as PackingTemplateRecord["materials"][number]["usageRule"] })} className="h-9 rounded-md border border-outline bg-surface-container px-1 text-[11px] text-white">
                  <option value="per_order">order</option>
                  <option value="per_item">item</option>
                  <option value="per_set">set</option>
                </select>
              </div>
              {selectedItem && line.unit !== selectedItem.unit && (
                <p className="mt-1 text-[11px] text-primary">Auto-converts {line.unit} to stock unit {selectedItem.unit} when deducted.</p>
              )}
            </div>
          );
        })}
      </div>
      <Button size="sm" className="mt-3 h-9 w-full" onClick={onDone} disabled={isSaving}><Save className="h-4 w-4" /> {isSaving ? "Saving..." : "Save Template"}</Button>
    </div>
  );
}

function Field({ label, children }: Readonly<{ label: string; children: React.ReactNode }>) {
  return <label className="block space-y-1"><span className="text-[10px] font-bold uppercase text-outline">{label}</span>{children}</label>;
}

function SmallButton({ icon, label, onClick }: Readonly<{ icon: React.ReactNode; label: string; onClick: () => void }>) {
  return <button type="button" onClick={onClick} className="flex h-8 items-center justify-center gap-1 rounded-md border border-outline-variant/25 text-[11.5px] font-semibold text-on-surface-variant">{icon}{label}</button>;
}
