import React, { useEffect, useState, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { useOpsStore } from '@/services/opsState';
import { formatWeekDate, type ShiftAssignment, type TimeSlot, type ShiftType, TIME_SLOT_NAMES, SHIFT_TYPE_NAMES } from '@/types/ops';
import { WeeklyGrid } from '../widgets/WeeklyGrid';
import { ShiftCard } from '../widgets/ShiftCard';
import { ShiftActions } from '../widgets/ShiftActions';
import { cn } from '@/lib/utils';

// Expected coverage: which shift types need volunteers in each time slot
// This defines what a "fully covered" week looks like
const EXPECTED_COVERAGE: Partial<Record<TimeSlot, ShiftType[]>> = {
  thursday_evening: ['produce_market', 'truck_loading'],
  friday_noon: ['grocery_distribution'],
  saturday_noon: ['saturday_distribution'],
  saturday_evening: ['saturday_evening_run'],
  sunday_afternoon: ['sunday_distribution'],
};

/**
 * Schedule overview - weekly grid showing all volunteer assignments
 */
const OverviewView: React.FC = () => {
  const {
    volunteers,
    shiftAssignments,
    selectedWeek,
    currentVolunteer,
    fetchShifts,
    isLoading,
  } = useOpsStore();

  const [selectedShift, setSelectedShift] = useState<ShiftAssignment | null>(null);
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

  // Fetch shifts when component mounts
  useEffect(() => {
    fetchShifts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Get shifts for current user
  const myShifts = currentVolunteer
    ? shiftAssignments.filter(s => s.volunteer_id === currentVolunteer.id)
    : [];

  // Calculate coverage gaps
  const coverageGaps = useMemo(() => {
    const gaps: { timeSlot: TimeSlot; shiftType: ShiftType }[] = [];

    for (const [timeSlot, requiredTypes] of Object.entries(EXPECTED_COVERAGE)) {
      for (const shiftType of requiredTypes || []) {
        // Check if there's at least one volunteer assigned to this shift type in this time slot
        const hasVolunteer = shiftAssignments.some(
          s => s.time_slot === timeSlot && s.shift_type === shiftType
        );
        if (!hasVolunteer) {
          gaps.push({ timeSlot: timeSlot as TimeSlot, shiftType });
        }
      }
    }

    return gaps;
  }, [shiftAssignments]);

  const handleShiftClick = (shift: ShiftAssignment) => {
    setSelectedShift(shift);
  };

  const closeShiftDetail = () => {
    setSelectedShift(null);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Schedule Overview</h1>
          <p className="text-slate-500 mt-1">
            Week of {formatWeekDate(selectedWeek)}
          </p>
        </div>

        {/* View toggle */}
        <div className="flex items-center gap-2 bg-slate-100 rounded-lg p-1">
          <button
            onClick={() => setViewMode('grid')}
            className={cn(
              'px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
              viewMode === 'grid'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            )}
          >
            Grid View
          </button>
          <button
            onClick={() => setViewMode('list')}
            className={cn(
              'px-3 py-1.5 text-sm font-medium rounded-md transition-colors',
              viewMode === 'list'
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-600 hover:text-slate-900'
            )}
          >
            List View
          </button>
        </div>
      </div>

      {/* Coverage gap warning */}
      {!isLoading && coverageGaps.length > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
          <div className="flex items-start gap-3">
            <span className="text-amber-500 text-xl mt-0.5">⚠️</span>
            <div className="flex-1">
              <h2 className="font-semibold text-amber-800 mb-1">
                {coverageGaps.length} shift{coverageGaps.length !== 1 ? 's' : ''} need coverage
              </h2>
              <div className="flex flex-wrap gap-2 mb-3">
                {coverageGaps.slice(0, 6).map((gap, idx) => (
                  <span
                    key={idx}
                    className="px-2 py-1 text-xs bg-amber-100 text-amber-700 rounded-md"
                  >
                    {SHIFT_TYPE_NAMES[gap.shiftType]} • {TIME_SLOT_NAMES[gap.timeSlot]}
                  </span>
                ))}
                {coverageGaps.length > 6 && (
                  <span className="px-2 py-1 text-xs bg-amber-100 text-amber-700 rounded-md">
                    +{coverageGaps.length - 6} more
                  </span>
                )}
              </div>
              <Link
                to="/ops/schedule"
                className="text-sm font-medium text-amber-700 hover:text-amber-800 inline-flex items-center gap-1"
              >
                Manage schedule to fill gaps
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </Link>
            </div>
          </div>
        </div>
      )}

      {/* My shifts quick view (if logged in) */}
      {currentVolunteer && myShifts.length > 0 && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="font-semibold text-emerald-800">
              Your Shifts This Week
            </h2>
            <Link
              to={`/ops/volunteer/${currentVolunteer.slug}`}
              className="text-sm text-emerald-600 hover:text-emerald-700"
            >
              View details →
            </Link>
          </div>
          <div className="flex flex-wrap gap-2">
            {myShifts.map(shift => (
              <button
                key={shift.id}
                onClick={() => handleShiftClick(shift)}
                className={cn(
                  'px-3 py-2 bg-white rounded-lg border text-sm font-medium transition-all',
                  'hover:shadow-md hover:border-emerald-300',
                  shift.is_confirmed
                    ? 'border-emerald-300 text-emerald-700'
                    : 'border-amber-300 text-amber-700'
                )}
              >
                {shift.shift_type?.replace(/_/g, ' ')}
                {shift.is_confirmed ? ' ✓' : ' ⏳'}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="text-center py-12">
          <div className="w-8 h-8 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-slate-500">Loading schedule...</p>
        </div>
      )}

      {/* Main schedule view */}
      {!isLoading && (
        <>
          {viewMode === 'grid' ? (
            <WeeklyGrid onShiftClick={handleShiftClick} />
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {shiftAssignments.map(shift => (
                <ShiftCard key={shift.id} shift={shift} />
              ))}
            </div>
          )}
        </>
      )}

      {/* Empty state */}
      {!isLoading && shiftAssignments.length === 0 && (
        <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
          <span className="text-4xl mb-4 block">📅</span>
          <h3 className="text-lg font-semibold text-slate-900 mb-2">No shifts scheduled</h3>
          <p className="text-slate-500 max-w-md mx-auto">
            No shifts have been assigned for this week yet. Check back later or contact the coordinator.
          </p>
        </div>
      )}

      {/* Volunteer quick links */}
      {volunteers.length > 0 && (
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <h2 className="font-semibold text-slate-900 mb-4">Volunteer Schedules</h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {volunteers.map(vol => {
              const volShiftCount = shiftAssignments.filter(
                s => s.volunteer_id === vol.id
              ).length;

              return (
                <Link
                  key={vol.id}
                  to={`/ops/volunteer/${vol.slug}`}
                  className={cn(
                    'flex items-center gap-3 p-3 rounded-lg border transition-all',
                    'hover:border-emerald-300 hover:bg-emerald-50',
                    currentVolunteer?.id === vol.id
                      ? 'border-emerald-300 bg-emerald-50'
                      : 'border-slate-200 bg-white'
                  )}
                >
                  <span
                    className={cn(
                      'w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold',
                      currentVolunteer?.id === vol.id
                        ? 'bg-emerald-200 text-emerald-700'
                        : 'bg-slate-200 text-slate-600'
                    )}
                  >
                    {vol.display_name.charAt(0)}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-slate-700 truncate">
                      {vol.display_name}
                      {currentVolunteer?.id === vol.id && (
                        <span className="text-xs text-emerald-600 ml-1">(you)</span>
                      )}
                    </p>
                    {volShiftCount > 0 && (
                      <p className="text-xs text-slate-500">
                        {volShiftCount} shift{volShiftCount !== 1 ? 's' : ''}
                      </p>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Shift detail modal with actions */}
      {selectedShift && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={closeShiftDetail}
        >
          <div
            className="max-w-md w-full"
            onClick={e => e.stopPropagation()}
          >
            <ShiftActions shift={selectedShift} onClose={closeShiftDetail} />
          </div>
        </div>
      )}
    </div>
  );
};

export default OverviewView;
