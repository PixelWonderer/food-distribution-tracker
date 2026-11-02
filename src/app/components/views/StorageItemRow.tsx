import React from 'react';

import { QuantityBadge } from '@/app/components/ui/quantity-badge';
import { IconButton } from '@/app/components/ui/icon-button';
import { cn } from '@/lib/utils';
import type { ItemData } from '@/types';

export const StorageItemRow: React.FC<{
  item: ItemData;
  packed: boolean;
  onToggle: (item: ItemData) => void;
  onShowDetails: (item: ItemData) => void;
  isLast: boolean;
  tutorialTarget?: string;
  tutorialCheckboxTarget?: string;
}> = ({ item, packed, onToggle, onShowDetails, isLast, tutorialTarget, tutorialCheckboxTarget }) => {
  return (
    <label
      className={cn(
        'group relative flex min-h-[56px] items-center gap-3 px-4 py-2.5 transition-colors focus-within:outline-none',
        !isLast && 'border-b border-slate-100',
        packed ? 'bg-[#E9FFF4]' : 'bg-white hover:bg-slate-50/60'
      )}
      data-tutorial={tutorialTarget}
    >
      <button
        type="button"
        onClick={(event) => {
          event.preventDefault();
          onToggle(item);
        }}
        aria-label={packed ? 'Mark as not stored' : 'Mark as stored'}
        data-tutorial={tutorialCheckboxTarget}
        className={cn(
          'flex h-11 w-11 shrink-0 items-center justify-center -ml-1.5 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-400/50'
        )}
      >
        <span
          aria-hidden
          className={cn(
            'flex h-7 w-7 items-center justify-center rounded-lg border-[1.5px] text-sm font-bold text-white transition-colors',
            packed
              ? 'border-[#0F7A4F] bg-[#0F7A4F]'
              : 'border-slate-300 bg-white group-hover:border-indigo-400'
          )}
        >
          {packed ? '✓' : ''}
        </span>
      </button>

      <span
        aria-hidden
        className="w-[30px] shrink-0 text-center text-[22px] leading-none"
      >
        {item.emoji}
      </span>

      <div className="flex flex-1 min-w-0 items-center">
        <span
          className={cn(
            'truncate text-[15px] font-semibold leading-tight',
            packed
              ? 'text-[#0F7A4F] line-through opacity-75'
              : 'text-foreground'
          )}
        >
          {item.name}
        </span>
      </div>

      <QuantityBadge
        quantity={item.quantity}
        options={{ hideCaseUnit: true }}
        tone={packed ? 'mint' : 'lavender'}
        variant="solid"
        className="shrink-0 px-2.5 py-1"
      />

      <IconButton
        variant="ghost"
        size="sm"
        aria-label="View item details"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onShowDetails(item);
        }}
        className="shrink-0 text-muted-foreground hover:text-foreground"
      >
        ℹ️
      </IconButton>
    </label>
  );
};
