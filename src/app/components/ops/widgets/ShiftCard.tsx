import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useOpsStore } from '@/services/opsState';
import {
  TIME_SLOT_NAMES,
  SHIFT_TYPE_NAMES,
  isShiftToday,
  type TimeSlot,
  type ShiftAssignment,
} from '@/types/ops';

// Time slot color schemes
const TIME_SLOT_STYLES: Record<TimeSlot, { bg: string; text: string; light: string }> = {
  thursday_evening: { bg: 'bg-slate-600', text: 'text-slate-600', light: 'bg-slate-100' },
  friday_am: { bg: 'bg-green-500', text: 'text-green-600', light: 'bg-green-100' },
  friday_noon: { bg: 'bg-green-600', text: 'text-green-600', light: 'bg-green-100' },
  friday_pm: { bg: 'bg-green-700', text: 'text-green-700', light: 'bg-green-100' },
  saturday_am: { bg: 'bg-blue-500', text: 'text-blue-600', light: 'bg-blue-100' },
  saturday_noon: { bg: 'bg-blue-600', text: 'text-blue-600', light: 'bg-blue-100' },
  saturday_pm: { bg: 'bg-blue-700', text: 'text-blue-700', light: 'bg-blue-100' },
  saturday_evening: { bg: 'bg-cyan-600', text: 'text-cyan-600', light: 'bg-cyan-100' },
  sunday_afternoon: { bg: 'bg-orange-500', text: 'text-orange-600', light: 'bg-orange-100' },
};

interface ShiftCardProps {
  shift: ShiftAssignment;
  showVolunteer?: boolean;
  showTimeSlot?: boolean;
  showTimeline?: boolean;
  compact?: boolean;
  onToggleConfirm?: (shift: ShiftAssignment) => void;
  onViewDetails?: (shift: ShiftAssignment) => void;
}

/**
 * Individual shift card with details and confirmation toggle
 */
