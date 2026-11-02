import React, { useState, useEffect, useCallback } from 'react';

import { Button } from '@/app/components/ui/button';
import { Input } from '@/app/components/ui/input';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/app/components/ui/sheet';
import { getSupabaseService } from '@/services/supabaseService';
import { useAppStore } from '@/services/state';
import { cn } from '@/lib/utils';
import { toast } from '@/lib/toast';

type Destination = {
  id: string;
  code: string;
  name: string;
  timing: string | null;
  is_direct: boolean;
  is_custom: boolean;
  is_active: boolean;
  created_by: string | null;
  display_order: number;
};

type DestinationManagementSheetProps = {
  open: boolean;
  onClose: () => void;
};

// Timing options for custom destinations
const TIMING_OPTIONS = [
  { value: 'Unscheduled', label: 'Unscheduled' },
  { value: 'Friday AM', label: 'Friday AM' },
  { value: 'Friday noon', label: 'Friday Noon' },
  { value: 'Friday PM', label: 'Friday PM' },
  { value: 'Saturday AM', label: 'Saturday AM' },
  { value: 'Saturday noon', label: 'Saturday Noon' },
  { value: 'Saturday PM', label: 'Saturday PM' },
  { value: 'Sunday', label: 'Sunday' },
];

// Color classes for timing badges
const TIMING_COLORS: Record<string, string> = {
  'friday am': 'border-blue-200 bg-blue-50 text-blue-700',
  'friday noon': 'border-indigo-200 bg-indigo-50 text-indigo-700',
  'friday pm': 'border-indigo-200 bg-indigo-50 text-indigo-700',
  'saturday am': 'border-teal-200 bg-teal-50 text-teal-700',
  'saturday noon': 'border-emerald-200 bg-emerald-50 text-emerald-700',
  'saturday pm': 'border-amber-200 bg-amber-50 text-amber-700',
  'sunday': 'border-rose-200 bg-rose-50 text-rose-700',
  'unscheduled': 'border-slate-200 bg-slate-50 text-slate-600',
};

const getTimingColor = (timing: string | null) => {
  if (!timing) return 'border-slate-200 bg-slate-50 text-slate-600';
  const key = timing.toLowerCase();
  return TIMING_COLORS[key] ?? 'border-slate-200 bg-slate-50 text-slate-600';
};

