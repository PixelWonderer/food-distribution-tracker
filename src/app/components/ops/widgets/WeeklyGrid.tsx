import React from 'react';
import { cn } from '@/lib/utils';
import { useOpsStore } from '@/services/opsState';
import {
  TIME_SLOT_NAMES,
  SHIFT_TYPE_NAMES,
  isShiftToday,
  type TimeSlot,
  type ShiftAssignment,
} from '@/types/ops';

// Time slot styling
const TIME_SLOT_COLORS: Record<TimeSlot, { bg: string; border: string; header: string }> = {
  thursday_evening: { bg: 'bg-slate-50', border: 'border-slate-300', header: 'bg-slate-500' },
  friday_am: { bg: 'bg-green-50', border: 'border-green-300', header: 'bg-green-500' },
  friday_noon: { bg: 'bg-green-50', border: 'border-green-300', header: 'bg-green-600' },
  friday_pm: { bg: 'bg-green-50', border: 'border-green-300', header: 'bg-green-700' },
  saturday_am: { bg: 'bg-blue-50', border: 'border-blue-300', header: 'bg-blue-500' },
  saturday_noon: { bg: 'bg-blue-50', border: 'border-blue-300', header: 'bg-blue-600' },
  saturday_pm: { bg: 'bg-blue-50', border: 'border-blue-300', header: 'bg-blue-700' },
  saturday_evening: { bg: 'bg-cyan-50', border: 'border-cyan-300', header: 'bg-cyan-600' },
  sunday_afternoon: { bg: 'bg-orange-50', border: 'border-orange-300', header: 'bg-orange-500' },
};

interface WeeklyGridProps {
  onShiftClick?: (shift: ShiftAssignment) => void;
}

/**
 * Weekly schedule grid showing all time slots and assignments
 */
export const WeeklyGrid: React.FC<WeeklyGridProps> = ({ onShiftClick }) => {
  const { shiftAssignments, currentVolunteer, selectedWeek } = useOpsStore();

  // Group shifts by time slot
  const timeSlots: TimeSlot[] = [
    'thursday_evening',
    'friday_noon',
    'saturday_noon',
    'saturday_evening',
    'sunday_afternoon',
  ];

  const getShiftsForSlot = (slot: TimeSlot): ShiftAssignment[] => {
    return shiftAssignments
      .filter(s => s.time_slot === slot)
      .sort((a, b) => {
        // Sort by shift type, then by volunteer name
        if (a.shift_type !== b.shift_type) {
          return (a.shift_type || '').localeCompare(b.shift_type || '');
        }
        return (a.volunteer?.display_name || '').localeCompare(b.volunteer?.display_name || '');
      });
  };

  // Group shifts by shift_type within a time slot
  const groupShiftsByType = (shifts: ShiftAssignment[]) => {
    const groups: Record<string, ShiftAssignment[]> = {};
    shifts.forEach(shift => {
      const type = shift.shift_type || 'other';
      if (!groups[type]) groups[type] = [];
      groups[type].push(shift);
    });
    return groups;
  };

  return (
    <div className="space-y-4">
      {timeSlots.map(slot => {
        const shifts = getShiftsForSlot(slot);
        const colors = TIME_SLOT_COLORS[slot];
        const shiftGroups = groupShiftsByType(shifts);
        const isToday = isShiftToday(slot, selectedWeek);

        return (
          <div
            key={slot}
            className={cn(
              'rounded-xl border overflow-hidden',
              isToday ? 'border-amber-400 ring-2 ring-amber-300 shadow-lg' : colors.border,
              isToday ? 'bg-amber-50' : colors.bg
            )}
          >
            {/* Time slot header */}
            <div className={cn(
              'px-4 py-3 text-white font-semibold',
              isToday ? 'bg-amber-500' : colors.header
            )}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span>{TIME_SLOT_NAMES[slot]}</span>
                  {isToday && (
                    <span className="px-2 py-0.5 bg-white/20 text-white text-xs font-bold rounded animate-pulse">
                      TODAY
                    </span>
                  )}
                </div>
                <span className="text-sm font-normal opacity-90">
                  {shifts.length} volunteer{shifts.length !== 1 ? 's' : ''}
                </span>
              </div>
            </div>

            {/* Shift assignments */}
            <div className="p-4">
              {shifts.length === 0 ? (
                <p className="text-slate-400 text-sm italic">No assignments yet</p>
              ) : (
                <div className="space-y-3">
                  {Object.entries(shiftGroups).map(([shiftType, typeShifts]) => (
                    <div key={shiftType} className="space-y-2">
                      {/* Shift type label */}
                      <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
                        {SHIFT_TYPE_NAMES[shiftType] || shiftType}
                      </div>

                      {/* Volunteers for this shift type */}
                      <div className="flex flex-wrap gap-2">
                        {typeShifts.map(shift => (
                          <ShiftBadge
                            key={shift.id}
                            shift={shift}
                            isCurrentUser={currentVolunteer?.id === shift.volunteer_id}
                            onClick={() => onShiftClick?.(shift)}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
};

interface ShiftBadgeProps {
  shift: ShiftAssignment;
  isCurrentUser: boolean;
  onClick?: () => void;
}

const ShiftBadge: React.FC<ShiftBadgeProps> = ({ shift, isCurrentUser, onClick }) => {
  const volunteerName = shift.volunteer?.display_name || 'Unassigned';
  const initial = volunteerName.charAt(0);

  return (
    <button
      onClick={onClick}
      className={cn(
        'flex items-center gap-2 px-3 py-2 rounded-lg border bg-white transition-all',
        'hover:shadow-md hover:border-emerald-300 cursor-pointer',
        isCurrentUser && 'ring-2 ring-emerald-400 ring-offset-1',
        !shift.is_confirmed && 'border-dashed border-amber-400'
      )}
    >
      {/* Avatar */}
      <span
        className={cn(
          'w-7 h-7 rounded-full flex items-center justify-center text-sm font-semibold',
          isCurrentUser ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
        )}
      >
        {initial}
      </span>

      {/* Name and status */}
      <div className="text-left">
        <div className="flex items-center gap-1.5">
          <span className={cn('text-sm font-medium', isCurrentUser && 'text-emerald-700')}>
            {volunteerName}
          </span>
          {isCurrentUser && (
            <span className="text-xs text-emerald-600">(you)</span>
          )}
        </div>
        {!shift.is_confirmed && (
          <span className="text-xs text-amber-600">Pending</span>
        )}
      </div>

      {/* Confirmed indicator */}
      {shift.is_confirmed && (
        <span className="text-emerald-500 text-sm ml-1">✓</span>
      )}
    </button>
  );
};

export default WeeklyGrid;