export const ShiftCard: React.FC<ShiftCardProps> = ({
  shift,
  showVolunteer = true,
  showTimeSlot = true,
  showTimeline = false,
  compact = false,
  onToggleConfirm,
  onViewDetails,
}) => {
  const { currentVolunteer, selectedWeek, toggleShiftConfirmation, shiftDetails, handoffs } = useOpsStore();
  const [isUpdating, setIsUpdating] = useState(false);

  const isMyShift = currentVolunteer?.id === shift.volunteer_id;
  const timeSlot = shift.time_slot as TimeSlot;
  const styles = TIME_SLOT_STYLES[timeSlot] || TIME_SLOT_STYLES.thursday_evening;
  const isToday = isShiftToday(timeSlot, selectedWeek);

  // Get rich shift details
  const details = shiftDetails.find(sd => sd.shift_type === shift.shift_type);

  // Check if there are handoffs for this shift
  const hasHandoffs = handoffs.some(
    h => h.from_shift_type === shift.shift_type || h.to_shift_type === shift.shift_type
  );

  const handleToggleConfirm = async () => {
    if (!onToggleConfirm && !toggleShiftConfirmation) return;

    setIsUpdating(true);
    try {
      if (onToggleConfirm) {
        onToggleConfirm(shift);
      } else {
        await toggleShiftConfirmation(shift.id);
      }
    } finally {
      setIsUpdating(false);
    }
  };

  if (compact) {
    return (
      <div
        className={cn(
          'flex items-center gap-3 p-3 rounded-lg border bg-white',
          isMyShift && 'ring-2 ring-emerald-300',
          !shift.is_confirmed && 'border-dashed border-amber-300',
          isToday && 'bg-amber-50 border-amber-300 shadow-sm'
        )}
      >
        {/* Color indicator */}
        <div className={cn('w-1.5 h-10 rounded-full', isToday ? 'bg-amber-500' : styles.bg)} />

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-medium text-slate-900 text-sm">
              {SHIFT_TYPE_NAMES[shift.shift_type || ''] || shift.shift_type}
            </span>
            {isToday && (
              <span className="px-1.5 py-0.5 bg-amber-500 text-white text-[10px] font-bold rounded uppercase">
                Today
              </span>
            )}
            {shift.is_confirmed ? (
              <span className="text-emerald-500 text-xs">✓ Confirmed</span>
            ) : (
              <span className="text-amber-500 text-xs">Pending</span>
            )}
          </div>
          {showTimeSlot && (
            <p className="text-xs text-slate-500 mt-0.5">
              {TIME_SLOT_NAMES[timeSlot]}
            </p>
          )}
        </div>

        {/* Volunteer avatar if showing */}
        {showVolunteer && shift.volunteer && (
          <Link
            to={`/ops/volunteer/${shift.volunteer.slug}`}
            className="flex items-center gap-2 hover:opacity-80"
          >
            <span className="w-7 h-7 rounded-full bg-slate-200 flex items-center justify-center text-xs font-semibold text-slate-600">
              {shift.volunteer.display_name.charAt(0)}
            </span>
          </Link>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        'rounded-xl border bg-white overflow-hidden shadow-sm',
        isMyShift && 'ring-2 ring-emerald-300',
        !shift.is_confirmed && 'border-dashed border-amber-300',
        isToday && 'ring-2 ring-amber-400 shadow-md'
      )}
    >
      {/* Header */}
      <div className={cn('px-4 py-3 text-white', isToday ? 'bg-amber-500' : styles.bg)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {details?.icon && <span className="text-lg">{details.icon}</span>}
            <span className="font-semibold">
              {SHIFT_TYPE_NAMES[shift.shift_type || ''] || shift.shift_type}
            </span>
            {isToday && (
              <span className="px-2 py-0.5 bg-white/20 text-white text-xs font-bold rounded">
                TODAY
              </span>
            )}
            {hasHandoffs && (
              <span className="px-1.5 py-0.5 bg-white/20 text-white text-xs rounded" title="Has key handoffs">
                🔑
              </span>
            )}
          </div>
          {showTimeSlot && (
            <span className="text-sm opacity-90">
              {TIME_SLOT_NAMES[timeSlot]}
            </span>
          )}
        </div>
      </div>

      {/* Body */}
      <div className="p-4 space-y-3">
        {/* Volunteer info */}
        {showVolunteer && shift.volunteer && (
          <div className="flex items-center gap-3">
            <Link
              to={`/ops/volunteer/${shift.volunteer.slug}`}
              className="flex items-center gap-3 hover:opacity-80"
            >
              <span
                className={cn(
                  'w-10 h-10 rounded-full flex items-center justify-center text-lg font-semibold',
                  isMyShift ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-600'
                )}
              >
                {shift.volunteer.display_name.charAt(0)}
              </span>
              <div>
                <p className={cn('font-medium', isMyShift && 'text-emerald-700')}>
                  {shift.volunteer.display_name}
                  {isMyShift && <span className="text-xs ml-1">(you)</span>}
                </p>
                {shift.volunteer.phone && (
                  <p className="text-xs text-slate-500">{shift.volunteer.phone}</p>
                )}
              </div>
            </Link>
          </div>
        )}

        {/* Notes */}
        {shift.notes && (
          <div className={cn('text-sm text-slate-600 p-3 rounded-lg', styles.light)}>
            {shift.notes}
          </div>
        )}

        {/* Timeline Preview */}
        {showTimeline && details?.timeline && details.timeline.length > 0 && (
          <div className="space-y-1.5">
            {details.timeline.slice(0, 3).map((item, idx) => (
              <div key={idx} className="flex items-start gap-2 text-sm">
                <span className="text-slate-400 font-mono text-xs min-w-[50px]">
                  {item.time || '•'}
                </span>
                <span className="text-slate-600">{item.task}</span>
              </div>
            ))}
            {details.timeline.length > 3 && (
              <p className="text-xs text-slate-400 pl-[58px]">
                +{details.timeline.length - 3} more steps
              </p>
            )}
          </div>
        )}

        {/* View Details button */}
        {onViewDetails && details && (
          <button
            onClick={() => onViewDetails(shift)}
            className="w-full text-center py-2 text-sm text-emerald-600 hover:text-emerald-700 font-medium hover:bg-emerald-50 rounded-lg transition-colors"
          >
            View full details →
          </button>
        )}

        {/* Status and actions */}
        <div className="flex items-center justify-between pt-2 border-t border-slate-100">
          <div className="flex items-center gap-2">
            {shift.is_confirmed ? (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-emerald-100 text-emerald-700 text-xs font-medium rounded">
                <span>✓</span> Confirmed
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-amber-100 text-amber-700 text-xs font-medium rounded">
                <span>⏳</span> Pending
              </span>
            )}
          </div>

          {/* Confirm/Unconfirm button (only for own shifts) */}
          {isMyShift && (
            <button
              onClick={handleToggleConfirm}
              disabled={isUpdating}
              className={cn(
                'px-3 py-1.5 text-xs font-medium rounded-lg transition-colors',
                shift.is_confirmed
                  ? 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  : 'bg-emerald-600 text-white hover:bg-emerald-700',
                isUpdating && 'opacity-50 cursor-not-allowed'
              )}
            >
              {isUpdating ? '...' : shift.is_confirmed ? 'Unconfirm' : 'Confirm'}
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ShiftCard;
