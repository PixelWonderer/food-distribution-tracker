import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

/**
 * Chip — pill-shaped tag/toggle using the design's intentional token palette.
 * Tones map to the Warm Operational Clarity design system, not generic Tailwind
 * palette families. "Active" renders a slightly stronger variant of the same
 * tone (not a saturated white-text pill).
 */
const chipVariants = cva(
  [
    'inline-flex items-center justify-center gap-2 rounded-full border font-semibold transition-colors',
    'shadow-[0_1px_2px_rgba(14,16,32,0.06),0_1px_1px_rgba(14,16,32,0.04)]',
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
    'disabled:pointer-events-none disabled:opacity-50',
  ].join(' '),
  {
    variants: {
      tone: {
        // Slate — the neutral / substrate tone (design's default)
        slate:
          'border-[#E2E5EC] bg-[#F0F2F6] text-[#373B4F] hover:bg-[#E6E8EF] data-[state=active]:border-[#9498A8] data-[state=active]:bg-[#0E1020] data-[state=active]:text-white',
        // Alias for slate — kept for backwards compatibility
        neutral:
          'border-[#E2E5EC] bg-white text-[#6B6F82] hover:bg-[#F6F7FA] data-[state=active]:border-[#C8CCD8] data-[state=active]:bg-[#F0F2F6] data-[state=active]:text-[#0E1020]',
        // Indigo — action / mode-selector active
        indigo:
          'border-[#CFC9FF] bg-[#E8E6FF] text-[#3B33D4] hover:bg-[#DED9FF] data-[state=active]:border-[#C7C1FF] data-[state=active]:bg-[#DCD6FF] data-[state=active]:text-[#3B33D4]',
        // Saffron — weekly rhythm / imports / banking
        saffron:
          'border-[#F8D979] bg-[#FFF5D1] text-[#C99B00] hover:bg-[#FBEBAF] data-[state=active]:border-[#E5B400] data-[state=active]:bg-[#F5C422] data-[state=active]:text-[#1A1500]',
        // Mint — done / confirmed / success
        mint:
          'border-[#A7F0CA] bg-[#E9FFF4] text-[#0F7A4F] hover:bg-[#D6FCE6] data-[state=active]:border-[#7DDDB0] data-[state=active]:bg-[#C6F5D9] data-[state=active]:text-[#0F7A4F]',
        // Peach — ran-low / warning (warmer than rose)
        peach:
          'border-[#FFCFAC] bg-[#FFF4ED] text-[#B75A28] hover:bg-[#FFE6D4] data-[state=active]:border-[#FFAD7A] data-[state=active]:bg-[#FFDCC0] data-[state=active]:text-[#B75A28]',
        // Rose — below-par / destructive cue (not full danger)
        rose:
          'border-[#F8B8C5] bg-[#FFE4E9] text-[#E11D48] hover:bg-[#FFD1DA] data-[state=active]:border-[#F285A0] data-[state=active]:bg-[#FFC4CF] data-[state=active]:text-[#E11D48]',
        // Amber — caution / sync-delayed
        amber:
          'border-[#F5C988] bg-[#FFF0D1] text-[#D97706] hover:bg-[#FFE5AD] data-[state=active]:border-[#E8A64F] data-[state=active]:bg-[#FFDFA0] data-[state=active]:text-[#D97706]',
        // Lavender — pending / default quantity tone (from the pastel signature)
        lavender:
          'border-[#D8CBFF] bg-[#E9DEFF] text-[#5B44C3] hover:bg-[#DCCDFF] data-[state=active]:border-[#C6B9FF] data-[state=active]:bg-[#D6C6FF] data-[state=active]:text-[#4431A8]',
        // Back-compat aliases — old code used these names
        purple:
          'border-[#D8CBFF] bg-[#E9DEFF] text-[#5B44C3] hover:bg-[#DCCDFF] data-[state=active]:border-[#C6B9FF] data-[state=active]:bg-[#D6C6FF] data-[state=active]:text-[#4431A8]',
        gold:
          'border-[#F8D979] bg-[#FFF5D1] text-[#C99B00] hover:bg-[#FBEBAF] data-[state=active]:border-[#E5B400] data-[state=active]:bg-[#F5C422] data-[state=active]:text-[#1A1500]',
      },
      density: {
        // Touch-friendly default for warehouse use (44pt minimum)
        default: 'min-h-11 px-5 py-2.5 text-sm',
        // Compact — for horizontal-scroll filter rows where row itself is the hit target
        compact: 'min-h-7 px-3 py-1 text-[11px]',
        // Tag — inline status tag, no touch target
        tag: 'h-6 px-2.5 py-0 text-[11px] tracking-[0.01em]',
      },
    },
    defaultVariants: {
      tone: 'neutral',
      density: 'default',
    },
  }
);

export type ChipTone = NonNullable<VariantProps<typeof chipVariants>['tone']>;

type ChipProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof chipVariants> & {
    active?: boolean;
  };

const Chip = React.forwardRef<HTMLButtonElement, ChipProps>(
  ({ className, tone, density, active = false, ...props }, ref) => {
    return (
      <button
        ref={ref}
        type="button"
        data-state={active ? 'active' : 'inactive'}
        className={cn(chipVariants({ tone, density }), className)}
        {...props}
      />
    );
  }
);
Chip.displayName = 'Chip';

export { Chip, chipVariants };
