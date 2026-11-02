import React from 'react';

import { Dialog, DialogClose, DialogContent, DialogProps, DialogTrigger, type DialogContentProps } from './dialog';
import { cn } from '@/lib/utils';

type SheetSide = 'top' | 'right' | 'bottom' | 'left';

type SheetProps = DialogProps;

const Sheet: React.FC<SheetProps> = (props) => <Dialog {...props} />;

const SheetTrigger = DialogTrigger;

const SheetClose = DialogClose;

type SheetContentProps = DialogContentProps & {
  side?: SheetSide;
};

const SheetContent: React.FC<SheetContentProps> = ({ side = 'right', className, children, ...props }) => {
  const sideClasses: Record<SheetSide, string> = {
    right: 'inset-y-0 right-0 translate-x-0 rounded-none border-l border-border/60 max-w-sm',
    left: 'inset-y-0 left-0 translate-x-0 rounded-none border-r border-border/60 max-w-sm',
    top: 'inset-x-0 top-0 translate-y-0 rounded-none border-b border-border/60 max-w-full',
    bottom: 'inset-x-0 bottom-0 translate-y-0 rounded-none border-t border-border/60 max-w-full',
  };

  return (
    <DialogContent
      centreContent={false}
      className={cn(
        'fixed flex h-auto w-full max-w-none flex-col gap-4 bg-card p-6 shadow-2xl transition-transform duration-200',
        sideClasses[side],
        className
      )}
      {...props}
    >
      {children}
    </DialogContent>
  );
};

const SheetHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, ...props }) => (
  <div data-slot="sheet-header" className={cn('flex flex-col gap-1.5', className)} {...props} />
);

const SheetFooter: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, ...props }) => (
  <div data-slot="sheet-footer" className={cn('mt-auto flex flex-col gap-3', className)} {...props} />
);

const SheetTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({ className, ...props }) => (
  <h3 data-slot="sheet-title" className={cn('text-lg font-semibold text-foreground', className)} {...props} />
);

const SheetDescription: React.FC<React.HTMLAttributes<HTMLParagraphElement>> = ({ className, ...props }) => (
  <p data-slot="sheet-description" className={cn('text-sm text-muted-foreground', className)} {...props} />
);

export { Sheet, SheetTrigger, SheetClose, SheetContent, SheetHeader, SheetFooter, SheetTitle, SheetDescription };
