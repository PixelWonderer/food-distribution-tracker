import React, { useEffect, useState } from 'react';
import { Header } from '../header/Header';
import { TabPanels } from '../tabs/TabPanels';
import { BottomTabBar } from '../tabs/BottomTabBar';
import { ModalHost } from '../modals/ModalHost';
import { RoleSelectionSheet } from '../modals/RoleSelectionSheet';
import { ShiftTasksIntroSheet } from '../modals/ShiftTasksIntroSheet';
import { PickupTabsAnchorProvider } from '@/app/providers/PickupTabsAnchorProvider';
import { useTutorial } from '@/app/hooks/useTutorial';
import { toast } from '@/lib/toast';
import { useAppStore } from '@/services/state';

export const AppShell: React.FC = () => {
  const { shouldSuggestTutorial, startTutorial, resumeOrStartTutorial, hasStoredProgress, isActive } = useTutorial();
  const hasCompletedRoleSetup = useAppStore((state) => state.preferences.hasCompletedRoleSetup);
  const hasSeenShiftTasksIntro = useAppStore((state) => state.preferences.hasSeenShiftTasksIntro);

  // Show role selection sheet for new users who haven't completed setup
  const [showRoleSheet, setShowRoleSheet] = useState(false);
  // Show shift tasks intro after role setup is complete
  const [showShiftTasksIntro, setShowShiftTasksIntro] = useState(false);

  useEffect(() => {
    // Show role selection after a short delay if user hasn't completed setup
    if (!hasCompletedRoleSetup) {
      const timer = window.setTimeout(() => {
        setShowRoleSheet(true);
      }, 800);
      return () => window.clearTimeout(timer);
    }
  }, [hasCompletedRoleSetup]);

  useEffect(() => {
    // Show shift tasks intro after role setup is done and intro hasn't been seen
    if (hasCompletedRoleSetup && !hasSeenShiftTasksIntro && !showRoleSheet) {
      const timer = window.setTimeout(() => {
        setShowShiftTasksIntro(true);
      }, 1000);
      return () => window.clearTimeout(timer);
    }
  }, [hasCompletedRoleSetup, hasSeenShiftTasksIntro, showRoleSheet]);

  useEffect(() => {
    if (isActive) return;
    // First-time visitor with no progress: nudge to start.
    if (shouldSuggestTutorial) {
      const timer = window.setTimeout(() => {
        toast.show({
          message: 'New here? Try the interactive tutorial in Quick Actions.',
          type: 'info',
          action: { label: 'Start', callback: () => startTutorial('demo') },
        });
      }, 1200);
      return () => window.clearTimeout(timer);
    }
    // Returning visitor with partial progress: offer to resume.
    if (hasStoredProgress) {
      const timer = window.setTimeout(() => {
        toast.show({
          message: 'Pick up the tutorial where you left off?',
          type: 'info',
          action: { label: 'Resume', callback: () => resumeOrStartTutorial('demo') },
        });
      }, 1500);
      return () => window.clearTimeout(timer);
    }
  }, [hasStoredProgress, isActive, resumeOrStartTutorial, shouldSuggestTutorial, startTutorial]);

  return (
    <PickupTabsAnchorProvider>
      <div
        data-app-shell
        className="relative mx-auto flex h-full min-h-screen w-full flex-col bg-gradient-to-b from-white via-slate-50 to-white md:min-h-[720px] md:max-w-[440px] md:rounded-[32px] md:border md:border-border/60 md:shadow-[0_40px_120px_rgba(15,23,42,0.16)]"
      >
        <main
          id="main-content"
          className="flex-1 overflow-y-auto overflow-x-hidden bg-gradient-to-b from-transparent via-slate-50/60 to-white md:rounded-[32px]"
          aria-label="Food Tracker"
        >
          <Header />
          <div className="space-y-4 px-4 pb-24">
            <TabPanels />
          </div>
        </main>
        <BottomTabBar />
      </div>
      <ModalHost />
      <RoleSelectionSheet open={showRoleSheet} onClose={() => setShowRoleSheet(false)} />
      <ShiftTasksIntroSheet open={showShiftTasksIntro} onClose={() => setShowShiftTasksIntro(false)} />
    </PickupTabsAnchorProvider>
  );
};
