import React, { useEffect, useState, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { getSupabaseService } from '@/services/supabaseService';
import { toast } from '@/lib/toast';
import { useAppStore } from '@/services/state';
import { Button } from '@/app/components/ui/button';

type Destination = {
  id: string;
  code: string;
  name: string;
  timing: string | null;
  default_timing: string | null;
  is_direct: boolean;
  display_order: number;
  is_custom?: boolean;
  is_active?: boolean;
};

const TIMING_OPTIONS = [
  { value: 'Friday AM', label: 'Fri. AM', day: 'Friday' },
  { value: 'Friday noon', label: 'Fri. Noon', day: 'Friday' },
  { value: 'Friday PM', label: 'Fri. PM', day: 'Friday' },
  { value: 'Saturday AM', label: 'Sat. AM', day: 'Saturday' },
  { value: 'Saturday noon', label: 'Sat. Noon', day: 'Saturday' },
  { value: 'Saturday PM', label: 'Sat. PM', day: 'Saturday' },
  { value: 'Sunday', label: 'Sunday', day: 'Sunday' },
];

const TIMING_COLORS: Record<string, string> = {
  'friday am': 'bg-blue-100 text-blue-700 border-blue-200',
  'friday noon': 'bg-indigo-100 text-indigo-700 border-indigo-200',
  'friday pm': 'bg-indigo-100 text-indigo-700 border-indigo-200',
  'saturday am': 'bg-teal-100 text-teal-700 border-teal-200',
  'saturday noon': 'bg-emerald-100 text-emerald-700 border-emerald-200',
  'saturday pm': 'bg-amber-100 text-amber-700 border-amber-200',
  'sunday': 'bg-rose-100 text-rose-700 border-rose-200',
};

const getTimingColorClass = (timing: string | null): string => {
  if (!timing) return 'bg-slate-100 text-slate-600 border-slate-200';
  return TIMING_COLORS[timing.toLowerCase()] || 'bg-slate-100 text-slate-600 border-slate-200';
};

export const DestinationManagementView: React.FC = () => {
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkTimingOpen, setBulkTimingOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState<number>(0);
  const [savingId, setSavingId] = useState<string | null>(null);

  const volunteerName = useAppStore((s) => s.preferences.volunteerName);

  const fetchDestinations = useCallback(async () => {
    try {
      setLoading(true);
      const supabase = getSupabaseService();
      const data = await supabase.getDestinations();
      const sorted = (data as Destination[])
        .filter((d) => d.is_active !== false)
        .sort((a, b) => (a.display_order || 0) - (b.display_order || 0));
      setDestinations(sorted);
    } catch (error) {
      console.error('Error fetching destinations:', error);
      toast.error('Failed to load destinations');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDestinations();
  }, [fetchDestinations]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) {
        return;
      }

      switch (e.key) {
        case 'j':
        case 'ArrowDown':
          e.preventDefault();
          setFocusedIndex((prev) => Math.min(prev + 1, destinations.length - 1));
          break;
        case 'k':
        case 'ArrowUp':
          e.preventDefault();
          setFocusedIndex((prev) => Math.max(prev - 1, 0));
          break;
        case 'x':
        case ' ':
          e.preventDefault();
          if (destinations[focusedIndex]) {
            toggleSelection(destinations[focusedIndex].id);
          }
          break;
        case 'a':
          if (e.shiftKey) {
            e.preventDefault();
            if (selectedIds.size === destinations.length) {
              setSelectedIds(new Set());
            } else {
              setSelectedIds(new Set(destinations.map((d) => d.id)));
            }
          }
          break;
        case 'Escape':
          e.preventDefault();
          setSelectedIds(new Set());
          break;
        case 'b':
          if (selectedIds.size > 0) {
            e.preventDefault();
            setBulkTimingOpen(true);
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [destinations, focusedIndex, selectedIds]);

  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleTimingChange = async (destId: string, newTiming: string) => {
    const dest = destinations.find((d) => d.id === destId);
    if (!dest) return;

    // Optimistic update
    setDestinations((prev) =>
      prev.map((d) => (d.id === destId ? { ...d, timing: newTiming } : d))
    );
    setSavingId(destId);

    try {
      const supabase = getSupabaseService();
      await supabase.updateDestinationTiming(destId, newTiming, volunteerName || undefined);
      toast.success(`${dest.name} → ${newTiming}`);
    } catch (error) {
      console.error('Error updating timing:', error);
      toast.error('Failed to update timing');
      fetchDestinations();
    } finally {
      setSavingId(null);
    }
  };

  const handleBulkTimingUpdate = async (newTiming: string) => {
    if (selectedIds.size === 0) return;

    const selectedDests = destinations.filter((d) => selectedIds.has(d.id));

    // Optimistic update
    setDestinations((prev) =>
      prev.map((d) => (selectedIds.has(d.id) ? { ...d, timing: newTiming } : d))
    );
    setBulkTimingOpen(false);

    try {
      const supabase = getSupabaseService();
      // Update each destination (could be optimized with bulk RPC later)
      await Promise.all(
        selectedDests.map((dest) =>
          supabase.updateDestinationTiming(dest.id, newTiming, volunteerName || undefined)
        )
      );
      toast.success(`Updated ${selectedIds.size} destinations to ${newTiming}`);
      setSelectedIds(new Set());
    } catch (error) {
      console.error('Error bulk updating:', error);
      toast.error('Some updates failed');
      fetchDestinations();
    }
  };

  const selectedCount = selectedIds.size;
  const allSelected = selectedCount === destinations.length && destinations.length > 0;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between bg-white rounded-xl border border-slate-200 px-4 py-3">
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={allSelected}
              onChange={() => {
                if (allSelected) {
                  setSelectedIds(new Set());
                } else {
                  setSelectedIds(new Set(destinations.map((d) => d.id)));
                }
              }}
              className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
            />
            <span className="text-sm text-slate-600">
              {selectedCount > 0
                ? `${selectedCount} selected`
                : 'Select all'}
            </span>
          </label>

          {selectedCount > 0 && (
            <Button
              size="sm"
              onClick={() => setBulkTimingOpen(true)}
              className="gap-2"
            >
              <span>📅</span>
              Bulk Update Timing
              <kbd className="ml-1 px-1.5 py-0.5 bg-emerald-700 rounded text-[10px]">B</kbd>
            </Button>
          )}
        </div>

        <div className="flex items-center gap-2 text-xs text-slate-500">
          <span>Navigate:</span>
          <kbd className="px-1.5 py-0.5 bg-slate-100 rounded">j</kbd>
          <kbd className="px-1.5 py-0.5 bg-slate-100 rounded">k</kbd>
          <span className="mx-2">|</span>
          <span>Toggle:</span>
          <kbd className="px-1.5 py-0.5 bg-slate-100 rounded">x</kbd>
          <span className="mx-2">|</span>
          <span>Select all:</span>
          <kbd className="px-1.5 py-0.5 bg-slate-100 rounded">⇧A</kbd>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-50 border-b border-slate-200">
              <th className="w-12 px-4 py-3"></th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">
                Destination
              </th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">
                Type
              </th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">
                Current Timing
              </th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700">
                Change To
              </th>
            </tr>
          </thead>
          <tbody>
            {destinations.map((dest, idx) => {
              const isSelected = selectedIds.has(dest.id);
              const isFocused = focusedIndex === idx;
              const isSaving = savingId === dest.id;

              return (
                <tr
                  key={dest.id}
                  className={cn(
                    'border-b border-slate-100 transition-colors',
                    isFocused && 'bg-emerald-50',
                    isSelected && !isFocused && 'bg-blue-50',
                    !isFocused && !isSelected && (idx % 2 === 0 ? 'bg-white' : 'bg-slate-25'),
                    isSaving && 'opacity-70'
                  )}
                  onClick={() => setFocusedIndex(idx)}
                >
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => toggleSelection(dest.id)}
                      className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
                    />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">{dest.is_direct ? '🚚' : '🏠'}</span>
                      <div>
                        <div className="font-medium text-slate-900">{dest.name}</div>
                        <div className="text-xs text-slate-500">{dest.code}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        'inline-flex px-2 py-1 rounded-full text-xs font-medium',
                        dest.is_direct
                          ? 'bg-purple-100 text-purple-700'
                          : 'bg-slate-100 text-slate-600'
                      )}
                    >
                      {dest.is_direct ? 'Direct' : 'Storage'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        'inline-flex px-3 py-1.5 rounded-lg text-sm font-semibold border',
                        getTimingColorClass(dest.timing)
                      )}
                    >
                      {dest.timing || 'Not set'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value=""
                      onChange={(e) => {
                        if (e.target.value) {
                          handleTimingChange(dest.id, e.target.value);
                        }
                      }}
                      disabled={isSaving}
                      className={cn(
                        'h-9 px-3 pr-8 rounded-lg border border-slate-200 text-sm',
                        'bg-white hover:border-slate-300 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500',
                        'cursor-pointer appearance-none',
                        'bg-[length:12px] bg-[right_8px_center] bg-no-repeat',
                        isSaving && 'cursor-wait opacity-70'
                      )}
                      style={{
                        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3E%3C/svg%3E")`,
                      }}
                    >
                      <option value="">Change timing...</option>
                      <optgroup label="Friday">
                        <option value="Friday AM">Fri. AM</option>
                        <option value="Friday noon">Fri. Noon</option>
                        <option value="Friday PM">Fri. PM</option>
                      </optgroup>
                      <optgroup label="Saturday">
                        <option value="Saturday AM">Sat. AM</option>
                        <option value="Saturday noon">Sat. Noon</option>
                        <option value="Saturday PM">Sat. PM</option>
                      </optgroup>
                      <optgroup label="Sunday">
                        <option value="Sunday">Sunday</option>
                      </optgroup>
                    </select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Bulk Timing Modal */}
      {bulkTimingOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full mx-4 p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-2">
              Bulk Update Timing
            </h3>
            <p className="text-sm text-slate-600 mb-4">
              Set the same timing for {selectedCount} selected destination
              {selectedCount !== 1 && 's'}.
            </p>

            <div className="grid grid-cols-2 gap-2 mb-6">
              {TIMING_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  onClick={() => handleBulkTimingUpdate(opt.value)}
                  className={cn(
                    'px-4 py-3 rounded-xl border-2 text-sm font-semibold transition-all',
                    'hover:scale-[1.02] active:scale-[0.98]',
                    getTimingColorClass(opt.value)
                  )}
                >
                  {opt.label}
                </button>
              ))}
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setBulkTimingOpen(false)}>
                Cancel
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default DestinationManagementView;
