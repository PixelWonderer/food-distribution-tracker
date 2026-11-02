import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { tutorialSteps } from '@/app/components/tutorial/tutorialSteps';
import { StorageService } from '@/services/storage';
import { useAppStore } from '@/services/state';
import type { TutorialMode } from '@/types/tutorial';
import { triggerMiniConfetti } from '@/utils/confetti';

import { TutorialContext, type TutorialContextValue } from './TutorialContext';

const SUCCESS_MESSAGE_DURATION = 1400; // ms — short enough to feel responsive after a real tap

/**
 * Interactive tutorial controller. Owns the state machine that drives the
 * volunteer through the real app:
 *   - flips to the right tab before each step
 *   - tracks completion + persists progress (resumes on reload + Quick Actions)
 *   - listens for the expected DOM action on `interactive` steps and advances
 *   - swallows wrong clicks during interactive steps so the user can't blow
 *     past a step by tapping the wrong thing
 *   - reports when the spotlight target can't be found so the overlay can
 *     fail-soft instead of getting stuck
 *
 * Demo mode is toggled to swap real data for samples while the tour runs;
 * AppBootstrap subscribes to `isDemoMode` and handles the data swap (and
 * restore on exit). The context is exported from a separate module so Vite
 * Fast Refresh can preserve state across edits.
 */
