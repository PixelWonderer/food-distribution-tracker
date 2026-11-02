import React, { useState, useEffect, useCallback } from 'react';

import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription, SheetFooter } from '@/app/components/ui/sheet';
import { getSupabaseService } from '@/services/supabaseService';
import { useAppStore } from '@/services/state';
import { cn } from '@/lib/utils';
import { toast } from '@/lib/toast';

type Destination = {
  id: string;
  code: string;
  name: string;
  timing: string | null;
  default_timing: string | null;
  is_direct: boolean;
  display_order: number;
};

type ScheduleManagementSheetProps = {
  open: boolean;
  onClose: () => void;
  onOpenHistory: () => void;
};

// Color classes for timing badges (matching PickupView.tsx)
const TIMING_COLORS: Record<string, string> = {
  'friday am': 'border-blue-200 bg-blue-50 text-blue-700',
  'friday noon': 'border-indigo-200 bg-indigo-50 text-indigo-700',
  'friday pm': 'border-indigo-200 bg-indigo-50 text-indigo-700',
  'saturday am': 'border-teal-200 bg-teal-50 text-teal-700',
  'saturday noon': 'border-emerald-200 bg-emerald-50 text-emerald-700',
  'saturday pm': 'border-amber-200 bg-amber-50 text-amber-700',
  'sunday': 'border-rose-200 bg-rose-50 text-rose-700',
};

const getTimingColor = (timing: string | null) => {
  if (!timing) return 'border-slate-200 bg-slate-50 text-slate-600';
  const key = timing.toLowerCase();
  return TIMING_COLORS[key] ?? 'border-slate-200 bg-slate-50 text-slate-600';
};


export const ScheduleManagementSheet: React.FC<ScheduleManagementSheetProps> = ({
  open,
  onClose,
  onOpenHistory,
}) => {
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [customTiming, setCustomTiming] = useState('');
  const [savingId, setSavingId] = useState<string | null>(null);
  const [recentlySaved, setRecentlySaved] = useState<string | null>(null);

  const volunteerName = useAppStore((s) => s.preferences.volunteerName);

  const fetchDestinations = useCallback(async () => {
    try {
      setLoading(true);
      const supabase = getSupabaseService();
      const data = await supabase.getDestinations();
      setDestinations(data as Destination[]);
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
    }
  }, [open, fetchDestinations]);

  const handleTimingChange = async (destId: string, newTiming: string) => {
    if (newTiming === 'custom') {
      setEditingId(destId);
      setCustomTiming('');
      return;
    }

    try {
      setSavingId(destId);
      const supabase = getSupabaseService();
      await supabase.updateDestinationTiming(destId, newTiming, volunteerName || undefined);

      // Update local state
      setDestinations(prev =>
        prev.map(d => d.id === destId ? { ...d, timing: newTiming } : d)
      );

      // Show success animation
      setRecentlySaved(destId);
      setTimeout(() => setRecentlySaved(null), 1500);

      toast.success('Schedule updated!');
    } catch (error) {
      console.error('Error updating timing:', error);
      toast.error('Failed to update schedule');
    } finally {
      setSavingId(null);
    }
  };

  const handleCustomTimingSave = async (destId: string) => {
    if (!customTiming.trim()) {
      toast.error('Please enter a timing');
      return;
    }

    await handleTimingChange(destId, customTiming.trim());
    setEditingId(null);
    setCustomTiming('');
  };

  const handleResetToDefaults = async () => {
    if (!window.confirm('Reset all schedules to their default values?')) {
      return;
    }

    try {
      setLoading(true);
      const supabase = getSupabaseService();
      await supabase.resetDestinationTimings();
      await fetchDestinations();
      toast.success('Schedules reset to defaults');
    } catch (error) {
      console.error('Error resetting timings:', error);
      toast.error('Failed to reset schedules');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Sheet open={open} onOpenChange={(next) => (!next ? onClose() : undefined)}>
      <SheetContent
        side="bottom"
        className="max-h-[85vh] gap-3 overflow-hidden rounded-t-[32px] border-border/70 bg-card p-4 shadow-[0_-28px_90px_rgba(15,23,42,0.16)]"
      >
        <SheetHeader className="gap-1">
          <div className="mx-auto h-1 w-12 rounded-full bg-muted" aria-hidden />
          <SheetTitle className="flex items-center gap-2 text-base font-semibold">
            <span className="text-xl">📅</span> Manage Delivery Schedule
          </SheetTitle>
          <SheetDescription className="text-xs">
            Tap any destination to change its delivery time
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto py-3" style={{ maxHeight: '50vh' }}>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : (
            <div className="space-y-2">
              {destinations.map((dest) => (
                <DestinationRow
                  key={dest.id}
                  destination={dest}
                  isEditing={editingId === dest.id}
                  isSaving={savingId === dest.id}
                  recentlySaved={recentlySaved === dest.id}
                  customTiming={customTiming}
                  onTimingChange={(timing) => handleTimingChange(dest.id, timing)}
                  onCustomTimingChange={setCustomTiming}
                  onCustomTimingSave={() => handleCustomTimingSave(dest.id)}
                  onCancelEdit={() => {
                    setEditingId(null);
                    setCustomTiming('');
                  }}
                />
              ))}
            </div>
          )}
        </div>

        <SheetFooter className="flex-row gap-2 border-t border-border/60 pt-4">
          <Button
            variant="outline"
            onClick={onOpenHistory}
            className="flex-1 gap-2 rounded-xl"
          >
            <span>📊</span> View History
          </Button>
          <Button
            variant="ghost"
            onClick={handleResetToDefaults}
            className="flex-1 rounded-xl text-muted-foreground hover:text-destructive"
          >
            Reset to Defaults
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
};

