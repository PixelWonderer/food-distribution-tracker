import React from 'react';
import { cn } from '@/lib/utils';
import { Chip } from '@/app/components/ui/chip';
import type { PantrySubcategory } from '@/types';

export type CategoryFilter = PantrySubcategory | 'all';

const CATEGORIES: Array<{ id: CategoryFilter; label: string; icon: string }> = [
  { id: 'all', label: 'All', icon: '📦' },
  { id: 'Beans & Legumes', label: 'Beans', icon: '🫘' },
  { id: 'Grains & Pasta', label: 'Grains', icon: '🌾' },
  { id: 'Canned Goods', label: 'Canned', icon: '🥫' },
  { id: 'Condiments & Sauces', label: 'Condiments', icon: '🌶️' },
  { id: 'Snacks & Other', label: 'Snacks', icon: '🍬' },
];

type InventoryCategoryChipsProps = {
  selected: CategoryFilter;
  onChange: (category: CategoryFilter) => void;
  /** Optional counts per category for display */
  counts?: Record<CategoryFilter, number>;
};

// Category filter pills — horizontal-scroll row matching the design.
// Uses the Chip primitive with slate tone; active state renders the dark ink bg + white text.
export const InventoryCategoryChips: React.FC<InventoryCategoryChipsProps> = ({
  selected,
  onChange,
  counts,
}) => {
  return (
    <div
      className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide"
      role="tablist"
      aria-label="Category filter"
    >
      {CATEGORIES.map((cat) => {
        const count = counts?.[cat.id];
        const isActive = selected === cat.id;

        return (
          <Chip
            key={cat.id}
            tone="slate"
            density="compact"
            active={isActive}
            role="tab"
            aria-selected={isActive}
            onClick={() => onChange(cat.id)}
            className="shrink-0 whitespace-nowrap"
          >
            <span aria-hidden>{cat.icon}</span>
            <span>{cat.label}</span>
            {count !== undefined && (
              <span
                className={cn(
                  'ml-0.5 text-[10px] font-semibold',
                  isActive ? 'text-white/70' : 'text-slate-400'
                )}
              >
                {count}
              </span>
            )}
          </Chip>
        );
      })}
    </div>
  );
};

export { CATEGORIES };
export default InventoryCategoryChips;
