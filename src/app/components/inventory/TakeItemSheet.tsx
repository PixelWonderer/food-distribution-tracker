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
import type { InventoryItem, DestinationInfo } from '@/types';
import { formatQuantity } from '@/app/utils/quantity';

type TakeItemSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  item: InventoryItem | null;
  destinations: DestinationInfo[];
  volunteerName: string;
  onTake: (itemId: string, quantity: number, destinationId?: string, destinationName?: string) => Promise<boolean>;
};

export const TakeItemSheet: React.FC<TakeItemSheetProps> = ({
  open,
  onOpenChange,
  item,
  destinations,
  volunteerName,
  onTake,
}) => {
  const [quantity, setQuantity] = useState(1);
  const [selectedDest, setSelectedDest] = useState<string | null>(null);
  const [communityMemberName, setCommunityMemberName] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Reset state when sheet opens with a new item
  useEffect(() => {
    if (open && item) {
      setQuantity(1);
      setSelectedDest(null);
      setCommunityMemberName(volunteerName || ''); // Pre-fill with stored name
    }
  }, [open, item?.id, volunteerName]);

  if (!item) return null;

  const maxQuantity = item.currentQuantity;
  const { unit: pluralizedUnit } = formatQuantity(quantity, { unit: item.unit });

  // Get active destinations for selection
  const activeDestinations = destinations.filter((d) => d.isActive !== false);

  // Get the destination name for attribution
  const getAttributionName = (): string | undefined => {
    if (selectedDest === 'community') {
      return `Community: ${communityMemberName.trim() || 'Member'}`;
    }
    const dest = activeDestinations.find((d) => d.id === selectedDest);
    return dest?.name;
  };

  const handleTake = async () => {
    if (!item || quantity <= 0 || quantity > maxQuantity) return;

    setIsSubmitting(true);
    try {
      const destId = selectedDest === 'community' ? undefined : selectedDest || undefined;
      const destName = getAttributionName();
      const success = await onTake(item.id, quantity, destId, destName);
      if (success) {
        onOpenChange(false);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl pb-8">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <span className="text-2xl">{item.emoji}</span>
            Take {item.itemName}
          </SheetTitle>
          <SheetDescription>
            {maxQuantity} {formatQuantity(maxQuantity, { unit: item.unit }).unit} available
          </SheetDescription>
        </SheetHeader>

        {/* Quantity selector */}
        <div className="flex items-center justify-center gap-6 py-6">
          <button
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            disabled={quantity <= 1 || isSubmitting}
            className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-slate-300 text-xl font-bold text-slate-600 hover:bg-slate-100 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            −
          </button>
          <div className="text-center min-w-[5rem]">
            <span className="text-4xl font-bold text-slate-800">{quantity}</span>
            <p className="text-sm text-slate-500 capitalize">{pluralizedUnit}</p>
          </div>
          <button
            onClick={() => setQuantity((q) => Math.min(maxQuantity, q + 1))}
            disabled={quantity >= maxQuantity || isSubmitting}
            className="flex h-12 w-12 items-center justify-center rounded-full border-2 border-slate-300 text-xl font-bold text-slate-600 hover:bg-slate-100 transition disabled:opacity-50 disabled:cursor-not-allowed"
          >
            +
          </button>
        </div>

        {/* Destination selector */}
        <div className="space-y-3">
          <p className="text-sm font-medium text-slate-700">Taking for:</p>
          <div className="flex flex-wrap gap-2">
            {/* Community Member option */}
            <Chip
              tone={selectedDest === 'community' ? 'indigo' : 'neutral'}
              density="compact"
              active={selectedDest === 'community'}
              onClick={() => setSelectedDest('community')}
            >
              <span>🙋</span>
              <span>Community Member</span>
            </Chip>

            {/* Destination options */}
            {activeDestinations.map((dest) => (
              <Chip
                key={dest.id}
                tone={selectedDest === dest.id ? 'indigo' : 'neutral'}
                density="compact"
                active={selectedDest === dest.id}
                onClick={() => setSelectedDest(dest.id)}
              >
                <span>{dest.name}</span>
              </Chip>
            ))}
          </div>

          {/* Community member name input (shown when Community is selected) */}
          {selectedDest === 'community' && (
            <div className="pt-2">
              <label className="text-xs text-slate-600">Your name (optional):</label>
              <input
                type="text"
                placeholder="Enter your name..."
                value={communityMemberName}
                onChange={(e) => setCommunityMemberName(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm placeholder:text-slate-400 focus:border-indigo-300 focus:outline-none focus:ring-2 focus:ring-indigo-100"
              />
            </div>
          )}

          {!selectedDest && (
            <p className="text-xs text-amber-600">Select who this is for</p>
          )}
        </div>

        <SheetFooter>
          <Button
            className="w-full"
            size="lg"
            onClick={handleTake}
            disabled={isSubmitting || !selectedDest || quantity <= 0}
          >
            {isSubmitting ? 'Taking...' : `Take ${quantity} ${pluralizedUnit}`}
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
};

export default TakeItemSheet;
