import React, { useState, useEffect, useCallback } from 'react';

import { Button } from '@/app/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/app/components/ui/sheet';
import { getSupabaseService, type ScheduleHistoryEntry } from '@/services/supabaseService';
import { cn } from '@/lib/utils';
import { toast } from '@/lib/toast';

type ScheduleHistorySheetProps = {
  open: boolean;
  onClose: () => void;
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

const abbreviateTiming = (timing: string | null) => {
  if (!timing) return '—';
  // Normalize common timing strings
  const normalized = timing.toLowerCase();
  if (normalized.includes('friday') && normalized.includes('am')) return 'Fri AM';
  if (normalized.includes('friday') && normalized.includes('noon')) return 'Fri Noon';
  if (normalized.includes('friday') && normalized.includes('pm')) return 'Fri PM';
  if (normalized.includes('saturday') && normalized.includes('am')) return 'Sat AM';
  if (normalized.includes('saturday') && normalized.includes('noon')) return 'Sat Noon';
  if (normalized.includes('saturday') && normalized.includes('pm')) return 'Sat PM';
  if (normalized.includes('sunday')) return 'Sunday';
  return timing;
};

const formatDate = (dateString: string | null) => {
  if (!dateString) return '—';
  const date = new Date(dateString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
};

const formatTime = (dateString: string | null) => {
  if (!dateString) return '—';
  const date = new Date(dateString);
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
};

export const ScheduleHistorySheet: React.FC<ScheduleHistorySheetProps> = ({
  open,
  onClose,
}) => {
  const [history, setHistory] = useState<ScheduleHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [destinations, setDestinations] = useState<Array<{ id: string; name: string }>>([]);

  const fetchHistory = useCallback(async () => {
    try {
      setLoading(true);
      const supabase = getSupabaseService();

      // Fetch destinations for filter dropdown
      const dests = await supabase.getDestinations();
      setDestinations(dests.map(d => ({ id: d.id, name: d.name })));

      // Fetch history with optional filter
      const filters = filter !== 'all' ? { destinationId: filter } : undefined;
      const data = await supabase.getScheduleHistory(filters);
      setHistory(data);
    } catch (error) {
      console.error('Error fetching schedule history:', error);
      toast.error('Failed to load history');
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    if (open) {
      fetchHistory();
    }
  }, [open, fetchHistory]);

  return (
    <Sheet open={open} onOpenChange={(next) => (!next ? onClose() : undefined)}>
      <SheetContent
        side="bottom"
        className="max-h-[85vh] gap-3 overflow-hidden rounded-t-[32px] border-border/70 bg-card p-4 shadow-[0_-28px_90px_rgba(15,23,42,0.16)]"
      >
        <SheetHeader className="gap-1">
          <div className="mx-auto h-1 w-12 rounded-full bg-muted" aria-hidden />
          <SheetTitle className="flex items-center gap-2 text-base font-semibold">
            <span className="text-xl">📊</span> Schedule History
          </SheetTitle>
          <SheetDescription className="text-xs">
            View all schedule changes over time
          </SheetDescription>
        </SheetHeader>

        {/* Filter */}
        <div className="flex items-center gap-2 py-2">
          <label className="text-xs font-medium text-muted-foreground">Filter:</label>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="h-8 rounded-lg border border-border/60 bg-white px-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-ring"
          >
            <option value="all">All Destinations</option>
            {destinations.map(d => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>

        {/* History List */}
        <div className="flex-1 overflow-y-auto py-2" style={{ maxHeight: '55vh' }}>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : history.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <span className="text-4xl mb-3">📭</span>
              <p className="text-sm font-medium text-muted-foreground">No schedule changes yet</p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                Changes will appear here when you modify delivery times
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {history.map((entry) => (
                <HistoryCard key={entry.id} entry={entry} />
              ))}
            </div>
          )}
        </div>

        <Button variant="outline" onClick={onClose} className="mt-2 h-11 w-full rounded-xl text-sm font-semibold">
          Close
        </Button>
      </SheetContent>
    </Sheet>
  );
};

type HistoryCardProps = {
  entry: ScheduleHistoryEntry;
};

const HistoryCard: React.FC<HistoryCardProps> = ({ entry }) => {
  const newTimingColor = getTimingColor(entry.new_timing);

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl border bg-white p-3 shadow-sm',
        // Left accent border colored by new timing
        'border-l-4',
        newTimingColor.includes('blue') && 'border-l-blue-400',
        newTimingColor.includes('indigo') && 'border-l-indigo-400',
        newTimingColor.includes('teal') && 'border-l-teal-400',
        newTimingColor.includes('emerald') && 'border-l-emerald-400',
        newTimingColor.includes('amber') && 'border-l-amber-400',
        newTimingColor.includes('rose') && 'border-l-rose-400',
        !newTimingColor.includes('blue') &&
        !newTimingColor.includes('indigo') &&
        !newTimingColor.includes('teal') &&
        !newTimingColor.includes('emerald') &&
        !newTimingColor.includes('amber') &&
        !newTimingColor.includes('rose') &&
        'border-l-slate-400'
      )}
    >
      {/* Date & Time */}
      <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
        <span>{formatDate(entry.changed_at)}</span>
        <span className="text-muted-foreground/50">•</span>
        <span>{formatTime(entry.changed_at)}</span>
      </div>

      {/* Destination Name */}
      <div className="mb-2 text-sm font-semibold text-foreground">
        {entry.destination_name}
      </div>

      {/* Timing Change */}
      <div className="flex items-center gap-2">
        <span
          className={cn(
            'inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold',
            getTimingColor(entry.previous_timing)
          )}
        >
          {abbreviateTiming(entry.previous_timing)}
        </span>

        <span className="text-muted-foreground" aria-hidden>→</span>

        <span
          className={cn(
            'inline-flex items-center rounded-md border px-2 py-0.5 text-[10px] font-semibold',
            getTimingColor(entry.new_timing)
          )}
        >
          {abbreviateTiming(entry.new_timing)}
        </span>
      </div>

      {/* Changed By */}
      {entry.changed_by && (
        <div className="mt-2 text-[10px] text-muted-foreground">
          Changed by: <span className="font-medium">{entry.changed_by}</span>
        </div>
      )}
    </div>
  );
};
