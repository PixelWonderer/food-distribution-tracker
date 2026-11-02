import React, { useState, useEffect, useCallback } from 'react';

import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/app/components/ui/sheet';
import { getSupabaseService } from '@/services/supabaseService';
import { useAppStore } from '@/services/state';
import { cn } from '@/lib/utils';
import { toast } from '@/lib/toast';
import type { DestinationInfo } from '@/types';

type AddCustomItemSheetProps = {
  open: boolean;
  onClose: () => void;
};

// Predefined supply items commonly needed
const PREDEFINED_SUPPLIES = [
  { name: 'Forks (box of 100)', emoji: '🍴', defaultQty: 1 },
  { name: 'Meal boxes (pack of 50)', emoji: '📦', defaultQty: 1 },
  { name: 'To-go boxes (pack of 25)', emoji: '🥡', defaultQty: 1 },
  { name: 'Napkins (pack)', emoji: '🧻', defaultQty: 1 },
  { name: 'Plates (pack of 50)', emoji: '🍽️', defaultQty: 1 },
  { name: 'Cups (pack of 50)', emoji: '🥤', defaultQty: 1 },
];

export const AddCustomItemSheet: React.FC<AddCustomItemSheetProps> = ({
  open,
  onClose,
}) => {
  const [destinations, setDestinations] = useState<DestinationInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedDestinationId, setSelectedDestinationId] = useState<string | null>(null);
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customQty, setCustomQty] = useState('1');
  const [adding, setAdding] = useState(false);
  const [recentlyAdded, setRecentlyAdded] = useState<string | null>(null);

  const volunteerName = useAppStore((s) => s.preferences.volunteerName);
  const currentWeekDate = useAppStore((s) => s.currentWeekDate);
  const fetchData = useAppStore((s) => s.fetchData);

  const fetchDestinations = useCallback(async () => {
    try {
      setLoading(true);
      const supabase = getSupabaseService();
      const data = await supabase.getActiveDestinations();
      // Transform to DestinationInfo format
      const mapped: DestinationInfo[] = data.map((d) => ({
        id: d.id,
        code: d.code,
        name: d.name,
        shortName: d.short_name,
        timing: d.timing,
        defaultTiming: d.default_timing,
        isDirect: d.is_direct ?? false,
        displayOrder: d.display_order ?? 999,
        isCustom: d.is_custom ?? false,
        isActive: d.is_active ?? true,
        createdBy: d.created_by,
      }));
      setDestinations(mapped);

      // Pre-select first custom destination if available, otherwise first destination
      const firstCustom = mapped.find(d => d.isCustom);
      if (firstCustom) {
        setSelectedDestinationId(firstCustom.id);
      } else if (mapped.length > 0) {
        setSelectedDestinationId(mapped[0].id);
      }
    } catch (error) {
      console.error('Error fetching destinations:', error);
      toast.error('Failed to load destinations');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (open) {
      fetchDestinations();
      setShowCustomForm(false);
      setCustomName('');
      setCustomQty('1');
      setRecentlyAdded(null);
    }
  }, [open, fetchDestinations]);

  const handleAddItem = async (itemName: string, quantity: number) => {
    if (!selectedDestinationId) {
      toast.error('Please select a destination');
      return;
    }

    if (!currentWeekDate) {
      toast.error('No active week - please import data first');
      return;
    }

    try {
      setAdding(true);
      const supabase = getSupabaseService();
      await supabase.addCustomItemToDestination(
        selectedDestinationId,
        itemName,
        quantity,
        currentWeekDate,
        volunteerName || undefined
      );

      const dest = destinations.find(d => d.id === selectedDestinationId);
      toast.success(`Added ${quantity}x ${itemName} to ${dest?.name || 'destination'}`);

      // Show success animation
      setRecentlyAdded(itemName);
      setTimeout(() => setRecentlyAdded(null), 1500);

      // Refresh app data to show new item
      await fetchData();
    } catch (error) {
      console.error('Error adding item:', error);
      toast.error('Failed to add item');
    } finally {
      setAdding(false);
    }
  };

  const handleAddCustomItem = async () => {
    const trimmedName = customName.trim();
    if (!trimmedName) {
      toast.error('Please enter an item name');
      return;
    }

    const qty = parseFloat(customQty) || 1;
    if (qty <= 0) {
      toast.error('Quantity must be greater than 0');
      return;
    }

    await handleAddItem(trimmedName, qty);
    setCustomName('');
    setCustomQty('1');
    setShowCustomForm(false);
  };

  const selectedDestination = destinations.find(d => d.id === selectedDestinationId);

  return (
    <Sheet open={open} onOpenChange={(next) => (!next ? onClose() : undefined)}>
      <SheetContent
        side="bottom"
        className="max-h-[85vh] gap-3 overflow-hidden rounded-t-[32px] border-border/70 bg-card p-4 shadow-[0_-28px_90px_rgba(15,23,42,0.16)]"
      >
        <SheetHeader className="gap-1">
          <div className="mx-auto h-1 w-12 rounded-full bg-muted" aria-hidden />
          <SheetTitle className="flex items-center gap-2 text-base font-semibold">
            <span className="text-xl">📦</span> Add Custom Item
          </SheetTitle>
          <SheetDescription className="text-xs">
            Add supplies or custom items to any destination
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto py-3" style={{ maxHeight: '55vh' }}>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : destinations.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-sm text-muted-foreground">
              No destinations available. Create a custom destination first.
            </div>
          ) : (
            <div className="space-y-4">
              {/* Destination Selector */}
              <div>
                <label className="mb-2 block text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Select Destination
                </label>
                <select
                  value={selectedDestinationId || ''}
                  onChange={(e) => setSelectedDestinationId(e.target.value)}
                  className={cn(
                    'h-12 w-full rounded-xl border-2 px-4 text-sm font-medium transition',
                    'bg-white focus:outline-none focus:ring-2 focus:ring-primary/50',
                    selectedDestination?.isCustom
                      ? 'border-primary/40 bg-primary/5'
                      : 'border-slate-200'
                  )}
                >
                  <option value="" disabled>Choose a destination...</option>
                  <optgroup label="Custom Destinations">
                    {destinations.filter(d => d.isCustom).map((dest) => (
                      <option key={dest.id} value={dest.id}>
                        {dest.name} {dest.timing ? `(${dest.timing})` : ''}
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Standard Destinations">
                    {destinations.filter(d => !d.isCustom).map((dest) => (
                      <option key={dest.id} value={dest.id}>
                        {dest.name} {dest.timing ? `(${dest.timing})` : ''}
                      </option>
                    ))}
                  </optgroup>
                </select>

                {selectedDestination && (
                  <div className="mt-2 flex items-center gap-2">
                    <span className="text-lg">
                      {selectedDestination.isDirect ? '🚚' : '🏠'}
                    </span>
                    <span className="text-sm font-medium text-foreground">
                      {selectedDestination.name}
                    </span>
                    {selectedDestination.isCustom && (
                      <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-primary">
                        Custom
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Quick Add: Predefined Supplies */}
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Quick Add Supplies
                </h3>
                <div className="grid grid-cols-2 gap-2">
                  {PREDEFINED_SUPPLIES.map((supply) => (
                    <Button
                      key={supply.name}
                      variant="outline"
                      disabled={adding || !selectedDestinationId}
                      onClick={() => handleAddItem(supply.name, supply.defaultQty)}
                      className={cn(
                        'h-auto flex-col items-center gap-1 rounded-xl py-3 transition-all',
                        recentlyAdded === supply.name && 'ring-2 ring-emerald-400 ring-offset-1 bg-emerald-50'
                      )}
                    >
                      <span className="text-2xl">{supply.emoji}</span>
                      <span className="text-[11px] font-medium leading-tight text-center">
                        {supply.name.split('(')[0].trim()}
                      </span>
                    </Button>
                  ))}
                </div>
              </div>

              {/* Custom Item Form */}
              {showCustomForm ? (
                <div className="rounded-2xl border-2 border-dashed border-primary/30 bg-primary/5 p-4">
                  <h3 className="mb-3 text-sm font-semibold text-primary">Add Custom Item</h3>

                  <div className="space-y-3">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-muted-foreground">
                        Item Name
                      </label>
                      <Input
                        type="text"
                        value={customName}
                        onChange={(e) => setCustomName(e.target.value)}
                        placeholder="e.g., Extra cutting boards, Serving spoons"
                        className="h-10 rounded-xl"
                        autoFocus
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-medium text-muted-foreground">
                        Quantity
                      </label>
                      <Input
                        type="number"
                        value={customQty}
                        onChange={(e) => setCustomQty(e.target.value)}
                        min="0.5"
                        step="0.5"
                        className="h-10 w-24 rounded-xl"
                      />
                    </div>

                    <div className="flex gap-2 pt-2">
                      <Button
                        onClick={handleAddCustomItem}
                        disabled={adding || !customName.trim()}
                        className="flex-1 rounded-xl"
                      >
                        {adding ? 'Adding...' : 'Add Item'}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setShowCustomForm(false);
                          setCustomName('');
                          setCustomQty('1');
                        }}
                        className="rounded-xl"
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                </div>
              ) : (
                <Button
                  variant="outline"
                  onClick={() => setShowCustomForm(true)}
                  disabled={!selectedDestinationId}
                  className="w-full gap-2 rounded-2xl border-2 border-dashed border-primary/30 bg-primary/5 py-6 text-primary hover:bg-primary/10"
                >
                  <span className="text-xl">+</span>
                  Add Custom Item
                </Button>
              )}
            </div>
          )}
        </div>

        <Button
          variant="outline"
          onClick={onClose}
          className="mt-2 h-11 w-full rounded-xl text-sm font-semibold"
        >
          Done
        </Button>
      </SheetContent>
    </Sheet>
  );
};
