import * as React from 'react';
import { cn } from '@/lib/utils';
import { abbreviateTiming, getTimingTone } from '@/app/utils/timing';

type TimingBadgeProps = {
  timing: string | null | undefined;
  /** Use abbreviated form like "Fri. AM" instead of full "Friday AM" */
  abbreviated?: boolean;
  /** Size variant */
  size?: 'sm' | 'default';
  /** Show the leading colored dot (the wayfinding cue). Default true. */
  dot?: boolean;
  className?: string;
};

/**
 * A colored pill that displays timing information. Each slot has intentional
 * colors (see TIMING_TONES in timing.ts) — these are the Pickup tab's primary
 * wayfinding signal, so they render as inline style for exact fidelity.
 */
export const TimingBadge: React.FC<TimingBadgeProps> = ({
  timing,
  abbreviated = true,
  size = 'sm',
  dot = true,
  className,
}) => {
  if (!timing) return null;

  const tone = getTimingTone(timing);
  const displayText = abbreviated ? abbreviateTiming(timing) : timing;
  const sizeClasses =
    size === 'sm'
      ? 'px-2.5 py-0.5 text-[10px] gap-1.5'
      : 'px-3 py-1 text-xs gap-1.5';

  return (
    <span
      className={cn(
        'inline-flex items-center rounded-full border font-semibold tracking-[0.01em]',
        sizeClasses,
        className
      )}
      style={{ background: tone.bg, borderColor: tone.border, color: tone.text }}
    >
      {dot && (
        <span
          className="inline-block rounded-full"
          style={{
            width: size === 'sm' ? 5 : 6,
            height: size === 'sm' ? 5 : 6,
            background: tone.dot,
          }}
        />
      )}
      {displayText}
    </span>
  );
};
