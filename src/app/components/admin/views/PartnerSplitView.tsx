import React, { useEffect, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { getSupabaseService } from '@/services/supabaseService';
import { toast } from '@/lib/toast';
import { useAppStore } from '@/services/state';
import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { getEmojiForItem } from '@/utils/helpers';

type Allocation = {
  id: string;
  order_id: string;
  item_name: string;
  emoji: string;
  allocated_quantity: number;
  effective_quantity: number;
  storage_type: string | null;
  unit: string | null;
};

type Recipient = 'Friday' | 'Saturday' | 'Sunday' | 'Partner 11' | 'Partner 10';
type RecipientType = 'day' | 'destination';

type RecipientSplit = {
  recipient: Recipient;
  quantity: number;
  recipientType: RecipientType;
};

type AllocationWithSplit = Allocation & {
  splits: RecipientSplit[];
  isEditing?: boolean;
};

// All recipients in display order
const RECIPIENTS: Recipient[] = ['Friday', 'Saturday', 'Sunday', 'Partner 11', 'Partner 10'];

// Recipient configuration
const RECIPIENT_CONFIG: Record<Recipient, { type: RecipientType; color: string; headerColor: string }> = {
  Friday: {
    type: 'day',
    color: 'bg-indigo-100 text-indigo-700 border-indigo-200',
    headerColor: 'bg-indigo-100 text-indigo-700',
  },
  Saturday: {
    type: 'day',
    color: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    headerColor: 'bg-emerald-100 text-emerald-700',
  },
  Sunday: {
    type: 'day',
    color: 'bg-rose-100 text-rose-700 border-rose-200',
    headerColor: 'bg-rose-100 text-rose-700',
  },
  'Partner 11': {
    type: 'destination',
    color: 'bg-amber-100 text-amber-700 border-amber-200',
    headerColor: 'bg-amber-100 text-amber-700',
  },
  'Partner 10': {
    type: 'destination',
    color: 'bg-purple-100 text-purple-700 border-purple-200',
    headerColor: 'bg-purple-100 text-purple-700',
  },
};

// Helper to parse case size from unit string (e.g., "50lb case" -> 50)
const parseCaseSize = (unit: string | null): number | null => {
  if (!unit) return null;
  const match = unit.match(/(\d+)\s*lb/i);
  return match ? parseInt(match[1], 10) : null;
};

// Helper to format quantity with pound equivalent for destination splits
const formatQuantityWithPounds = (
  quantity: number,
  unit: string | null,
  recipientType: RecipientType
): string => {
  if (recipientType !== 'destination' || quantity === 0) return String(quantity);
  const caseSize = parseCaseSize(unit);
  if (!caseSize) return String(quantity);
  const pounds = Math.round(quantity * caseSize);
  return `${quantity} (${pounds}lb)`;
};

// Day-only recipients for bulk move
const DAY_RECIPIENTS: Recipient[] = ['Friday', 'Saturday', 'Sunday'];

export const PartnerSplitView: React.FC = () => {
  const [allocations, setAllocations] = useState<AllocationWithSplit[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editSplits, setEditSplits] = useState<RecipientSplit[]>(
    RECIPIENTS.map((r) => ({ recipient: r, quantity: 0, recipientType: RECIPIENT_CONFIG[r].type }))
  );
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkMoving, setBulkMoving] = useState(false);

  const volunteerName = useAppStore((s) => s.preferences.volunteerName);

  const fetchAllocations = useCallback(async () => {
    try {
      setLoading(true);
      const supabase = getSupabaseService();

      // Get Partner Group 6 destination
      const destinations = await supabase.getDestinations();
      const partner_6 = (destinations as any[]).find(
        (d) => d.code?.toLowerCase() === 'partner_6' || d.name?.toLowerCase().includes('partner_6')
      );

      if (!partner_6) {
        toast.error('Partner Group 6 destination not found');
        setAllocations([]);
        return;
      }

      // Get allocations for Partner Group 6 (include confirmation fields)
      const client = supabase.getClient();
      const { data: allocData, error } = await client
        .from('allocations')
        .select(`
          id,
          order_id,
          allocated_quantity,
          received_quantity,
          is_confirmed,
          orders!inner(item_name, storage_type, unit, ran_out)
        `)
        .eq('destination_id', partner_6.id)
        .gt('allocated_quantity', 0);

      if (error) throw error;

      // Get any existing splits (using new column name 'recipient')
      const { data: splitsData } = await (client as any)
        .from('allocation_day_splits')
        .select('allocation_id, recipient, quantity, recipient_type');

      const splitsMap = new Map<string, RecipientSplit[]>();
      if (splitsData) {
        splitsData.forEach((s: any) => {
          const existing = splitsMap.get(s.allocation_id) || [];
          existing.push({
            recipient: s.recipient as Recipient,
            quantity: s.quantity,
            recipientType: s.recipient_type || 'day',
          });
          splitsMap.set(s.allocation_id, existing);
        });
      }

      const items: AllocationWithSplit[] = (allocData || [])
        // Filter out items that ran out — nothing to split
        .filter((a: any) => !a.orders.ran_out)
        .map((a: any) => {
          // Use received_quantity for confirmed items (handles Ran Low),
          // fall back to allocated_quantity for unconfirmed items
          const effectiveQty = a.is_confirmed && a.received_quantity != null
            ? Number(a.received_quantity)
            : Number(a.allocated_quantity);
          return {
            id: a.id,
            order_id: a.order_id,
            item_name: a.orders.item_name,
            emoji: getEmojiForItem(a.orders.item_name),
            allocated_quantity: a.allocated_quantity,
            effective_quantity: effectiveQty,
            storage_type: a.orders.storage_type,
            unit: a.orders.unit,
            splits: splitsMap.get(a.id) || [],
          };
        })
        // Also filter out items where effective quantity is 0 (edge case)
        .filter((a) => a.effective_quantity > 0);

      // Sort by name
      items.sort((a, b) => a.item_name.localeCompare(b.item_name));
      setAllocations(items);
    } catch (error) {
      console.error('Error fetching allocations:', error);
      toast.error('Failed to load Partner Group 6 items');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAllocations();
  }, [fetchAllocations]);

  const startEditing = (alloc: AllocationWithSplit) => {
    setEditingId(alloc.id);
    // Initialize with existing splits or default distribution
    if (alloc.splits.length > 0) {
      const splitMap = new Map(alloc.splits.map((s) => [s.recipient, s.quantity]));
      setEditSplits(
        RECIPIENTS.map((r) => ({
          recipient: r,
          quantity: splitMap.get(r) || 0,
          recipientType: RECIPIENT_CONFIG[r].type,
        }))
      );
    } else {
      // Default: all on Saturday (current Partner Group 6 timing)
      setEditSplits(
        RECIPIENTS.map((r) => ({
          recipient: r,
          quantity: r === 'Saturday' ? alloc.effective_quantity : 0,
          recipientType: RECIPIENT_CONFIG[r].type,
        }))
      );
    }
  };

  const cancelEditing = () => {
    setEditingId(null);
    setEditSplits(
      RECIPIENTS.map((r) => ({ recipient: r, quantity: 0, recipientType: RECIPIENT_CONFIG[r].type }))
    );
  };

  const updateSplitQuantity = (recipient: Recipient, value: number) => {
    setEditSplits((prev) =>
      prev.map((s) => (s.recipient === recipient ? { ...s, quantity: Math.max(0, value) } : s))
    );
  };

  const saveSplit = async () => {
    if (!editingId) return;

    const alloc = allocations.find((a) => a.id === editingId);
    if (!alloc) return;

    const totalSplit = editSplits.reduce((sum, s) => sum + s.quantity, 0);
    if (totalSplit !== alloc.effective_quantity) {
      toast.error(`Split total (${totalSplit}) must equal allocation (${alloc.effective_quantity})`);
      return;
    }

    // Filter out zero quantities
    const nonZeroSplits = editSplits.filter((s) => s.quantity > 0);

    try {
      const supabase = getSupabaseService();
      const client = supabase.getClient();

      // Use RPC to save splits - it handles recipient_destination_id lookup
      const { error: rpcError } = await (client as any).rpc('set_allocation_day_splits', {
        p_allocation_id: editingId,
        p_splits: nonZeroSplits.map((s) => ({
          recipient: s.recipient,
          quantity: s.quantity,
          recipientType: s.recipientType,
        })),
        p_split_by: volunteerName,
      });

      if (rpcError) throw rpcError;

      // Always sync destination allocations — this upserts active splits
      // AND cleans up orphaned Partner 11/Partner 10 allocations for removed destinations
      const { error: syncError } = await (client as any).rpc('sync_splits_to_destination_allocations', {
        p_allocation_id: editingId,
      });
      if (syncError) {
        console.error('Sync error (non-fatal):', syncError);
      }

      // Update local state
      setAllocations((prev) =>
        prev.map((a) =>
          a.id === editingId ? { ...a, splits: nonZeroSplits } : a
        )
      );

      toast.success(`Split saved for ${alloc.item_name}`);
      cancelEditing();
    } catch (error) {
      console.error('Error saving split:', error);
      toast.error('Failed to save split');
    }
  };

  const clearSplit = async (allocId: string) => {
    const alloc = allocations.find((a) => a.id === allocId);
    if (!alloc) return;

    try {
      const supabase = getSupabaseService();
      const client = supabase.getClient();

      // Delete all splits for this allocation
      await (client as any)
        .from('allocation_day_splits')
        .delete()
        .eq('allocation_id', allocId);

      // Sync to clean up orphaned Partner 11/Partner 10 destination allocations
      // With no splits remaining, sync will delete all custom-destination allocations
      await (client as any).rpc('sync_splits_to_destination_allocations', {
        p_allocation_id: allocId,
      });

      setAllocations((prev) =>
        prev.map((a) => (a.id === allocId ? { ...a, splits: [] } : a))
      );

      toast.success(`Cleared split for ${alloc.item_name}`);
    } catch (error) {
      console.error('Error clearing split:', error);
      toast.error('Failed to clear split');
    }
  };

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === allocations.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(allocations.map((a) => a.id)));
    }
  };

  const bulkMoveTo = async (targetDay: Recipient) => {
    if (selectedIds.size === 0) return;
    setBulkMoving(true);

    try {
      const supabase = getSupabaseService();
      const client = supabase.getClient();
      let movedCount = 0;

      for (const allocId of selectedIds) {
        const alloc = allocations.find((a) => a.id === allocId);
        if (!alloc) continue;

        // Preserve existing destination splits (Partner 11/Partner 10), move day portion to target
        const destSplits = alloc.splits.filter((s) => s.recipientType === 'destination');
        const destTotal = destSplits.reduce((sum, s) => sum + s.quantity, 0);
        const dayPortion = alloc.effective_quantity - destTotal;

        if (dayPortion <= 0) continue; // Nothing to move (all goes to destinations)

        const newSplits = [
          ...destSplits.map((s) => ({
            recipient: s.recipient,
            quantity: s.quantity,
            recipientType: s.recipientType,
          })),
          { recipient: targetDay, quantity: dayPortion, recipientType: 'day' as RecipientType },
        ];

        const { error: rpcError } = await (client as any).rpc('set_allocation_day_splits', {
          p_allocation_id: allocId,
          p_splits: newSplits,
          p_split_by: volunteerName,
        });

        if (rpcError) {
          console.error(`Error moving ${alloc.item_name}:`, rpcError);
          continue;
        }

        // Sync destination allocations
        await (client as any).rpc('sync_splits_to_destination_allocations', {
          p_allocation_id: allocId,
        });

        movedCount++;
      }

      if (movedCount > 0) {
        toast.success(`Moved ${movedCount} item${movedCount > 1 ? 's' : ''} to ${targetDay}`);
        setSelectedIds(new Set());
        await fetchAllocations(); // Refresh data
      }
    } catch (error) {
      console.error('Bulk move error:', error);
      toast.error('Failed to move items');
    } finally {
      setBulkMoving(false);
    }
  };

  const editingAlloc = editingId ? allocations.find((a) => a.id === editingId) : null;
  const totalSplit = editSplits.reduce((sum, s) => sum + s.quantity, 0);
  const isValidSplit = editingAlloc && totalSplit === editingAlloc.effective_quantity;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Info card */}
      <div className="bg-gradient-to-br from-emerald-50 to-teal-50 rounded-xl border border-emerald-200 p-4">
        <h3 className="font-semibold text-emerald-900 flex items-center gap-2">
          <span>📦</span> Partner Distribution
        </h3>
        <p className="text-sm text-emerald-800 mt-1">
          Split Partner Group 6 items to different recipients. Days (Fri/Sat/Sun) stay with Partner Group 6.
          Partner 11 and Partner 10 get separate allocations for their pickup schedules.
        </p>
      </div>

      {allocations.length === 0 ? (
        <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
          <span className="text-4xl block mb-4">📭</span>
          <h3 className="text-lg font-semibold text-slate-900 mb-2">No Partner Group 6 Items</h3>
          <p className="text-slate-600">
            There are no items allocated to Partner Group 6 this week.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
          {/* Bulk action bar */}
          {selectedIds.size > 0 && (
            <div className="sticky top-0 z-10 bg-indigo-50 border-b border-indigo-200 px-4 py-2 flex items-center gap-3">
              <span className="text-sm font-medium text-indigo-800">
                {selectedIds.size} selected
              </span>
              <span className="text-sm text-indigo-600">Move to:</span>
              {DAY_RECIPIENTS.map((day) => (
                <Button
                  key={day}
                  size="sm"
                  variant="outline"
                  disabled={bulkMoving}
                  onClick={() => bulkMoveTo(day)}
                  className={cn('text-xs', RECIPIENT_CONFIG[day].color)}
                >
                  {day}
                </Button>
              ))}
              <Button
                size="sm"
                variant="ghost"
                onClick={() => setSelectedIds(new Set())}
                className="ml-auto text-xs text-slate-500"
              >
                Clear
              </Button>
            </div>
          )}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200">
                  <th className="pl-3 pr-1 py-3 w-8">
                    <input
                      type="checkbox"
                      checked={selectedIds.size === allocations.length && allocations.length > 0}
                      onChange={toggleSelectAll}
                      className="rounded border-slate-300"
                    />
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700 min-w-[200px]">
                    Item
                  </th>
                  <th className="px-2 py-3 text-center text-sm font-semibold text-slate-700 w-16">
                    Total
                  </th>
                  {RECIPIENTS.map((recipient) => (
                    <th key={recipient} className="px-2 py-3 text-center text-sm font-semibold text-slate-700 w-20">
                      <span className={cn('px-2 py-1 rounded text-xs', RECIPIENT_CONFIG[recipient].headerColor)}>
                        {recipient}
                      </span>
                    </th>
                  ))}
                  <th className="px-4 py-3 text-right text-sm font-semibold text-slate-700 w-28">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {allocations.map((alloc, idx) => {
                  const splitMap = new Map(alloc.splits.map((s) => [s.recipient, s]));
                  const hasSplit = alloc.splits.length > 0;
                  const isEditing = editingId === alloc.id;
                  const splitTotal = alloc.splits.reduce((s, sp) => s + sp.quantity, 0);
                  const isStaleSplit = hasSplit && splitTotal > alloc.effective_quantity;

                  return (
                    <tr
                      key={alloc.id}
                      className={cn(
                        'border-b border-slate-100 transition-colors',
                        isEditing && 'bg-amber-50',
                        !isEditing && (idx % 2 === 0 ? 'bg-white' : 'bg-slate-25')
                      )}
                    >
                      <td className="pl-3 pr-1 py-3">
                        <input
                          type="checkbox"
                          checked={selectedIds.has(alloc.id)}
                          onChange={() => toggleSelected(alloc.id)}
                          className="rounded border-slate-300"
                        />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">{alloc.emoji}</span>
                          <div>
                            <div className="font-medium text-slate-900 text-sm">{alloc.item_name}</div>
                            <div className="text-xs text-slate-500">
                              {alloc.unit || 'units'}
                            </div>
                            {isStaleSplit && (
                              <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-1.5 py-0.5 mt-1">
                                Split outdated — qty reduced to {alloc.effective_quantity}
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-2 py-3 text-center">
                        <span className="font-bold text-slate-900">{alloc.effective_quantity}</span>
                        {alloc.effective_quantity < alloc.allocated_quantity && (
                          <div className="text-[10px] text-amber-600 line-through">{alloc.allocated_quantity}</div>
                        )}
                      </td>

                      {isEditing ? (
                        <>
                          {RECIPIENTS.map((recipient) => {
                            const split = editSplits.find((s) => s.recipient === recipient);
                            const config = RECIPIENT_CONFIG[recipient];
                            const caseSize = parseCaseSize(alloc.unit);
                            const showPoundHelper = config.type === 'destination' && caseSize;
                            const poundValue = split?.quantity ? Math.round(split.quantity * (caseSize || 1)) : 0;

                            return (
                              <td key={recipient} className="px-2 py-3 text-center">
                                <div className="flex flex-col items-center gap-1">
                                  <Input
                                    type="number"
                                    min="0"
                                    step="0.01"
                                    max={alloc.effective_quantity}
                                    value={split?.quantity || 0}
                                    onChange={(e) =>
                                      updateSplitQuantity(recipient, parseFloat(e.target.value) || 0)
                                    }
                                    className="w-16 text-center mx-auto text-sm"
                                  />
                                  {showPoundHelper && (
                                    <div className="flex items-center gap-1">
                                      <input
                                        type="number"
                                        min="0"
                                        step="1"
                                        value={poundValue}
                                        onChange={(e) => {
                                          const lbs = parseInt(e.target.value) || 0;
                                          const cases = Math.round((lbs / caseSize!) * 100) / 100;
                                          updateSplitQuantity(recipient, cases);
                                        }}
                                        className="w-12 text-center text-[10px] px-1 py-0.5 border border-slate-200 rounded"
                                        placeholder="lb"
                                      />
                                      <span className="text-[10px] text-slate-500">lb</span>
                                    </div>
                                  )}
                                </div>
                              </td>
                            );
                          })}
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button
                                size="sm"
                                onClick={saveSplit}
                                disabled={!isValidSplit}
                                className={cn('text-xs', !isValidSplit && 'opacity-50 cursor-not-allowed')}
                              >
                                Save
                              </Button>
                              <Button size="sm" variant="ghost" onClick={cancelEditing} className="text-xs">
                                ✕
                              </Button>
                            </div>
                            {!isValidSplit && editingAlloc && (
                              <div className="text-xs text-red-600 mt-1">
                                {totalSplit}/{editingAlloc.effective_quantity}
                              </div>
                            )}
                          </td>
                        </>
                      ) : (
                        <>
                          {RECIPIENTS.map((recipient) => {
                            const split = splitMap.get(recipient);
                            const qty = split?.quantity || 0;
                            const config = RECIPIENT_CONFIG[recipient];
                            return (
                              <td key={recipient} className="px-2 py-3 text-center">
                                {hasSplit ? (
                                  qty > 0 ? (
                                    <span
                                      className={cn(
                                        'inline-flex px-2 py-0.5 rounded text-xs font-semibold',
                                        config.color
                                      )}
                                      title={config.type === 'destination' ? formatQuantityWithPounds(qty, alloc.unit, config.type) : undefined}
                                    >
                                      {config.type === 'destination'
                                        ? formatQuantityWithPounds(qty, alloc.unit, config.type)
                                        : qty}
                                    </span>
                                  ) : (
                                    <span className="text-slate-300">—</span>
                                  )
                                ) : recipient === 'Saturday' ? (
                                  <span className="text-slate-400 text-xs">
                                    ({alloc.effective_quantity})
                                  </span>
                                ) : (
                                  <span className="text-slate-300">—</span>
                                )}
                              </td>
                            );
                          })}
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <Button size="sm" variant="outline" onClick={() => startEditing(alloc)} className="text-xs">
                                {hasSplit ? 'Edit' : 'Split'}
                              </Button>
                              {hasSplit && (
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="text-red-600 hover:text-red-700 hover:bg-red-50 text-xs"
                                  onClick={() => clearSplit(alloc.id)}
                                >
                                  ✕
                                </Button>
                              )}
                            </div>
                          </td>
                        </>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Summary stats - 5 recipients */}
      {allocations.length > 0 && (
        <div className="grid grid-cols-5 gap-3">
          {RECIPIENTS.map((recipient) => {
            const config = RECIPIENT_CONFIG[recipient];
            const totalForRecipient = allocations.reduce((sum, a) => {
              const split = a.splits.find((s) => s.recipient === recipient);
              if (split) return sum + split.quantity;
              // If no split, Saturday gets all
              if (recipient === 'Saturday' && a.splits.length === 0) return sum + a.effective_quantity;
              return sum;
            }, 0);

            const itemCount = allocations.filter((a) => {
              const split = a.splits.find((s) => s.recipient === recipient);
              if (split && split.quantity > 0) return true;
              if (recipient === 'Saturday' && a.splits.length === 0) return true;
              return false;
            }).length;

            return (
              <div
                key={recipient}
                className={cn(
                  'rounded-xl border p-3',
                  config.color
                )}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-semibold text-sm">{recipient}</span>
                  {config.type === 'destination' && (
                    <span className="text-[10px] opacity-60">
                      {recipient === 'Partner 11' ? 'Mon AM' : 'Fri AM'}
                    </span>
                  )}
                </div>
                <div className="text-xl font-bold">{totalForRecipient}</div>
                <div className="text-[10px] opacity-70">{itemCount} items</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};

export default PartnerSplitView;
