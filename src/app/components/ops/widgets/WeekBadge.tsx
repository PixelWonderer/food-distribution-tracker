import React from 'react';
import { cn } from '@/lib/utils';
import { getMonday, formatWeekDate } from '@/types/ops';

interface WeekBadgeProps {
  weekDate: string; // ISO date string of Monday
  showDate?: boolean;
  className?: string;
}

/**
 * Badge indicating if a week is past, current, or future
 */
export const WeekBadge: React.FC<WeekBadgeProps> = ({
  weekDate,
  showDate = true,
  className
}) => {
  const status = getWeekStatus(weekDate);

  const colors = {
    past: 'bg-slate-100 text-slate-600 border-slate-200',
    current: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    future: 'bg-blue-100 text-blue-700 border-blue-200',
  };

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <span
        className={cn(
          'px-2 py-0.5 text-xs font-medium rounded-full border',
          colors[status.type]
        )}
      >
        {status.label}
      </span>
      {showDate && (
        <span className="text-sm text-slate-500">
          Week of {formatWeekDate(weekDate)}
        </span>
      )}
    </div>
  );
};

/**
 * Determine if a week is past, current, or future relative to today
 */
export function getWeekStatus(weekDate: string): {
  type: 'past' | 'current' | 'future';
  label: string;
  weeksAway: number;
} {
  const selectedMonday = new Date(weekDate);
  const currentMonday = getMonday(new Date());

  // Normalize to midnight for accurate comparison
  selectedMonday.setHours(0, 0, 0, 0);
  currentMonday.setHours(0, 0, 0, 0);

  const diffMs = selectedMonday.getTime() - currentMonday.getTime();
  const diffWeeks = Math.round(diffMs / (7 * 24 * 60 * 60 * 1000));

  if (diffWeeks === 0) {
    return { type: 'current', label: 'This Week', weeksAway: 0 };
  } else if (diffWeeks < 0) {
    const absWeeks = Math.abs(diffWeeks);
    const label = absWeeks === 1 ? 'Last Week' : `${absWeeks} weeks ago`;
    return { type: 'past', label, weeksAway: diffWeeks };
  } else {
    const label = diffWeeks === 1 ? 'Next Week' : `In ${diffWeeks} weeks`;
    return { type: 'future', label, weeksAway: diffWeeks };
  }
}

export default WeekBadge;
