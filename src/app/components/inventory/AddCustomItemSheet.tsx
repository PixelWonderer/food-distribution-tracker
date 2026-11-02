import React, { useState, useEffect } from 'react';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
} from '@/app/components/ui/sheet';
import { Button } from '@/app/components/ui/button';
import { Chip } from '@/app/components/ui/chip';
import type { PantrySubcategory } from '@/types';

// Auto-emoji mapping based on category
const CATEGORY_EMOJI: Record<PantrySubcategory, string> = {
  'Beans & Legumes': '🫘',
  'Grains & Pasta': '🌾',
  'Canned Goods': '🥫',
  'Condiments & Sauces': '🌶️',
  'Snacks & Other': '📦',
};

const CATEGORIES: PantrySubcategory[] = [
  'Snacks & Other',
  'Beans & Legumes',
  'Grains & Pasta',
  'Canned Goods',
  'Condiments & Sauces',
];

const UNITS = ['Case', 'Each', 'Box', 'Bag', 'Jar', 'Can', 'Bottle'];

type AddCustomItemSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onAdd: (item: {
    name: string;
    quantity: number;
    subcategory: PantrySubcategory;
    unit: string;
    emoji: string;
  }) => Promise<boolean>;
};

export const AddCustomItemSheet: React.FC<AddCustomItemSheetProps> = ({
  open,
  onOpenChange,
  onAdd,
}) => {
  const [name, setName] = useState('');
  const [quantity, setQuantity] = useState(0);
  const [subcategory, setSubcategory] = useState<PantrySubcategory>('Snacks & Other');
  const [unit, setUnit] = useState('Case');
  const [customEmoji, setCustomEmoji] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset state when sheet opens
  useEffect(() => {
    if (open) {
      setName('');
      setQuantity(0);
      setSubcategory('Snacks & Other');
      setUnit('Case');
      setCustomEmoji('');
    }
  }, [open]);

  // Get the effective emoji (custom or auto-based on category)
  const effectiveEmoji = customEmoji || CATEGORY_EMOJI[subcategory];

  const canSubmit = name.trim().length > 0;

  const handleSubmit = async () => {
    if (!canSubmit || isSubmitting) return;

    setIsSubmitting(true);
    try {
      const success = await onAdd({
        name: name.trim(),
        quantity,
        subcategory,
        unit,
        emoji: effectiveEmoji,
      });
      if (success) {
        onOpenChange(false);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl pb-8 max-h-[85vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <span className="text-2xl">{effectiveEmoji}</span>
            Add Custom Item
          </SheetTitle>
          <SheetDescription>
            Add a new item to your pantry inventory
          </SheetDescription>
        </SheetHeader>

        <div className="space-y-4 py-4">
          {/* Item name (required) */}
          <div>
            <label className="text-sm font-medium text-slate-700">
              Item Name <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g., Pinto Beans, 24/1lb"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              autoFocus
            />
          </div>

          {/* Quantity */}
          <div>
            <label className="text-sm font-medium text-slate-700">Quantity</label>
            <div className="mt-1 flex items-center gap-3">
              <button
                onClick={() => setQuantity((q) => Math.max(0, q - 1))}
                disabled={quantity <= 0}
                className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-100 transition text-lg font-bold disabled:opacity-50 disabled:cursor-not-allowed"
              >
                −
              </button>
              <input
                type="number"
                min="0"
                value={quantity}
                onChange={(e) => setQuantity(Math.max(0, parseInt(e.target.value) || 0))}
                className="w-20 text-center rounded-lg border border-slate-200 px-2 py-2 text-lg font-semibold focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              />
              <button
                onClick={() => setQuantity((q) => q + 1)}
                className="flex h-10 w-10 items-center justify-center rounded-lg border border-slate-300 text-slate-600 hover:bg-slate-100 transition text-lg font-bold"
              >
                +
              </button>
              <span className="text-sm text-slate-500 capitalize">{unit}{quantity !== 1 ? 's' : ''}</span>
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="text-sm font-medium text-slate-700">Category</label>
            <div className="mt-2 flex flex-wrap gap-2">
              {CATEGORIES.map((cat) => (
                <Chip
                  key={cat}
                  tone={subcategory === cat ? 'indigo' : 'neutral'}
                  density="compact"
                  active={subcategory === cat}
                  onClick={() => setSubcategory(cat)}
                >
                  <span>{CATEGORY_EMOJI[cat]}</span>
                  <span>{cat.split(' ')[0]}</span>
                </Chip>
              ))}
            </div>
          </div>

          {/* Unit */}
          <div>
            <label className="text-sm font-medium text-slate-700">Unit</label>
            <div className="mt-2 flex flex-wrap gap-2">
              {UNITS.map((u) => (
                <Chip
                  key={u}
                  tone={unit === u ? 'indigo' : 'neutral'}
                  density="compact"
                  active={unit === u}
                  onClick={() => setUnit(u)}
                >
                  {u}
                </Chip>
              ))}
            </div>
          </div>

          {/* Custom emoji */}
          <div>
            <label className="text-sm font-medium text-slate-700">
              Custom Emoji (optional)
            </label>
            <input
              type="text"
              placeholder={CATEGORY_EMOJI[subcategory]}
              value={customEmoji}
              onChange={(e) => setCustomEmoji(e.target.value.slice(0, 2))}
              className="mt-1 w-20 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xl text-center focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100"
            />
          </div>
        </div>

        <SheetFooter>
          <Button
            className="w-full"
            size="lg"
            onClick={handleSubmit}
            disabled={!canSubmit || isSubmitting}
          >
            {isSubmitting ? 'Adding...' : `Add ${name || 'Item'}`}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
};

export default AddCustomItemSheet;
