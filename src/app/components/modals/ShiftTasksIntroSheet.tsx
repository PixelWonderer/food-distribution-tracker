import React from 'react';

import { Button } from '@/app/components/ui/button';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/app/components/ui/sheet';
import { useAppStore } from '@/services/state';

type ShiftTasksIntroSheetProps = {
  open: boolean;
  onClose: () => void;
};

export const ShiftTasksIntroSheet: React.FC<ShiftTasksIntroSheetProps> = ({ open, onClose }) => {
  const updatePreference = useAppStore((state) => state.updatePreference);

  const handleEnable = () => {
    updatePreference('showShiftTasks', true);
    updatePreference('hasSeenShiftTasksIntro', true);
    onClose();
  };

  const handleDismiss = () => {
    updatePreference('hasSeenShiftTasksIntro', true);
    onClose();
  };

  return (
    <Sheet open={open} onOpenChange={(next) => (!next ? handleDismiss() : undefined)}>
      <SheetContent
        side="bottom"
        className="max-h-[90vh] gap-4 overflow-y-auto rounded-t-[32px] border-border/70 bg-card p-4 shadow-[0_-28px_90px_rgba(15,23,42,0.16)]"
      >
        <SheetHeader className="gap-1">
          <div className="mx-auto h-1 w-12 rounded-full bg-muted" aria-hidden />
          <SheetTitle className="text-lg font-semibold text-foreground">
            New: Shift Tasks
          </SheetTitle>
          <SheetDescription className="text-sm text-muted-foreground">
            Recurring reminders that appear in the Pickup tab
          </SheetDescription>
        </SheetHeader>

        <div className="flex flex-col gap-4 pt-2">
          <div className="rounded-2xl border border-[#F8D979]/70 bg-[#FFF5D1]/60 p-4">
            <p className="text-sm text-slate-700 leading-relaxed">
              Shift tasks are reminders for volunteers doing{' '}
              <span className="font-semibold">Partner Group 6 distribution</span> — things
              like preparing Partner 11's items, checking supplies, and making deliveries.
            </p>
            <p className="mt-2 text-sm text-slate-700 leading-relaxed">
              If you help with Partner Group 6 distribution, enable this to see task
              checklists in your Pickup tab.
            </p>
          </div>

          <div className="flex flex-col gap-2">
            <Button
              onClick={handleEnable}
              className="w-full rounded-xl py-3 text-sm font-semibold"
            >
              I do Partner Group 6 distribution
            </Button>
            <Button
              variant="ghost"
              onClick={handleDismiss}
              className="w-full text-muted-foreground"
            >
              Not relevant to me
            </Button>
          </div>

          <p className="text-center text-xs text-muted-foreground">
            You can change this anytime in Quick Actions (3-dot menu)
          </p>
        </div>
      </SheetContent>
    </Sheet>
  );
};
