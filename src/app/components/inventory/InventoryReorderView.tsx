import React, { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useAppStore } from '@/services/state';
import { Card, CardContent, CardHeader, CardTitle } from '@/app/components/ui/card';
import { InventoryCategoryChips, type CategoryFilter } from './InventoryCategoryChips';
import { InventoryItemCard } from './InventoryItemCard';
import { formatQuantity } from '@/app/utils/quantity';
import { Package, AlertTriangle, Search, X } from 'lucide-react';

// Inline threshold editor — tap the threshold to change it, suggestion updates live
const ThresholdEditor: React.FC<{
  itemId: string;
  threshold: number;
  unit: string;
  color?: 'red' | 'slate';
}> = ({ itemId, threshold, unit, color = 'slate' }) => {
  const setLowStockThreshold = useAppStore((s) => s.setLowStockThreshold);
  const [isEditing, setIsEditing] = useState(false);
  const [value, setValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleStart = () => {
    setValue(threshold.toString());
    setIsEditing(true);
  };

  const handleFinish = useCallback(() => {
    const parsed = parseInt(value, 10);
    if (!isNaN(parsed) && parsed >= 0 && parsed !== threshold) {
      setLowStockThreshold(itemId, parsed);
    }
    setIsEditing(false);
  }, [value, threshold, itemId, setLowStockThreshold]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') handleFinish();
    if (e.key === 'Escape') setIsEditing(false);
  };

  const suggestion = threshold * 2;
  const { unit: pluralUnit } = formatQuantity(suggestion, { unit });
  const textColor = color === 'red' ? 'text-red-700' : 'text-slate-700';

  if (isEditing) {
    return (
      <div className="text-right shrink-0">
        <p className="text-xs text-slate-500">Threshold</p>
        <input
          ref={inputRef}
          type="number"
          min="0"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={handleFinish}
          onKeyDown={handleKeyDown}
          className="w-12 text-center text-sm font-semibold border border-indigo-300 rounded px-1 py-0.5 focus:outline-none focus:ring-2 focus:ring-indigo-200"
        />
      </div>
    );
  }

  return (
    <div className="text-right shrink-0">
      <button
        onClick={handleStart}
        className="text-right hover:bg-slate-100/60 rounded px-1 -mx-1 transition"
        title="Tap to edit threshold"
      >
        <p className="text-xs text-slate-500">Suggest</p>
        <p className={`font-semibold ${textColor}`}>
          {suggestion}{' '}
          <span className="text-xs font-normal capitalize">{pluralUnit}</span>
        </p>
        <p className="text-[10px] text-slate-400">min {threshold}</p>
      </button>
    </div>
  );
};

export const InventoryReorderView: React.FC = () => {
  const inventoryItems = useAppStore((state) => state.inventoryItems);

  const [category, setCategory] = useState<CategoryFilter>('all');
  const [searchQuery, setSearchQuery] = useState('');

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

  // Group filtered items by stock status, sorted appropriately
  const { outOfStock, lowStock, wellStocked } = useMemo(() => {
    const outOfStock = filteredItems
      .filter((i) => i.currentQuantity === 0)
      .sort((a, b) => a.itemName.localeCompare(b.itemName)); // Alphabetical
    const lowStock = filteredItems
      .filter((i) => i.currentQuantity > 0 && i.isLowStock)
      .sort((a, b) => a.currentQuantity - b.currentQuantity); // Lowest first (more urgent)
    const wellStocked = filteredItems
      .filter((i) => i.currentQuantity > 0 && !i.isLowStock)
      .sort((a, b) => b.currentQuantity - a.currentQuantity); // Highest first

    return { outOfStock, lowStock, wellStocked };
  }, [filteredItems]);

  const totalNeedsReorder = outOfStock.length + lowStock.length;

  return (
    <div className="space-y-4">
      {/* Info banner */}
      <div className="rounded-xl border border-[#CFC9FF] bg-[#E8E6FF] p-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-[#3B33D4]">Reorder Suggestions</p>
            <p className="text-xs text-[#3B33D4]/85">
              Items below threshold or out of stock.
            </p>
          </div>
          {totalNeedsReorder > 0 && (
            <div className="flex items-center gap-2 rounded-full bg-white/60 px-3 py-1">
              <AlertTriangle className="h-4 w-4 text-[#3B33D4]" />
              <span className="text-sm font-semibold text-[#3B33D4]">
                {totalNeedsReorder} need{totalNeedsReorder !== 1 ? '' : 's'} reorder
              </span>
            </div>
          )}
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

      {/* Out of Stock section */}
      {outOfStock.length > 0 && (
        <Card className="border-[#F8B8C5]">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-base">
              <span className="flex items-center gap-2 text-[#E11D48]">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#E11D48] text-xs text-white">
                  !
                </span>
                Out of Stock
              </span>
              <span className="text-sm font-normal text-[#E11D48]/80">
                {outOfStock.length} item{outOfStock.length !== 1 ? 's' : ''}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 pt-0">
            {outOfStock.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between rounded-xl border border-[#F8B8C5] bg-[#FFE4E9]/50 px-4 py-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-2xl shrink-0">{item.emoji}</span>
                  <div className="min-w-0">
                    <p className="font-medium truncate text-slate-800">
                      {item.itemName}
                    </p>
                    <p className="text-xs text-slate-500">
                      {item.subcategory || 'Pantry'}
                    </p>
                  </div>
                </div>
                <ThresholdEditor
                  itemId={item.id}
                  threshold={item.lowStockThreshold}
                  unit={item.unit}
                  color="red"
                />
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* Low Stock section */}
      {lowStock.length > 0 && (
        <Card className="border-[#FFCFAC]">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-base">
              <span className="flex items-center gap-2 text-[#B75A28]">
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#D97706] text-xs text-white">
                  ⚠
                </span>
                Low Stock
              </span>
              <span className="text-sm font-normal text-[#B75A28]/80">
                {lowStock.length} item{lowStock.length !== 1 ? 's' : ''}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 pt-0">
            {lowStock.map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between rounded-xl border border-[#FFCFAC] bg-[#FFF4ED]/60 px-4 py-3"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-2xl shrink-0">{item.emoji}</span>
                  <div className="min-w-0">
                    <p className="font-medium truncate text-slate-800">
                      {item.itemName}
                    </p>
                    <p className="text-xs text-slate-500">
                      {item.subcategory || 'Pantry'}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <div className="text-center">
                    <p className="text-xs text-slate-500">Current</p>
                    <p className="font-semibold text-[#B75A28]" style={{ fontFamily: 'var(--font-mono)' }}>
                      {item.currentQuantity}
                    </p>
                  </div>
                  <div className="text-slate-300">→</div>
                  <ThresholdEditor
                    itemId={item.id}
                    threshold={item.lowStockThreshold}
                    unit={item.unit}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      )}

      {/* All well stocked message */}
      {totalNeedsReorder === 0 && (
        <div className="rounded-xl border border-[#A7F0CA] bg-[#E9FFF4] p-6 text-center">
          <Package className="mx-auto h-12 w-12 text-[#0F7A4F]" />
          <p className="mt-2 font-semibold text-[#0F7A4F]">All stocked up!</p>
          <p className="text-sm text-[#0F7A4F]/80">
            {wellStocked.length} item{wellStocked.length !== 1 ? 's' : ''} above threshold
          </p>
        </div>
      )}

      {/* Summary card */}
      {wellStocked.length > 0 && totalNeedsReorder > 0 && (
        <details className="group rounded-xl border border-slate-200 bg-slate-50/50 px-4 py-4">
          <summary className="flex cursor-pointer items-center justify-between gap-3 text-sm font-semibold text-slate-700">
            <span className="flex items-center gap-2">
              <span className="text-green-500">✓</span>
              Well Stocked
              <span className="font-semibold text-slate-500">
                ({wellStocked.length})
              </span>
            </span>
            <span className="text-xs uppercase text-slate-500 group-open:hidden">
              Show
            </span>
            <span className="hidden text-xs uppercase text-slate-500 group-open:block">
              Hide
            </span>
          </summary>
          <div className="mt-4 space-y-2">
            {wellStocked.map((item) => (
              <InventoryItemCard key={item.id} item={item} mode="reorder" />
            ))}
          </div>
        </details>
      )}
    </div>
  );
};

export default InventoryReorderView;
