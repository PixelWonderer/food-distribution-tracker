import React, { useMemo, useState } from 'react';

import { Button } from '@/app/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/app/components/ui/dialog';
import { Input } from '@/app/components/ui/input';

type ShareTrackerDialogProps = {
  open: boolean;
  onClose: () => void;
};

export const ShareTrackerDialog: React.FC<ShareTrackerDialogProps> = ({ open, onClose }) => {
  const shareUrl = useMemo(() => {
    if (typeof window === 'undefined') {
      return 'http://localhost:3000';
    }
    return window.location.origin;
  }, []);

  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch (error) {
      console.warn('Failed to copy link', error);
      setCopied(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(next) => (!next ? onClose() : undefined)}>
      <DialogContent className="max-w-xl gap-3 overflow-hidden rounded-[32px] border border-border/60 bg-gradient-to-b from-white to-slate-50 p-0 shadow-[0_30px_120px_rgba(15,23,42,0.18)]">
        <DialogHeader className="gap-3 px-8 pb-0 pt-8 text-left">
          <DialogTitle className="text-2xl font-semibold text-foreground">Share Tracker</DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            Copy the link to share with volunteers. Volunteers can view live updates in their
            browser.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-5 px-8">
          <div className="flex flex-col gap-2 rounded-3xl border border-border/60 bg-white/90 p-5 shadow-inner">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Or copy the link</p>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <Input readOnly value={shareUrl} className="flex-1 rounded-xl bg-muted/40 font-mono text-sm" />
              <Button type="button" onClick={handleCopy} className="h-11 rounded-xl px-6">
                {copied ? 'Copied!' : 'Copy'}
              </Button>
            </div>
            <p className="text-xs text-muted-foreground">
              Anyone with this link can view the tracker. Share only with trusted volunteers.
            </p>
          </div>
        </div>

        <DialogFooter className="rounded-b-[32px] border-t border-dashed border-border/70 bg-white/80 px-8 py-4">
          <Button variant="outline" className="rounded-xl" onClick={onClose}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