export const TutorialProvider: React.FC<React.PropsWithChildren> = ({ children }) => {
  const steps = useMemo(() => tutorialSteps, []);

  const [isActive, setIsActive] = useState(false);
  const [mode, setMode] = useState<TutorialMode>('demo');
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [hasCompletedTutorial, setHasCompletedTutorial] = useState(false);
  const [hasStoredProgress, setHasStoredProgress] = useState(false);
  const [storedStepIndex, setStoredStepIndex] = useState(0);
  const [isWaitingForAction, setIsWaitingForAction] = useState(false);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [wrongClickCount, setWrongClickCount] = useState(0);
  const [spotlightMissing, setSpotlightMissing] = useState(false);

  const { currentTab, setCurrentTab, setDemoMode } = useAppStore((state) => ({
    currentTab: state.currentTab,
    setCurrentTab: state.setCurrentTab,
    setDemoMode: state.setDemoMode,
  }));

  const storage = useMemo(() => StorageService.getInstance(), []);
  const successTimeoutRef = useRef<number | null>(null);

  const currentStep = steps[currentStepIndex] ?? null;
  const currentPhase = currentStep?.phase ?? null;

  // Boot: load completion + progress, then maybe auto-start. One unified effect
  // (vs. the two we had before) so there's no race where progress-load sets
  // stepIndex 5 and the auto-start effect immediately clobbers it back to 0.
  useEffect(() => {
    const completed = storage.loadTutorialCompletion();
    setHasCompletedTutorial(completed);

    const progress = storage.loadTutorialProgress() as Partial<{ stepIndex: number; stepId: string; mode: TutorialMode }> | null;
    let resumeIndex = 0;
    if (progress) {
      setHasStoredProgress(true);
      if (typeof progress.stepIndex === 'number' && progress.stepIndex >= 0 && progress.stepIndex < steps.length) {
        resumeIndex = progress.stepIndex;
      } else if (progress.stepId) {
        const idx = steps.findIndex((s) => s.id === progress.stepId);
        if (idx >= 0) resumeIndex = idx;
      }
      setStoredStepIndex(resumeIndex);
      if (progress.mode === 'demo' || progress.mode === 'live') {
        setMode(progress.mode);
      }
    }

    if (typeof window === 'undefined') return;
    if (new URLSearchParams(window.location.search).get('tutorial') !== 'true') return;

    // Auto-start. If completed, restart from 0 (replay). If a partial progress
    // exists and we haven't completed, resume where we left off. Activate
    // synchronously rather than after a 500ms timeout — Gemini v2 #1 caught
    // a brief "empty Confirm tab" flash during the delay window.
    const startIndex = !completed && progress ? resumeIndex : 0;
    setCurrentStepIndex(startIndex);
    setIsActive(true);
  }, [storage, steps]);

  const persist = useCallback((nextIndex: number, nextMode: TutorialMode, completed?: boolean) => {
    storage.saveTutorialProgress({ stepIndex: nextIndex, mode: nextMode });
    setHasStoredProgress(true);
    setStoredStepIndex(nextIndex);
    if (typeof completed === 'boolean') storage.saveTutorialCompletion(completed);
  }, [storage]);

  const dismissSuccess = useCallback(() => {
    setShowSuccessMessage(false);
    setSuccessMessage(null);
    if (successTimeoutRef.current) {
      window.clearTimeout(successTimeoutRef.current);
      successTimeoutRef.current = null;
    }
  }, []);

  const startTutorial = useCallback((nextMode: TutorialMode = 'demo', startStepIndex: number | null = null) => {
    setMode(nextMode);
    const startIdx = startStepIndex != null
      ? Math.max(0, Math.min(startStepIndex, steps.length - 1))
      : 0;
    setCurrentStepIndex(startIdx);
    setIsActive(true);
    setIsWaitingForAction(false);
    setSpotlightMissing(false);
    dismissSuccess();
    persist(startIdx, nextMode, false);
  }, [dismissSuccess, persist, steps]);

  /**
   * Smart entry point used by Quick Actions / Help dialog: resume where the
   * user left off if they have stored progress, otherwise start fresh. Avoids
   * the prior behaviour where invoking the tutorial from Quick Actions
   * silently wiped saved progress back to step 0.
   */
  const resumeOrStartTutorial = useCallback((nextMode: TutorialMode = 'demo') => {
    if (hasStoredProgress && !hasCompletedTutorial && storedStepIndex > 0) {
      startTutorial(nextMode, storedStepIndex);
    } else {
      startTutorial(nextMode, 0);
    }
  }, [hasCompletedTutorial, hasStoredProgress, startTutorial, storedStepIndex]);

  const skipTutorial = useCallback(() => {
    setIsActive(false);
    setIsWaitingForAction(false);
    setSpotlightMissing(false);
    dismissSuccess();
    persist(currentStepIndex, mode);
  }, [currentStepIndex, dismissSuccess, mode, persist]);

  const completeTutorial = useCallback(() => {
    // Confetti is already fired the moment the completion modal mounted (see
    // TutorialOverlay). By the time the user taps "Start my shift" to dismiss,
    // the celebration has been on-screen — re-firing here would stack a second
    // burst on the now-empty app, which reads as glitchy.
    setIsActive(false);
    setIsWaitingForAction(false);
    setSpotlightMissing(false);
    setHasCompletedTutorial(true);
    dismissSuccess();
    persist(0, mode, true);
  }, [dismissSuccess, mode, persist]);

  const nextStep = useCallback(() => {
    setIsWaitingForAction(false);
    setSpotlightMissing(false);
    dismissSuccess();
    setCurrentStepIndex((prev) => {
      if (prev >= steps.length - 1) {
        // Last step — completion handled by the modal CTA via completeTutorial().
        return prev;
      }
      const next = prev + 1;
      const prevPhase = steps[prev]?.phase;
      const nextPhase = steps[next]?.phase;
      if (prevPhase && nextPhase && prevPhase !== nextPhase) {
        // Mini-confetti on phase transition — celebrates progress without overwhelming
        window.setTimeout(() => triggerMiniConfetti(), 80);
      }
      persist(next, mode);
      return next;
    });
  }, [dismissSuccess, mode, persist, steps]);

  const previousStep = useCallback(() => {
    setIsWaitingForAction(false);
    setSpotlightMissing(false);
    dismissSuccess();
    setCurrentStepIndex((prev) => {
      const next = Math.max(0, prev - 1);
      persist(next, mode);
      return next;
    });
  }, [dismissSuccess, mode, persist]);

  const goToStep = useCallback((stepId: string) => {
    const idx = steps.findIndex((s) => s.id === stepId);
    if (idx < 0) return;
    setIsWaitingForAction(false);
    setSpotlightMissing(false);
    dismissSuccess();
    setCurrentStepIndex(idx);
    persist(idx, mode);
  }, [dismissSuccess, mode, persist, steps]);

  const reportSpotlightMissing = useCallback((missing: boolean) => {
    setSpotlightMissing(missing);
  }, []);

  // Demo mode — when the tutorial is active in demo mode, swap real data for
  // sample data. AppBootstrap handles the swap and restore.
  useEffect(() => {
    setDemoMode(isActive && mode === 'demo', mode);
  }, [isActive, mode, setDemoMode]);

  // Tab routing — flip to the required tab whenever the active step demands it
  useEffect(() => {
    if (!isActive || !currentStep) return;
    if (currentStep.requiredTab && currentTab !== currentStep.requiredTab) {
      setCurrentTab(currentStep.requiredTab);
    }
  }, [currentStep, currentTab, isActive, setCurrentTab]);

  // Mark interactive steps as waiting; clear otherwise
  useEffect(() => {
    if (!isActive || !currentStep) return;
    setIsWaitingForAction(currentStep.type === 'interactive' && Boolean(currentStep.waitForAction));
  }, [currentStep, isActive]);

  // Action listener — wait for the user to click the expected real DOM element,
  // then advance with a short success message
  useEffect(() => {
    if (!isActive || !currentStep || !isWaitingForAction || !currentStep.waitForAction) return;
    const { selector } = currentStep.waitForAction;

    let target: HTMLElement | null = null;
    let attempts = 0;
    let pollTimer: number | null = null;

    const findTarget = (): HTMLElement | null => {
      if (selector.startsWith('[') || selector.startsWith('.') || selector.startsWith('#')) {
        try {
          const el = document.querySelector(selector);
          return el instanceof HTMLElement ? el : null;
        } catch {
          return null;
        }
      }
      let el = document.querySelector(`[data-tutorial-id="${selector}"]`);
      if (!(el instanceof HTMLElement)) {
        el = document.querySelector(`[data-tutorial="${selector}"]`);
      }
      return el instanceof HTMLElement ? el : null;
    };

    const onCorrectClick = () => {
      // Show success and advance after a brief moment so the user sees the state change.
      if (currentStep.successMessage) {
        setSuccessMessage(currentStep.successMessage);
        setShowSuccessMessage(true);
      }
      triggerMiniConfetti();
      // Steps with a `postSuccessDelayMs` override get a longer "soak" so the
      // user can see the post-action UI (e.g. the now-open Quick Actions
      // sheet) before being whisked to the next step.
      const delay = currentStep.postSuccessDelayMs
        ?? (currentStep.successMessage ? SUCCESS_MESSAGE_DURATION : 200);
      successTimeoutRef.current = window.setTimeout(() => {
        nextStep();
      }, delay);
    };

    const attach = (node: HTMLElement) => {
      target = node;
      node.addEventListener('click', onCorrectClick, { capture: true, once: true });
    };

    const tryAttach = () => {
      const node = findTarget();
      if (node) {
        attach(node);
        return;
      }
      attempts += 1;
      if (attempts < 20) {
        pollTimer = window.setTimeout(tryAttach, 100);
      }
    };

    tryAttach();

    return () => {
      if (pollTimer != null) window.clearTimeout(pollTimer);
      target?.removeEventListener('click', onCorrectClick, { capture: true });
    };
  }, [currentStep, isActive, isWaitingForAction, nextStep]);

  // Wrong-click feedback — block taps on anything *but* the spotlit element while waiting
  useEffect(() => {
    if (!isActive || !currentStep || !isWaitingForAction || !currentStep.waitForAction) return;
    const { selector } = currentStep.waitForAction;

    const handler = (event: MouseEvent) => {
      const clicked = event.target as HTMLElement | null;
      if (!clicked) return;

      // Ignore clicks inside the coach mark itself
      if (clicked.closest('[role="dialog"]')) return;

      const correct =
        document.querySelector(`[data-tutorial="${selector}"]`) ||
        document.querySelector(`[data-tutorial-id="${selector}"]`);
      const isCorrect = correct?.contains(clicked) || clicked.closest(`[data-tutorial="${selector}"]`) !== null;

      if (!isCorrect) {
        event.preventDefault();
        event.stopPropagation();
        setWrongClickCount((n) => n + 1);
      }
    };

    document.addEventListener('click', handler, { capture: true });
    return () => document.removeEventListener('click', handler, { capture: true });
  }, [currentStep, isActive, isWaitingForAction]);

  // Reset wrong-click count when the step changes — debounced via a transient
  // effect so repeated wrong clicks within a single step still fire the shake.
  useEffect(() => {
    setWrongClickCount(0);
  }, [currentStepIndex]);

  // Auto-clear shake state ~600ms after the last wrong click so the coach mark
  // doesn't *stay* shaking until the next step. The previous behaviour kept the
  // class applied for the lifetime of the step.
  useEffect(() => {
    if (wrongClickCount === 0) return;
    const t = window.setTimeout(() => setWrongClickCount(0), 600);
    return () => window.clearTimeout(t);
  }, [wrongClickCount]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (successTimeoutRef.current) window.clearTimeout(successTimeoutRef.current);
    };
  }, []);

  const value = useMemo<TutorialContextValue>(() => ({
    isActive,
    mode,
    currentStep,
    currentStepIndex,
    totalSteps: steps.length,
    steps,
    hasCompletedTutorial,
    shouldSuggestTutorial: !hasCompletedTutorial && !hasStoredProgress,
    isWaitingForAction,
    showSuccessMessage,
    successMessage,
    wrongClickCount,
    currentPhase,
    hasStoredProgress,
    storedStepIndex,
    spotlightMissing,
    startTutorial,
    resumeOrStartTutorial,
    nextStep,
    previousStep,
    skipTutorial,
    goToStep,
    completeTutorial,
    reportSpotlightMissing,
  }), [
    completeTutorial, currentPhase, currentStep, currentStepIndex, goToStep,
    hasCompletedTutorial, hasStoredProgress, isActive, isWaitingForAction, mode,
    nextStep, previousStep, reportSpotlightMissing, resumeOrStartTutorial,
    showSuccessMessage, skipTutorial, spotlightMissing, startTutorial,
    steps, storedStepIndex, successMessage, wrongClickCount,
  ]);

  return <TutorialContext.Provider value={value}>{children}</TutorialContext.Provider>;
};
