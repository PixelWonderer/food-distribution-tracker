import React, { useState, useMemo } from 'react';
import { useAppStore } from '@/services/state';
import { InventoryCategoryChips, type CategoryFilter } from './InventoryCategoryChips';
import { InventoryItemCard } from './InventoryItemCard';
import { TakeItemSheet } from './TakeItemSheet';
import type { InventoryItem } from '@/types';
import { Archive, Search, X } from 'lucide-react';

export const InventoryBrowseView: React.FC = () => {
  const {
    inventoryItems,
    destinations,
    preferences,
    takeInventoryItem,
  } = useAppStore((state) => ({
    inventoryItems: state.inventoryItems,
    destinations: state.destinations,
    preferences: state.preferences,
    takeInventoryItem: state.takeInventoryItem,
  }));

  const [category, setCategory] = useState<CategoryFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [takeSheetOpen, setTakeSheetOpen] = useState(false);
  const [selectedItem, setSelectedItem] = useState<InventoryItem | null>(null);

  // Search-filtered items (before category filter) — used for category counts
  const searchFilteredItems = useMemo(() => {
    let items = inventoryItems.filter((i) => i.isActive);

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      items = items.filter((i) =>
        i.itemName.toLowerCase().includes(query)
      );
    }

    return items;
  }, [inventoryItems, searchQuery]);

  // Apply category filter on top of search
  const filteredItems = useMemo(() => {
    if (category === 'all') return searchFilteredItems;
    return searchFilteredItems.filter((i) => i.subcategory === category);
  }, [searchFilteredItems, category]);

  // Group items: In Stock vs Out of Stock, sorted by quantity descending
  const { inStock, outOfStock } = useMemo(() => {
    const inStock = filteredItems
      .filter((i) => i.currentQuantity > 0)
      .sort((a, b) => b.currentQuantity - a.currentQuantity);
    const outOfStock = filteredItems
      .filter((i) => i.currentQuantity === 0)
      .sort((a, b) => a.itemName.localeCompare(b.itemName));
    return { inStock, outOfStock };
  }, [filteredItems]);

  // Category counts based on search-filtered items (reflects search query)
  const categoryCounts = useMemo(() => {
    const counts: Record<CategoryFilter, number> = {
      all: searchFilteredItems.length,
      'Beans & Legumes': 0,
      'Grains & Pasta': 0,
      'Canned Goods': 0,
      'Condiments & Sauces': 0,
      'Snacks & Other': 0,
    };

    searchFilteredItems.forEach((i) => {
      if (i.subcategory && i.subcategory in counts) {
        counts[i.subcategory as CategoryFilter]++;
      }
    });

    return counts;
  }, [searchFilteredItems]);

  const handleTakeClick = (item: InventoryItem) => {
    setSelectedItem(item);
    setTakeSheetOpen(true);
  };

  const handleTake = async (
    itemId: string,
    quantity: number,
    destinationId?: string,
    destinationName?: string
  ) => {
    return await takeInventoryItem(itemId, quantity, destinationId, destinationName);
  };

  return (
    <div className="space-y-3">
      {/* Search input */}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Search items..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="h-11 w-full rounded-[14px] border border-slate-200 bg-white py-2 pl-9 pr-9 text-sm text-slate-800 placeholder:text-slate-400 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-slate-400 hover:bg-slate-100 hover:text-slate-600"
            aria-label="Clear search"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Category filter chips */}
      <InventoryCategoryChips
        selected={category}
        onChange={setCategory}
        counts={categoryCounts}
      />

      {/* In Stock list — bare cards, no Card wrapper per the mock aesthetic */}
      {inStock.length > 0 ? (
        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between pt-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">
            <span className="inline-flex items-center gap-1.5">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" aria-hidden />
              In stock
            </span>
            <span className="text-slate-400">
              {inStock.length} item{inStock.length !== 1 ? 's' : ''}
            </span>
          </div>
          {inStock.map((item) => (
            <InventoryItemCard
              key={item.id}
              item={item}
              mode="browse"
              onTake={() => handleTakeClick(item)}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-[16px] border border-dashed border-slate-300 bg-white/60 p-8 text-center">
          <Archive className="mx-auto h-10 w-10 text-slate-400" />
          <p className="mt-2 text-sm text-slate-600">
            {searchQuery
              ? `No items found for "${searchQuery}".`
              : category === 'all'
                ? 'No items in stock.'
                : `No items in stock for "${category}".`}
          </p>
        </div>
      )}

      {/* Out of Stock accordion */}
      {outOfStock.length > 0 && (
        <details className="group rounded-[16px] border border-dashed border-[#FFCFAC] bg-[#FFF4ED]/60 px-4 py-3">
          <summary className="flex cursor-pointer items-center justify-between gap-3 text-sm font-semibold text-[#B75A28]">
            <span className="inline-flex items-center gap-2">
              <span className="h-1.5 w-1.5 rounded-full bg-[#B75A28]" aria-hidden />
              Out of stock
              <span className="font-semibold">({outOfStock.length})</span>
            </span>
            <span className="text-[10px] uppercase tracking-[0.12em] text-[#B75A28]/70 group-open:hidden">Show</span>
            <span className="hidden text-[10px] uppercase tracking-[0.12em] text-[#B75A28]/70 group-open:block">Hide</span>
          </summary>
          <div className="mt-3 flex flex-col gap-2">
            {outOfStock.map((item) => (
              <InventoryItemCard
                key={item.id}
                item={item}
                mode="browse"
              />
            ))}
          </div>
        </details>
      )}

      {/* Take Item Sheet */}
      <TakeItemSheet
        open={takeSheetOpen}
        onOpenChange={setTakeSheetOpen}
        item={selectedItem}
        destinations={destinations}
        volunteerName={preferences.volunteerName || ''}
        onTake={handleTake}
      />
    </div>
  );
};

export default InventoryBrowseView;
