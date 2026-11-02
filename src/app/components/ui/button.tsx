import * as React from 'react';
import { Slot } from '@radix-ui/react-slot';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const buttonVariants = cva(
  'inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-md text-sm font-medium transition-all disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg:not([class*="size-"])]:size-4 shrink-0 [&_svg]:shrink-0 outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 aria-invalid:border-destructive',
  {
    variants: {
      variant: {
        default:
          'bg-primary text-primary-foreground shadow-[0_4px_12px_rgba(79,70,255,0.24),inset_0_1px_0_rgba(255,255,255,0.18)] hover:bg-primary/90 active:scale-[0.98]',
        destructive:
          'bg-destructive text-white hover:bg-destructive/90 focus-visible:ring-destructive/20',
        outline:
          'border bg-background text-foreground hover:bg-accent hover:text-accent-foreground',
        secondary:
          'bg-secondary text-secondary-foreground shadow-[0_4px_12px_rgba(245,196,34,0.30),inset_0_1px_0_rgba(255,255,255,0.25)] hover:bg-secondary/90 active:scale-[0.98]',
        ghost: 'hover:bg-accent hover:text-accent-foreground',
        link: 'text-primary underline-offset-4 hover:underline',
        confirm:
          'bg-[#0F7A4F] text-white shadow-[0_4px_12px_rgba(15,122,79,0.24)] hover:bg-[#0D6A44] active:scale-[0.98]',
        danger:
          'border border-[#F8B8C5] bg-white text-[#E11D48] shadow-[0_1px_2px_rgba(14,16,32,0.06)] hover:bg-[#FFE4E9] active:scale-[0.98]',
      },
      size: {
        // Warehouse-touch sizing: 32 / 44 / 52 — 44pt is the one-handed thumb minimum
        default: 'h-11 rounded-[12px] px-4 py-2 has-[>svg]:px-3',
        sm: 'h-8 rounded-[10px] gap-1.5 px-3 has-[>svg]:px-2.5',
        lg: 'h-[52px] rounded-[14px] px-6 text-base has-[>svg]:px-4',
        icon: 'size-11 rounded-[12px]',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
);

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof buttonVariants> & {
    asChild?: boolean;
  };

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button';

    return (
      <Comp
        ref={ref}
        data-slot="button"
        className={cn(buttonVariants({ variant, size }), className)}
        {...props}
      />
    );
  }
);
Button.displayName = 'Button';

export { Button, buttonVariants };
