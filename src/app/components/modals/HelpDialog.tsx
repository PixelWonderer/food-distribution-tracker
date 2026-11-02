import React from 'react';

import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/app/components/ui/dialog';
import { Button } from '@/app/components/ui/button';
import { cn } from '@/lib/utils';

type HelpDialogProps = {
  open: boolean;
  onClose: () => void;
  onStartTutorial?: () => void;
};

const PHASES = [
  {
    icon: '✅',
    title: '1. Confirmation Phase',
    body: [
      'Check off items as they arrive from pickup',
      'Tap checkbox to confirm each item type',
      'Mark "Expected" if quantity matches',
      'Mark "Ran out" if item did not arrive',
      'Mark "Ran low" to adjust quantity',
      'Use tabs to switch between Fridge and Pantry',
    ],
    gradient: 'from-indigo-50 to-indigo-100/60 text-indigo-800 border-indigo-200',
  },
  {
    icon: '📦',
    title: '2. Storage Phase',
    body: [
      'Check off items as they are put away',
      '🥶 Fridge items go in refrigerator',
      '📦 Pantry items go on tables/shelves',
      'Check off each item as you store it',
      'Completed items move to bottom',
    ],
    gradient: 'from-purple-50 to-purple-100/60 text-purple-800 border-purple-200',
  },
  {
    icon: '🚚',
    title: '3. Pickup Phase',
    body: [
      'Check off items as volunteers pick them up',
      'Items are organized by destination',
      'Tap destination chip to jump to section',
      'Check off items as they are distributed',
      'Completed destinations move to right',
    ],
    gradient: 'from-red-50 to-red-100/60 text-red-800 border-red-200',
  },
  {
    icon: '🔐',
    title: 'Door Unlock',
    body: [
      'Use the 🔐 button in Quick Actions to unlock the warehouse door',
      'Enter your door username and password',
      'Credentials are saved locally on your device',
      'Works from any location via secure tunnel',
      'Contact your coordinator if the unlock service is down',
    ],
    gradient: 'from-emerald-50 to-emerald-100/60 text-emerald-800 border-emerald-200',
  },
];

export const HelpDialog: React.FC<HelpDialogProps> = ({ open, onClose, onStartTutorial }) => {
  return (
    <Dialog open={open} onOpenChange={(next) => (!next ? onClose() : undefined)}>
      <DialogContent className="max-w-2xl gap-0 overflow-hidden rounded-[32px] border-none bg-gradient-to-b from-white to-slate-50 p-0 shadow-[0_30px_120px_rgba(15,23,42,0.18)]">
        <DialogHeader className="gap-3 px-8 pb-4 pt-8 text-left">
          <DialogTitle className="text-2xl font-semibold text-foreground">Help & Documentation</DialogTitle>
          <DialogDescription className="max-w-lg text-sm text-muted-foreground">
            Quick guide to using the Food Tracker during volunteer shifts. Each phase keeps the team in sync.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 px-8 pb-8">
          {PHASES.map((phase) => (
            <section
              key={phase.title}
              className={cn(
                'rounded-3xl border p-5 shadow-sm backdrop-blur-sm',
                'bg-gradient-to-br',
                phase.gradient
              )}
            >
              <header className="mb-3 flex items-start gap-3">
                <span className="inline-flex size-11 items-center justify-center rounded-xl bg-white/80 text-xl shadow-inner">
                  {phase.icon}
                </span>
                <h3 className="text-lg font-semibold leading-tight">{phase.title}</h3>
              </header>
              <ul className="space-y-1.5 text-sm leading-relaxed text-slate-700">
                {phase.body.map((item) => (
                  <li key={item} className="flex gap-2">
                    <span aria-hidden className="mt-1 text-base">•</span>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <DialogFooter className="rounded-b-[32px] border-t border-dashed border-border/70 bg-white/80 px-8 py-4">
          <div className="flex w-full items-center justify-between gap-3">
            <Button
              variant="outline"
              className="rounded-xl"
              onClick={() => {
                onClose();
                onStartTutorial?.();
              }}
              disabled={!onStartTutorial}
            >
              Take interactive tour
            </Button>
            <Button variant="outline" className="rounded-xl" onClick={onClose}>
            Close
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