export const DestinationManagementSheet: React.FC<DestinationManagementSheetProps> = ({
  open,
  onClose,
}) => {
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newName, setNewName] = useState('');
  const [newTiming, setNewTiming] = useState('Unscheduled');
  const [newIsDirect, setNewIsDirect] = useState(false);
  const [creating, setCreating] = useState(false);

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
      setShowAddForm(false);
      setNewName('');
      setNewTiming('Unscheduled');
      setNewIsDirect(false);
    }
  }, [open, fetchDestinations]);

  const handleCreateDestination = async () => {
    const trimmedName = newName.trim();
    if (!trimmedName) {
      toast.error('Please enter a name');
      return;
    }

    try {
      setCreating(true);
      const supabase = getSupabaseService();
      await supabase.createCustomDestination(
        trimmedName,
        newTiming,
        newIsDirect,
        volunteerName || undefined
      );

      toast.success(`Created "${trimmedName}"`);
      setShowAddForm(false);
      setNewName('');
      setNewTiming('Unscheduled');
      setNewIsDirect(false);
      await fetchDestinations();
    } catch (error) {
      console.error('Error creating destination:', error);
      toast.error('Failed to create destination');
    } finally {
      setCreating(false);
    }
  };

  const handleDeactivate = async (dest: Destination) => {
    if (!window.confirm(`Remove "${dest.name}" from destinations?`)) {
      return;
    }

    try {
      const supabase = getSupabaseService();
      await supabase.deactivateCustomDestination(dest.id);
      toast.success(`Removed "${dest.name}"`);
      await fetchDestinations();
    } catch (error) {
      console.error('Error deactivating destination:', error);
      toast.error('Failed to remove destination');
    }
  };

  const handleReactivate = async (dest: Destination) => {
    try {
      const supabase = getSupabaseService();
      await supabase.reactivateCustomDestination(dest.id);
      toast.success(`Restored "${dest.name}"`);
      await fetchDestinations();
    } catch (error) {
      console.error('Error reactivating destination:', error);
      toast.error('Failed to restore destination');
    }
  };

  // Separate active and inactive destinations
  const activeDestinations = destinations.filter(d => d.is_active !== false);
  const inactiveDestinations = destinations.filter(d => d.is_active === false);

  return (
    <Sheet open={open} onOpenChange={(next) => (!next ? onClose() : undefined)}>
      <SheetContent
        side="bottom"
        className="max-h-[85vh] gap-3 overflow-hidden rounded-t-[32px] border-border/70 bg-card p-4 shadow-[0_-28px_90px_rgba(15,23,42,0.16)]"
      >
        <SheetHeader className="gap-1">
          <div className="mx-auto h-1 w-12 rounded-full bg-muted" aria-hidden />
          <SheetTitle className="flex items-center gap-2 text-base font-semibold">
            <span className="text-xl">📍</span> Manage Destinations
          </SheetTitle>
          <SheetDescription className="text-xs">
            Add custom destinations or manage existing ones
          </SheetDescription>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto py-3" style={{ maxHeight: '55vh' }}>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            </div>
          ) : (
            <div className="space-y-4">
              {/* Add New Destination Form */}
              {showAddForm ? (
                <div className="rounded-2xl border-2 border-dashed border-primary/30 bg-primary/5 p-4">
                  <h3 className="mb-3 text-sm font-semibold text-primary">Add Custom Destination</h3>

                  <div className="space-y-3">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-muted-foreground">
                        Destination Name
                      </label>
                      <Input
                        type="text"
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        placeholder="e.g., a volunteer's place, a community garden"
                        className="h-10 rounded-xl"
                        autoFocus
                      />
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-medium text-muted-foreground">
                        Pickup Time
                      </label>
                      <select
                        value={newTiming}
                        onChange={(e) => setNewTiming(e.target.value)}
                        className={cn(
                          'h-10 w-full rounded-xl border px-3 text-sm font-medium',
                          'focus:outline-none focus:ring-2 focus:ring-ring',
                          getTimingColor(newTiming)
                        )}
                      >
                        {TIMING_OPTIONS.map((opt) => (
                          <option key={opt.value} value={opt.value}>
                            {opt.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <label className="flex items-center gap-2">
                      <input
                        type="checkbox"
                        checked={newIsDirect}
                        onChange={(e) => setNewIsDirect(e.target.checked)}
                        className="h-4 w-4 rounded border-gray-300"
                      />
                      <span className="text-sm text-muted-foreground">
                        Direct pickup (skip storage phase)
                      </span>
                    </label>

                    <div className="flex gap-2 pt-2">
                      <Button
                        onClick={handleCreateDestination}
                        disabled={creating || !newName.trim()}
                        className="flex-1 rounded-xl"
                      >
                        {creating ? 'Creating...' : 'Add Destination'}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setShowAddForm(false);
                          setNewName('');
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
                  onClick={() => setShowAddForm(true)}
                  className="w-full gap-2 rounded-2xl border-2 border-dashed border-primary/30 bg-primary/5 py-6 text-primary hover:bg-primary/10"
                >
                  <span className="text-xl">+</span>
                  Add Custom Destination
                </Button>
              )}

              {/* Active Destinations */}
              <div className="space-y-2">
                <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Active Destinations ({activeDestinations.length})
                </h3>
                {activeDestinations.map((dest) => (
                  <DestinationCard
                    key={dest.id}
                    destination={dest}
                    onDeactivate={() => handleDeactivate(dest)}
                  />
                ))}
              </div>

              {/* Inactive (Removed) Destinations */}
              {inactiveDestinations.length > 0 && (
                <div className="space-y-2">
                  <h3 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    Removed ({inactiveDestinations.length})
                  </h3>
                  {inactiveDestinations.map((dest) => (
                    <DestinationCard
                      key={dest.id}
                      destination={dest}
                      onReactivate={() => handleReactivate(dest)}
                      inactive
                    />
                  ))}
                </div>
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

type DestinationCardProps = {
  destination: Destination;
  onDeactivate?: () => void;
  onReactivate?: () => void;
  inactive?: boolean;
};

const DestinationCard: React.FC<DestinationCardProps> = ({
  destination,
  onDeactivate,
  onReactivate,
  inactive = false,
}) => {
  const icon = destination.is_direct ? '🚚' : '🏠';
  const isCustom = destination.is_custom;

  return (
    <div
      className={cn(
        'flex items-center gap-3 rounded-2xl border p-3 transition-all',
        'bg-gradient-to-br from-white via-white to-slate-50',
        inactive && 'opacity-50',
        isCustom && !inactive && 'border-primary/30 bg-primary/5'
      )}
    >
      <span className="text-xl" aria-hidden>{icon}</span>

      <div className="flex flex-1 flex-col gap-0.5">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-foreground">{destination.name}</span>
          {isCustom && (
            <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-primary">
              Custom
            </span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <span
            className={cn(
              'inline-flex rounded-md border px-2 py-0.5 text-[10px] font-semibold',
              getTimingColor(destination.timing)
            )}
          >
            {destination.timing || 'Not set'}
          </span>
          {destination.is_direct && (
            <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Direct
            </span>
          )}
        </div>
        {destination.created_by && (
          <span className="text-[10px] text-muted-foreground">
            Added by {destination.created_by}
          </span>
        )}
      </div>

      {/* Only custom destinations can be removed/restored */}
      {isCustom && !inactive && onDeactivate && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onDeactivate}
          className="h-8 rounded-lg px-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
        >
          Remove
        </Button>
      )}
      {isCustom && inactive && onReactivate && (
        <Button
          variant="outline"
          size="sm"
          onClick={onReactivate}
          className="h-8 rounded-lg px-3 text-xs"
        >
          Restore
        </Button>
      )}
    </div>
  );
};
