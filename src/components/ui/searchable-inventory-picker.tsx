"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import type { InventoryItem } from "@/types/domain";
import { cn } from "@/lib/utils";

type SearchableInventoryPickerProps = {
  items: InventoryItem[];
  value?: string;
  onChange: (itemId: string, item: InventoryItem) => void;
  placeholder?: string;
  emptyText?: string;
  className?: string;
};

export function SearchableInventoryPicker({
  items,
  value,
  onChange,
  placeholder = "Search item...",
  emptyText = "No matching items",
  className
}: SearchableInventoryPickerProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const listboxId = useId();
  const selected = items.find(item => item.id === value);
  const [query, setQuery] = useState(selected?.name ?? "");
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    setQuery(selected?.name ?? "");
  }, [selected?.id, selected?.name]);

  useEffect(() => {
    const handlePointerDown = (event: PointerEvent) => {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("pointerdown", handlePointerDown);
    return () => document.removeEventListener("pointerdown", handlePointerDown);
  }, []);

  const matches = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    if (!normalized) return items.slice(0, 8);
    return items
      .filter(item => `${item.name} ${item.sku ?? ""} ${item.locationId ?? ""}`.toLowerCase().includes(normalized))
      .slice(0, 8);
  }, [items, query]);

  return (
    <div ref={wrapperRef} className={cn("relative min-w-0", className)}>
      <input
        aria-autocomplete="list"
        aria-controls={listboxId}
        aria-expanded={isOpen}
        className="h-9 w-full min-w-0 rounded-md border border-outline bg-surface-container px-2 text-[12px] text-white outline-none placeholder:text-on-surface-variant focus:border-primary"
        onChange={event => {
          setQuery(event.target.value);
          setIsOpen(true);
        }}
        onFocus={() => setIsOpen(true)}
        placeholder={placeholder}
        role="combobox"
        value={query}
      />
      {isOpen && (
        <div id={listboxId} className="absolute left-0 right-0 top-[calc(100%+4px)] z-50 max-h-56 overflow-y-auto rounded-md border border-outline-variant bg-surface-container-high p-1 shadow-xl">
          {matches.length === 0 ? (
            <p className="px-2 py-2 text-[12px] text-on-surface-variant">{emptyText}</p>
          ) : matches.map(item => (
            <button
              className={cn(
                "block w-full rounded px-2 py-2 text-left text-[12px] text-white hover:bg-surface-variant",
                item.id === value && "bg-primary/15 text-primary"
              )}
              aria-selected={item.id === value}
              key={item.id}
              onClick={() => {
                onChange(item.id, item);
                setQuery(item.name);
                setIsOpen(false);
              }}
              role="option"
              type="button"
            >
              <span className="block truncate font-semibold">{item.name}</span>
              <span className="block truncate text-[11px] text-on-surface-variant">
                {item.category} &bull; {item.locationId} &bull; stock unit {item.unit}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