type DestinationRowProps = {
  destination: Destination;
  isEditing: boolean;
  isSaving: boolean;
  recentlySaved: boolean;
  customTiming: string;
  onTimingChange: (timing: string) => void;
  onCustomTimingChange: (value: string) => void;
  onCustomTimingSave: () => void;
  onCancelEdit: () => void;
};

const DestinationRow: React.FC<DestinationRowProps> = ({
  destination,
  isEditing,
  isSaving,
  recentlySaved,
  customTiming,
  onTimingChange,
  onCustomTimingChange,
  onCustomTimingSave,
  onCancelEdit,
}) => {
  const icon = destination.is_direct ? '🚚' : '🏠';

  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-2xl border p-3 transition-all duration-300',
        'bg-gradient-to-br from-white via-white to-slate-50',
        recentlySaved && 'ring-2 ring-emerald-400 ring-offset-1',
        isSaving && 'opacity-70'
      )}
    >
      <span className="text-xl" aria-hidden>{icon}</span>

      <div className="flex flex-1 flex-col gap-1">
        <span className="text-sm font-semibold text-foreground">{destination.name}</span>
        {destination.is_direct && (
          <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
            Direct Pickup
          </span>
        )}
      </div>

      {isEditing ? (
        <div className="flex items-center gap-2">
          <Input
            type="text"
            value={customTiming}
            onChange={(e) => onCustomTimingChange(e.target.value)}
            placeholder="e.g., Saturday 2pm"
            className="h-9 w-32 rounded-lg text-sm"
            autoFocus
            onKeyDown={(e) => {
              if (e.key === 'Enter') onCustomTimingSave();
              if (e.key === 'Escape') onCancelEdit();
            }}
          />
          <Button size="sm" onClick={onCustomTimingSave} className="h-9 rounded-lg px-3">
            Save
          </Button>
          <Button size="sm" variant="ghost" onClick={onCancelEdit} className="h-9 rounded-lg px-2">
            ✕
          </Button>
        </div>
      ) : (
        <select
          value={destination.timing ?? ''}
          onChange={(e) => onTimingChange(e.target.value)}
          disabled={isSaving}
          className={cn(
            'h-9 cursor-pointer appearance-none rounded-lg border px-3 pr-8 text-xs font-semibold transition',
            'bg-[length:12px] bg-[right_8px_center] bg-no-repeat',
            'focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1',
            getTimingColor(destination.timing),
            isSaving && 'cursor-wait'
          )}
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3E%3Cpath stroke='%236b7280' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='m6 8 4 4 4-4'/%3E%3C/svg%3E")`,
          }}
        >
          <option value="" disabled>Select timing</option>
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
          <optgroup label="Other">
            <option value="custom">✏️ Custom...</option>
          </optgroup>
        </select>
      )}

      {recentlySaved && (
        <span className="text-lg animate-bounce" aria-label="Saved">✓</span>
      )}
    </div>
  );
};
