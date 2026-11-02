import { createContext } from 'react';

import type { TutorialMode, TutorialPhase, TutorialStep } from '@/types/tutorial';

export type TutorialContextValue = {
  isActive: boolean;
  mode: TutorialMode;
  currentStep: TutorialStep | null;
  currentStepIndex: number;
  totalSteps: number;
  steps: TutorialStep[];
  hasCompletedTutorial: boolean;
  shouldSuggestTutorial: boolean;
  isWaitingForAction: boolean;
  showSuccessMessage: boolean;
  successMessage: string | null;
  wrongClickCount: number;
  currentPhase: TutorialPhase | null;
  hasStoredProgress: boolean;
  storedStepIndex: number;
  spotlightMissing: boolean;
  startTutorial: (mode?: TutorialMode, startStepIndex?: number | null) => void;
  resumeOrStartTutorial: (mode?: TutorialMode) => void;
  nextStep: () => void;
  previousStep: () => void;
  skipTutorial: () => void;
  goToStep: (stepId: string) => void;
  completeTutorial: () => void;
  reportSpotlightMissing: (missing: boolean) => void;
};

/**
 * Context lives in its own module so Vite Fast Refresh can preserve in-memory
 * tutorial state across edits to the provider, hook, or step copy. Mixing the
 * context constant with the provider component in one file forces a full
 * remount on every hot update and was a major source of "hiccup-y" feel during
 * dev/QA.
 */
export const TutorialContext = createContext<TutorialContextValue | undefined>(undefined);
