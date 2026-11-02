import React, { createContext, useContext, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { XIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

type DialogContextValue = {
  open: boolean;
  onOpenChange?: (open: boolean) => void;
};

const DialogContext = createContext<DialogContextValue | null>(null);

export type DialogProps = React.PropsWithChildren<{
  open: boolean;
  onOpenChange?: (open: boolean) => void;
}>;

const Dialog: React.FC<DialogProps> = ({ open, onOpenChange, children }) => {
  const value = useMemo(() => ({ open, onOpenChange }), [open, onOpenChange]);
  return <DialogContext.Provider value={value}>{children}</DialogContext.Provider>;
};

const useDialogContext = () => {
  const context = useContext(DialogContext);
  if (!context) {
    throw new Error('Dialog components must be used within <Dialog>.');
  }
  return context;
};

export type DialogContentProps = React.HTMLAttributes<HTMLDivElement> & {
  centreContent?: boolean;
};

const DialogContent: React.FC<DialogContentProps> = ({ className, children, centreContent = true, ...props }) => {
  const { open, onOpenChange } = useDialogContext();
  const contentRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) {
      return undefined;
    }

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onOpenChange?.(false);
      }
    };

    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [open, onOpenChange]);

  useEffect(() => {
    if (!open || !contentRef.current) {
      return undefined;
    }

    const previouslyFocused = document.activeElement as HTMLElement | null;
    contentRef.current.focus({ preventScroll: true });

    return () => {
      previouslyFocused?.focus?.({ preventScroll: true });
    };
  }, [open]);

  if (!open || typeof document === 'undefined') {
    return null;
  }

  const handleClose = () => onOpenChange?.(false);

  const overlay = (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" onClick={handleClose} />
  );

  const content = (
    <div
      ref={contentRef}
      tabIndex={-1}
      role="dialog"
      aria-modal="true"
      className={cn(
        'fixed z-50 grid w-full max-w-lg gap-6 rounded-3xl border border-border/60 bg-card p-6 shadow-2xl outline-none transition-transform duration-200',
        centreContent ? 'left-1/2 top-1/2 translate-x-[-50%] translate-y-[-50%]' : '',
        className
      )}
      {...props}
    >
      {children}
      <button
        type="button"
        className="absolute right-5 top-5 inline-flex size-9 items-center justify-center rounded-full border border-transparent bg-muted/60 text-muted-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background"
        onClick={handleClose}
        aria-label="Close dialog"
      >
        <XIcon className="size-4" />
      </button>
    </div>
  );

  return createPortal(
    <>
      {overlay}
      {content}
    </>,
    document.body
  );
};

const DialogHeader: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, ...props }) => (
  <div data-slot="dialog-header" className={cn('flex flex-col gap-2 text-left', className)} {...props} />
);

const DialogFooter: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, ...props }) => (
  <div data-slot="dialog-footer" className={cn('flex flex-col-reverse gap-2 sm:flex-row sm:justify-end', className)} {...props} />
);

const DialogTitle: React.FC<React.HTMLAttributes<HTMLHeadingElement>> = ({ className, ...props }) => (
  <h3 data-slot="dialog-title" className={cn('text-xl font-semibold text-foreground', className)} {...props} />
);

const DialogDescription: React.FC<React.HTMLAttributes<HTMLParagraphElement>> = ({ className, ...props }) => (
  <p data-slot="dialog-description" className={cn('text-sm text-muted-foreground', className)} {...props} />
);

const DialogTrigger: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({ className, ...props }) => (
  <button data-slot="dialog-trigger" className={cn('inline-flex items-center', className)} {...props} />
);

const DialogClose: React.FC<React.ButtonHTMLAttributes<HTMLButtonElement>> = ({ className, ...props }) => {
  const { onOpenChange } = useDialogContext();
  return (
    <button
      data-slot="dialog-close"
      className={cn('inline-flex items-center', className)}
      onClick={(event) => {
        props.onClick?.(event);
        onOpenChange?.(false);
      }}
      {...props}
    />
  );
};

const DialogOverlay: React.FC<React.HTMLAttributes<HTMLDivElement>> = ({ className, ...props }) => {
  const { open } = useDialogContext();

  if (!open || typeof document === 'undefined') {
    return null;
  }

  return createPortal(
    <div className={cn('fixed inset-0 z-40 bg-black/50 backdrop-blur-sm', className)} {...props} />, document.body
  );
};

export {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogOverlay,
  DialogTitle,
  DialogTrigger,
};
