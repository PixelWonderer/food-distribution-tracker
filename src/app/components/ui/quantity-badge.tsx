import * as React from 'react';

import { cn } from '@/lib/utils';
import { formatQuantity, type QuantityFormatOptions } from '@/app/utils/quantity';

const toneStyles: Record<
  NonNullable<QuantityBadgeProps['tone']>,
  string
> = {
  neutral:
    'border-slate-200 bg-slate-50 text-slate-600 data-[variant=solid]:border-slate-300 data-[variant=solid]:bg-slate-100 data-[variant=solid]:text-slate-700',
  lavender:
    'border-[#d8cbff] bg-[#e9deff] text-[#5b44c3] data-[variant=solid]:border-[#c6b9ff] data-[variant=solid]:bg-[#dccfff] data-[variant=solid]:text-[#4431a8]',
  mint:
    'border-[#a7f0ca] bg-[#e9fff4] text-[#0f7a4f] data-[variant=solid]:border-[#7de7b1] data-[variant=solid]:bg-[#d9fbe9] data-[variant=solid]:text-[#0e5e3d]',
  peach:
    'border-[#ffcfac] bg-[#fff4ed] text-[#b75a28] data-[variant=solid]:border-[#ffb985] data-[variant=solid]:bg-[#ffe2d0] data-[variant=solid]:text-[#99461b]',
};

type QuantityBadgeProps = {
  quantity: number;
  originalQuantity?: number;
  options?: QuantityFormatOptions;
  tone?: 'lavender' | 'mint' | 'peach' | 'neutral';
  variant?: 'soft' | 'solid';
  className?: string;
};

const QuantityBadge: React.FC<QuantityBadgeProps> = ({
  quantity,
  originalQuantity,
  options,
  tone = 'neutral',
  variant = 'soft',
  className,
}) => {
  const parts = formatQuantity(quantity, options);
  const showStrikethrough = originalQuantity !== undefined && originalQuantity !== quantity;
  const originalParts = showStrikethrough ? formatQuantity(originalQuantity, options) : null;

  return (
    <span
      data-variant={variant}
      className={cn(
        'inline-flex items-baseline gap-1.5 rounded-[14px] border px-3.5 py-1.5 leading-none transition-colors',
        'shadow-[0_1px_2px_rgba(14,16,32,0.06),0_1px_1px_rgba(14,16,32,0.04)]',
        toneStyles[tone],
        className
      )}
    >
      <span className="inline-flex items-baseline gap-1.5">
        <span
          className="font-[700] tabular-nums"
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '1.375rem',
            letterSpacing: '-0.02em',
          }}
        >
          {parts.display}
        </span>
        {showStrikethrough && originalParts ? (
          <span
            className="relative font-semibold opacity-60"
            style={{ fontFamily: 'var(--font-mono)', fontSize: '0.75rem' }}
          >
            <span className="line-through">{originalParts.display}</span>
          </span>
        ) : null}
      </span>
      {parts.unit ? (
        <span className="text-[0.65rem] font-semibold uppercase tracking-[0.08em] opacity-75">
          {parts.unit}
        </span>
      ) : null}
    </span>
  );
};

QuantityBadge.displayName = 'QuantityBadge';

export { QuantityBadge };
