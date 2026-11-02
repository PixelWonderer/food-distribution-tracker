import * as React from 'react';
import { cva, type VariantProps } from 'class-variance-authority';

import { cn } from '@/lib/utils';

const iconButtonVariants = cva(
  'inline-flex items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50',
  {
    variants: {
      variant: {
        ghost: 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
        subtle: 'bg-muted text-muted-foreground hover:bg-muted/80',
        solid: 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm',
      },
      size: {
        sm: 'h-9 w-9 text-sm',
        md: 'h-10 w-10 text-base',
      },
      bordered: {
        true: 'border border-border',
        false: '',
      },
    },
    defaultVariants: {
      variant: 'ghost',
      size: 'md',
      bordered: false,
    },
  }
);

type IconButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> &
  VariantProps<typeof iconButtonVariants>;

const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ className, variant, size, bordered, ...props }, ref) => {
    return (
      <button
        ref={ref}
        type="button"
        className={cn(iconButtonVariants({ variant, size, bordered }), className)}
        {...props}
      />
    );
  }
);
IconButton.displayName = 'IconButton';

export { IconButton, iconButtonVariants };
