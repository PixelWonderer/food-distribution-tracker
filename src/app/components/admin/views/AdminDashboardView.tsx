import React, { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { getSupabaseService } from '@/services/supabaseService';
import { toast } from '@/lib/toast';
import { useAppStore } from '@/services/state';

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

// Timing slots for the grid columns
const TIMING_SLOTS = [
  { value: 'Friday AM', label: 'Fri AM', shortLabel: 'F-AM' },
  { value: 'Friday noon', label: 'Fri Noon', shortLabel: 'F-N' },
  { value: 'Friday PM', label: 'Fri PM', shortLabel: 'F-PM' },
  { value: 'Saturday AM', label: 'Sat AM', shortLabel: 'S-AM' },
  { value: 'Saturday noon', label: 'Sat Noon', shortLabel: 'S-N' },
  { value: 'Saturday PM', label: 'Sat PM', shortLabel: 'S-PM' },
  { value: 'Sunday', label: 'Sunday', shortLabel: 'Sun' },
];

const TIMING_COLORS: Record<string, string> = {
  'friday am': 'bg-blue-500',
  'friday noon': 'bg-indigo-500',
  'friday pm': 'bg-indigo-600',
  'saturday am': 'bg-teal-500',
  'saturday noon': 'bg-emerald-500',
  'saturday pm': 'bg-amber-500',
  'sunday': 'bg-rose-500',
};

const getTimingColor = (timing: string | null): string => {
  if (!timing) return 'bg-slate-300';
  return TIMING_COLORS[timing.toLowerCase()] || 'bg-slate-400';
};

export const AdminDashboardView: React.FC = () => {
  const [destinations, setDestinations] = useState<Destination[]>([]);
  const [loading, setLoading] = useState(true);
  const volunteerName = useAppStore((s) => s.preferences.volunteerName);

  const fetchDestinations = useCallback(async () => {
    try {
      setLoading(true);
      const supabase = getSupabaseService();
      const data = await supabase.getDestinations();
      // Sort by display order, filter out inactive
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

  const handleCellClick = async (destId: string, newTiming: string) => {
    const dest = destinations.find((d) => d.id === destId);
    if (!dest) return;

    // Optimistic update
    setDestinations((prev) =>
      prev.map((d) => (d.id === destId ? { ...d, timing: newTiming } : d))
    );

    try {
      const supabase = getSupabaseService();
      await supabase.updateDestinationTiming(destId, newTiming, volunteerName || undefined);
      toast.success(`${dest.name} → ${newTiming}`);
    } catch (error) {
      console.error('Error updating timing:', error);
      toast.error('Failed to update timing');
      // Revert on error
      fetchDestinations();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Quick Actions */}
      <div className="grid grid-cols-3 gap-4">
        <Link
          to="/admin/destinations"
          className="p-4 bg-white rounded-xl border border-slate-200 hover:border-emerald-300 hover:shadow-md transition-all group"
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl">📍</span>
            <div>
              <h3 className="font-semibold text-slate-900 group-hover:text-emerald-700">
                Manage Destinations
              </h3>
              <p className="text-sm text-slate-500">Edit timings, bulk updates</p>
            </div>
          </div>
        </Link>

        <Link
          to="/admin/partner-split"
          className="p-4 bg-white rounded-xl border border-slate-200 hover:border-emerald-300 hover:shadow-md transition-all group"
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl">📦</span>
            <div>
              <h3 className="font-semibold text-slate-900 group-hover:text-emerald-700">
                Partner Distribution
              </h3>
              <p className="text-sm text-slate-500">Split items to recipients</p>
            </div>
          </div>
        </Link>

        <Link
          to="/"
          className="p-4 bg-white rounded-xl border border-slate-200 hover:border-emerald-300 hover:shadow-md transition-all group"
        >
          <div className="flex items-center gap-3">
            <span className="text-2xl">📱</span>
            <div>
              <h3 className="font-semibold text-slate-900 group-hover:text-emerald-700">
                Back to Tracker
              </h3>
              <p className="text-sm text-slate-500">Mobile-friendly view</p>
            </div>
          </div>
        </Link>
      </div>

      {/* Schedule Overview Grid */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-200">
          <h2 className="text-lg font-semibold text-slate-900">Weekly Schedule Overview</h2>
          <p className="text-sm text-slate-500">
            Click a cell to move a destination to that time slot
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50">
                <th className="px-4 py-3 text-left text-sm font-semibold text-slate-700 w-48 border-b border-slate-200">
                  Destination
                </th>
                {TIMING_SLOTS.map((slot) => (
                  <th
                    key={slot.value}
                    className="px-2 py-3 text-center text-xs font-semibold text-slate-600 border-b border-slate-200 min-w-[80px]"
                  >
                    {slot.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {destinations.map((dest, idx) => {
                const currentTiming = dest.timing?.toLowerCase();
                const isCustomTiming =
                  currentTiming &&
                  !TIMING_SLOTS.some((s) => s.value.toLowerCase() === currentTiming);

                return (
                  <tr
                    key={dest.id}
                    className={cn(
                      'hover:bg-slate-50 transition-colors',
                      idx % 2 === 0 ? 'bg-white' : 'bg-slate-25'
                    )}
                  >
                    <td className="px-4 py-3 border-b border-slate-100">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{dest.is_direct ? '🚚' : '🏠'}</span>
                        <div>
                          <div className="font-medium text-slate-900">{dest.name}</div>
                          {dest.is_direct && (
                            <div className="text-[10px] uppercase tracking-wide text-slate-500">
                              Direct Pickup
                            </div>
                          )}
                          {isCustomTiming && (
                            <div className="text-xs text-amber-600 font-medium">
                              Custom: {dest.timing}
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    {TIMING_SLOTS.map((slot) => {
                      const isActive =
                        currentTiming === slot.value.toLowerCase();
                      return (
                        <td
                          key={slot.value}
                          className="px-2 py-3 text-center border-b border-slate-100"
                        >
                          <button
                            onClick={() => handleCellClick(dest.id, slot.value)}
                            className={cn(
                              'w-8 h-8 rounded-full transition-all',
                              'hover:ring-2 hover:ring-offset-2 hover:ring-slate-300',
                              isActive
                                ? cn(getTimingColor(slot.value), 'ring-2 ring-offset-2 ring-slate-400')
                                : 'bg-slate-100 hover:bg-slate-200'
                            )}
                            title={`Move ${dest.name} to ${slot.label}`}
                          >
                            {isActive && (
                              <span className="text-white text-xs font-bold">●</span>
                            )}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Legend */}
        <div className="px-6 py-4 border-t border-slate-200 bg-slate-50">
          <div className="flex items-center gap-6 text-xs text-slate-600">
            <span className="font-medium">Legend:</span>
            <div className="flex items-center gap-1.5">
              <span className="text-base">🚚</span>
              <span>Direct Pickup</span>
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-base">🏠</span>
              <span>Storage First</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className={cn('w-4 h-4 rounded-full', getTimingColor('friday am'))} />
              <span>Scheduled</span>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="w-4 h-4 rounded-full bg-slate-200" />
              <span>Click to assign</span>
            </div>
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {TIMING_SLOTS.slice(0, 4).map((slot) => {
          const count = destinations.filter(
            (d) => d.timing?.toLowerCase() === slot.value.toLowerCase()
          ).length;
          return (
            <div
              key={slot.value}
              className="bg-white rounded-xl border border-slate-200 p-4"
            >
              <div className="flex items-center gap-2 mb-2">
                <div className={cn('w-3 h-3 rounded-full', getTimingColor(slot.value))} />
                <span className="text-sm font-medium text-slate-700">{slot.label}</span>
              </div>
              <div className="text-2xl font-bold text-slate-900">{count}</div>
              <div className="text-xs text-slate-500">destinations</div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default AdminDashboardView;
