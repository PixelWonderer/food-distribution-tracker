import type { ComponentType } from 'react';

export type TutorialMode = 'demo' | 'live';

export type TutorialPhase =
  | 'welcome'
  | 'confirmation'
  | 'storage'
  | 'pickup'
  | 'inventory'
  | 'door-access'
  | 'complete';

export type TabId = 'orderConfirmation' | 'storage' | 'pickup' | 'inventory';

// `preview` shows a full-screen storyboard mockup before dropping into a phase.
// `interactive` waits for a real DOM action (tap a row, switch a mode, etc).
// `highlight` spotlights a real element and auto-advances on Got-it.
// `modal` is a copy-only intro / completion card.
export type StepType = 'modal' | 'preview' | 'highlight' | 'interactive';

export type TutorialPlacement = 'top' | 'bottom' | 'left' | 'right' | 'center';

export type WaitForAction = {
  // Click on a real DOM element. The selector is matched against
  // CSS / [data-tutorial=…] / [data-tutorial-id=…] in that order.
  type: 'click' | 'change';
  selector: string;
};

export type TutorialStep = {
  id: string;
  phase: TutorialPhase;
  type: StepType;

  // Copy
  title: string;
  body: string;
  hint?: string;
  successMessage?: string;
  modalIcon?: string;
  ctaText?: string;

  // Routing into the real app
  requiredTab?: TabId;

  // For `highlight` and `interactive`
  target?: string;
  highlightPadding?: number;
  /** Use the snug 36px floor for the spotlight cutout instead of the default
   *  64px floor. For small targets (mode-toggle chips, header icons) where
   *  the default would bleed onto neighbouring elements. */
  tightSpotlight?: boolean;
  placement?: TutorialPlacement;

  // For `interactive`
  waitForAction?: WaitForAction;
  /** Override the default 1400ms success-message → next-step delay. Use a
   *  larger value for steps where the user needs to see the post-action UI
   *  (e.g. an opened menu) before being whisked to the next step. */
  postSuccessDelayMs?: number;

  // For `preview` — render a storyboard mockup as the focal element
  previewScreen?: ComponentType;
};

export type TutorialProgress = {
  stepIndex: number;
  mode: TutorialMode;
};

export const PHASE_INFO: Record<TutorialPhase, { label: string; icon: string }> = {
  welcome:        { label: 'Welcome',      icon: '👋' },
  confirmation:   { label: 'Confirm',      icon: '✓'  },
  storage:        { label: 'Storage',      icon: '📦' },
  pickup:         { label: 'Pickup',       icon: '🚚' },
  inventory:      { label: 'Inventory',    icon: '📋' },
  'door-access':  { label: 'Door Access',  icon: '🔐' },
  complete:       { label: 'Complete',     icon: '🎉' },
};
