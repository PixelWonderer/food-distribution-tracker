import * as React from 'react';
import { cn } from '@/lib/utils';

type RouteTagProps = {
  /** True for direct-pickup destinations (Partner Group 1, Partner Group 2, Partner Group 3) — skip storage. */
  direct: boolean;
  size?: 'sm' | 'default';
  className?: string;
};

/**
 * Explicit chip for the direct-vs-indirect distinction — the single design
 * fix for the most common warehouse confusion ("should I store this or
 * leave it on the pallet?"). Direct destinations render a saffron-bar
 * outlined chip; indirect render a slate "Storage" chip.
 *
 * Pair with a saffron left gutter on direct destination cards to complete
 * the wayfinding signal — see <DestinationGutter>.
 */
export const RouteTag: React.FC<RouteTagProps> = ({
  direct,
  size = 'sm',
  className,
}) => {
  const height = size === 'sm' ? 'h-5' : 'h-[26px]';
  const fontSize = size === 'sm' ? 'text-[10px]' : 'text-[11px]';

  if (direct) {
    return (
      <span
        className={cn(
          'inline-flex items-center gap-1 rounded-[6px] pl-1.5 pr-2 font-bold uppercase',
          height,
          fontSize,
          className
        )}
        style={{
          background: '#FFF7DB',
          color: 'var(--saffron-deep, #C99B00)',
          letterSpacing: '0.06em',
          boxShadow: 'inset 3px 0 0 var(--secondary, #F5C422)',
        }}
      >
        <span aria-hidden="true">→</span>
        Direct
      </span>
    );
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-[6px] px-2 font-semibold uppercase',
        height,
        fontSize,
        className
      )}
      style={{
        background: '#F0F2F6',
        color: '#373B4F',
        letterSpacing: '0.04em',
      }}
    >
      <span aria-hidden="true" className="opacity-60">
        ⊡
      </span>
      Storage
    </span>
  );
};

type RouteGutterProps = {
  direct: boolean;
  className?: string;
};

/**
 * The saffron left gutter that signals "this destination skips storage."
 * Apply to a destination card's container so the card has position:relative.
 */
export const RouteGutter: React.FC<RouteGutterProps> = ({ direct, className }) => {
  if (!direct) return null;
  return (
    <span
      aria-hidden="true"
      className={cn('pointer-events-none absolute inset-y-0 left-0 w-1', className)}
      style={{ background: 'var(--secondary, #F5C422)' }}
    />
  );
};
