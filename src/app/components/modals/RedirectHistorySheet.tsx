import React, { useState, useEffect, useCallback } from 'react';

import { Button } from '@/app/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/app/components/ui/sheet';
import { getSupabaseService } from '@/services/supabaseService';
import { useAppStore } from '@/services/state';
import { cn } from '@/lib/utils';
import { toast } from '@/lib/toast';

type RedirectHistoryEntry = {
  id: string;
  itemName: string;
  itemEmoji: string;
  sourceDestinationName: string;
  targetDestinationName: string;
  quantity: number;
  redirectedBy: string | null;
  redirectedAt: string | null;
};

type RedirectHistorySheetProps = {
  open: boolean;
  onClose: () => void;
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

const formatRelativeTime = (dateString: string | null) => {
  if (!dateString) return '—';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return 'yesterday';
  if (diffDays < 7) return `${diffDays}d ago`;
  return formatDate(dateString);
};

export const RedirectHistorySheet: React.FC<RedirectHistorySheetProps> = ({
  open,
  onClose,
}) => {
  const [history, setHistory] = useState<RedirectHistoryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('all');
  const [destinations, setDestinations] = useState<Array<{ id: string; name: string }>>([]);

  const currentWeekDate = useAppStore((s) => s.currentWeekDate);

  const fetchHistory = useCallback(async () => {
    if (!currentWeekDate) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const supabase = getSupabaseService();

      // Fetch destinations for filter dropdown
      const dests = await supabase.getDestinations();
      setDestinations(dests.map(d => ({ id: d.id, name: d.name })));

      // Fetch enriched redirections
      const data = await supabase.getRedirectionsEnriched(currentWeekDate);

      // Apply filter if selected
      let filtered = data;
      if (filter !== 'all') {
        filtered = data.filter(r =>
          r.sourceDestinationId === filter || r.targetDestinationId === filter
        );
      }

      setHistory(filtered.map(r => ({
        id: r.id,
        itemName: r.itemName,
        itemEmoji: r.itemEmoji,
        sourceDestinationName: r.sourceDestinationName,
        targetDestinationName: r.targetDestinationName,
        quantity: r.quantity,
        redirectedBy: r.redirectedBy,
        redirectedAt: r.redirectedAt,
      })));
    } catch (error) {
      console.error('Error fetching redirect history:', error);
      toast.error('Failed to load redirect history');
    } finally {
      setLoading(false);
    }
  }, [currentWeekDate, filter]);

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
            <span className="text-xl">🔀</span> Redirect History
          </SheetTitle>
          <SheetDescription className="text-xs">
            View all item redirects this week
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
              <p className="text-sm font-medium text-muted-foreground">No redirects yet</p>
              <p className="text-xs text-muted-foreground/70 mt-1">
                Long-press items in Pickup view to redirect them
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {history.map((entry) => (
                <RedirectCard key={entry.id} entry={entry} />
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

type RedirectCardProps = {
  entry: RedirectHistoryEntry;
};

const RedirectCard: React.FC<RedirectCardProps> = ({ entry }) => {
  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl border bg-white p-3 shadow-sm',
        // Left accent border in violet for redirect theme
        'border-l-4 border-l-violet-400'
      )}
    >
      {/* Date & Time */}
      <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
        <span>{formatDate(entry.redirectedAt)}</span>
        <span className="text-muted-foreground/50">•</span>
        <span>{formatTime(entry.redirectedAt)}</span>
        <span className="ml-auto text-violet-600 font-medium">
          {formatRelativeTime(entry.redirectedAt)}
        </span>
      </div>

      {/* Item Info */}
      <div className="mb-2 flex items-center gap-2">
        <span className="text-2xl">{entry.itemEmoji}</span>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-foreground truncate">
            {entry.itemName}
          </div>
          <div className="flex items-center gap-1.5 text-xs">
            <span className="rounded-full bg-violet-100 px-2 py-0.5 font-semibold text-violet-700">
              {entry.quantity}x
            </span>
          </div>
        </div>
      </div>

      {/* Destination Flow */}
      <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2">
        <span className="text-xs font-medium text-muted-foreground truncate max-w-[40%]">
          {entry.sourceDestinationName}
        </span>

        <span className="text-violet-500 font-bold" aria-hidden>→</span>

        <span className="text-xs font-semibold text-foreground truncate max-w-[40%]">
          {entry.targetDestinationName}
        </span>
      </div>

      {/* Redirected By */}
      {entry.redirectedBy && (
        <div className="mt-2 text-[10px] text-muted-foreground">
          Redirected by: <span className="font-medium">{entry.redirectedBy}</span>
        </div>
      )}
    </div>
  );
};
