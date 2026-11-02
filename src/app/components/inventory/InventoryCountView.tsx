import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useAppStore } from '@/services/state';
import { StorageService } from '@/services/storage';
import { InventoryCategoryChips, type CategoryFilter } from './InventoryCategoryChips';
import { InventoryItemCard } from './InventoryItemCard';
import { AddCustomItemSheet } from './AddCustomItemSheet';
import type { InventoryItem, PantrySubcategory } from '@/types';
import { RotateCcw, Search, X, Plus } from 'lucide-react';
import { Button } from '@/app/components/ui/button';

export const InventoryCountView: React.FC = () => {
  const {
    inventoryItems,
    setInventoryCount,
    addCustomInventoryItem,
  } = useAppStore((state) => ({
    inventoryItems: state.inventoryItems,
    setInventoryCount: state.setInventoryCount,
    addCustomInventoryItem: state.addCustomInventoryItem,
  }));

  const [category, setCategory] = useState<CategoryFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [countedItems, setCountedItems] = useState<Set<string>>(() => {
    const stored = StorageService.getInstance().loadCountedItems();
    return new Set(stored);
  });
  const [addItemSheetOpen, setAddItemSheetOpen] = useState(false);

  // Persist counted items to localStorage so progress survives tab switches and refreshes
  useEffect(() => {
    StorageService.getInstance().saveCountedItems(Array.from(countedItems));
  }, [countedItems]);

  const handleAddItem = async (item: {
    name: string;
    quantity: number;
    subcategory: PantrySubcategory;
    unit: string;
    emoji: string;
  }) => {
    return await addCustomInventoryItem(item.name, item.quantity, {
      subcategory: item.subcategory,
      unit: item.unit,
      emoji: item.emoji,
    });
  };

  // Search-filtered items (before category) — used for category counts
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

  // Category counts based on search-filtered items
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

  // Split into uncounted and counted, sorted by quantity (items with stock first)
  const { uncounted, counted } = useMemo(() => {
    const sortByQty = (a: InventoryItem, b: InventoryItem) => {
      // Items with stock first
      if (a.currentQuantity > 0 && b.currentQuantity === 0) return -1;
      if (a.currentQuantity === 0 && b.currentQuantity > 0) return 1;
      // Then by quantity descending
      return b.currentQuantity - a.currentQuantity;
    };

    const uncounted = filteredItems
      .filter((i) => !countedItems.has(i.id))
      .sort(sortByQty);
    const counted = filteredItems
      .filter((i) => countedItems.has(i.id))
      .sort(sortByQty);
    return { uncounted, counted };
  }, [filteredItems, countedItems]);

  const handleQuantityChange = useCallback(
    async (item: InventoryItem, delta: number) => {
      const newQuantity = Math.max(0, item.currentQuantity + delta);
      const success = await setInventoryCount(item.id, newQuantity);
      if (success) {
        // Mark as counted
        setCountedItems((prev) => new Set(prev).add(item.id));
      }
    },
    [setInventoryCount]
  );

  const handleMarkCounted = useCallback(
    (item: InventoryItem) => {
      setCountedItems((prev) => new Set(prev).add(item.id));
    },
    []
  );

  const handleResetCounted = () => {
    setCountedItems(new Set());
    StorageService.getInstance().clearCountedItems();
  };

  const progress = filteredItems.length > 0
    ? Math.round((counted.length / filteredItems.length) * 100)
    : 0;

  return (
    <div className="space-y-4">
      {/* Info banner */}
      <div className="rounded-xl border border-[#F8D979] bg-[#FFF5D1] p-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-[#C99B00]">Inventory Mode</p>
            <p className="text-xs text-[#C99B00]/85">
              Count each item physically and update quantities.
            </p>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold text-[#C99B00]" style={{ fontFamily: 'var(--font-mono)' }}>{progress}%</p>
            <p className="text-xs text-[#C99B00]/80" style={{ fontFamily: 'var(--font-mono)' }}>
              {counted.length}/{filteredItems.length}
            </p>
          </div>
        </div>
        {/* Progress bar */}
        <div className="mt-2 h-2 w-full rounded-full bg-[#F8D979]/60">
          <div
            className="h-2 rounded-full bg-[#F5C422] transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          placeholder="Search items..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-9 text-sm placeholder:text-slate-400 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100"
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Category filter chips */}
      <InventoryCategoryChips selected={category} onChange={setCategory} counts={categoryCounts} />

      {/* Reset button */}
      {counted.length > 0 && (
        <Button
          variant="outline"
          size="sm"
          onClick={handleResetCounted}
          className="w-full"
        >
          <RotateCcw className="mr-2 h-4 w-4" />
          Reset Counted ({counted.length})
        </Button>
      )}

      {/* Needs Counting section */}
      {uncounted.length > 0 && (
        <details
          open
          className="group rounded-xl border border-dashed border-[#FFCFAC]/70 bg-[#FFF4ED]/70 px-4 py-4"
        >
          <summary className="flex cursor-pointer items-center justify-between gap-3 text-sm font-semibold text-[#B75A28]">
            <span className="flex items-center gap-2">
              Needs Counting
              <span className="font-semibold text-[#B75A28]/85" style={{ fontFamily: 'var(--font-mono)' }}>
                ({uncounted.length})
              </span>
            </span>
            <span className="text-xs uppercase tracking-[0.08em] text-[#B75A28]/70 group-open:hidden">
              Show
            </span>
            <span className="hidden text-xs uppercase tracking-[0.08em] text-[#B75A28]/70 group-open:block">
              Hide
            </span>
          </summary>
          <div className="mt-4 space-y-2">
            {uncounted.map((item) => (
              <InventoryItemCard
                key={item.id}
                item={item}
                mode="count"
                onQuantityChange={(delta) => handleQuantityChange(item, delta)}
                onMarkCounted={() => handleMarkCounted(item)}
              />
            ))}
          </div>
        </details>
      )}

      {/* Already Counted section */}
      {counted.length > 0 && (
        <details className="group rounded-xl border border-dashed border-[#A7F0CA]/70 bg-[#E9FFF4]/70 px-4 py-4">
          <summary className="flex cursor-pointer items-center justify-between gap-3 text-sm font-semibold text-[#0F7A4F]">
            <span className="flex items-center gap-2">
              <span className="text-[#0F7A4F]">✓</span>
              Already Counted
              <span className="font-semibold text-[#0F7A4F]/85" style={{ fontFamily: 'var(--font-mono)' }}>
                ({counted.length})
              </span>
            </span>
            <span className="text-xs uppercase tracking-[0.08em] text-[#0F7A4F]/70 group-open:hidden">
              Show
            </span>
            <span className="hidden text-xs uppercase tracking-[0.08em] text-[#0F7A4F]/70 group-open:block">
              Hide
            </span>
          </summary>
          <div className="mt-4 space-y-2">
            {counted.map((item) => (
              <InventoryItemCard
                key={item.id}
                item={item}
                mode="count"
                onQuantityChange={(delta) => handleQuantityChange(item, delta)}
                onMarkCounted={() => handleMarkCounted(item)}
              />
            ))}
          </div>
        </details>
      )}

      {/* All counted message */}
      {uncounted.length === 0 && filteredItems.length > 0 && (
        <div className="rounded-xl border border-[#A7F0CA] bg-[#E9FFF4] p-6 text-center">
          <span className="text-4xl">🎉</span>
          <p className="mt-2 font-semibold text-[#0F7A4F]">All items counted!</p>
          <p className="text-sm text-[#0F7A4F]/80">
            {counted.length} item{counted.length !== 1 ? 's' : ''} verified
          </p>
        </div>
      )}

      {/* Empty state */}
      {filteredItems.length === 0 && (
        <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-8 text-center">
          <p className="text-sm text-slate-600">
            No items to count in this category.
          </p>
        </div>
      )}

      {/* Add Item button */}
      <Button
        variant="outline"
        size="lg"
        onClick={() => setAddItemSheetOpen(true)}
        className="w-full border-dashed border-2 text-slate-600 hover:text-slate-800 hover:bg-slate-50"
      >
        <Plus className="mr-2 h-5 w-5" />
        Add Custom Item
      </Button>

      {/* Add Custom Item Sheet */}
      <AddCustomItemSheet
        open={addItemSheetOpen}
        onOpenChange={setAddItemSheetOpen}
        onAdd={handleAddItem}
      />
    </div>
  );
};

export default InventoryCountView;
