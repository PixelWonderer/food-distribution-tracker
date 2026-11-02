import React, { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

import { useTutorialContext } from '@/app/hooks/useTutorialContext';
import { triggerConfetti } from '@/utils/confetti';
import { CoachMark } from './CoachMark';
import { PhasePreview } from './PhasePreview';
import { Spotlight } from './Spotlight';

/**
 * Tutorial overlay — composes the right layers based on the active step's type:
 *   - `preview` and `modal`     → full-screen PhasePreview / completion modal
 *   - `interactive`/`highlight` → Spotlight cutout on the real app + sticky-note CoachMark
 *
 * The interactive layers don't lock pointer events globally — the Spotlight's
 * cutout passes clicks through to the real (highlighted) element, while the
 * provider's wrong-click handler blocks taps elsewhere.
 */
export const TutorialOverlay: React.FC = () => {
  const {
    isActive,
    currentStep,
    currentStepIndex,
    totalSteps,
    nextStep,
    previousStep,
    skipTutorial,
    completeTutorial,
    isWaitingForAction,
    showSuccessMessage,
    successMessage,
    wrongClickCount,
    spotlightMissing,
    reportSpotlightMissing,
  } = useTutorialContext();

  // Lock body scroll only for full-screen step types (preview/modal); interactive
  // steps need the user to scroll to the highlighted element naturally.
  useEffect(() => {
    if (!isActive || !currentStep) return;
    const isFullScreen = currentStep.type === 'preview' || currentStep.type === 'modal';
    if (!isFullScreen) return;
    const original = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = original;
    };
  }, [isActive, currentStep]);

  // Fire celebration confetti the instant the completion modal mounts — not
  // after the user clicks "Start my shift". Gemini v2 #7: the previous timing
  // (confetti fired only after the CTA dismissed the modal) read as a glitchy
  // afterthought; this puts the celebration concurrent with the reveal.
  const completionConfettiFired = useRef(false);
  useEffect(() => {
    if (!isActive || !currentStep) {
      completionConfettiFired.current = false;
      return;
    }
    if (
      currentStep.type === 'modal'
      && currentStep.phase === 'complete'
      && !completionConfettiFired.current
    ) {
      completionConfettiFired.current = true;
      // Defer one frame so the modal paint reaches the screen before the
      // confetti DOM nodes are added.
      window.requestAnimationFrame(() => triggerConfetti());
    }
  }, [isActive, currentStep]);

  // Global keyboard shortcuts. Esc skips, ←/→ navigate (right only when not
  // mid-action — if the user is supposed to tap a real element, Right doesn't
  // bypass that). Edge-case agent flagged the missing handler as a MAJOR a11y
  // gap.
  useEffect(() => {
    if (!isActive || !currentStep) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        skipTutorial();
        return;
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        previousStep();
        return;
      }
      if ((event.key === 'ArrowRight' || event.key === 'Enter') && !isWaitingForAction) {
        // For modal completion, Enter triggers complete. Otherwise advance.
        event.preventDefault();
        if (currentStep.type === 'modal' && currentStep.phase === 'complete') {
          completeTutorial();
        } else {
          nextStep();
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [completeTutorial, currentStep, isActive, isWaitingForAction, nextStep, previousStep, skipTutorial]);

  if (!isActive || !currentStep) return null;

  // ── Preview step: full-screen storyboard mockup
  if (currentStep.type === 'preview' && currentStep.previewScreen) {
    return createPortal(
      <PhasePreview
        step={currentStepIndex}
        total={totalSteps}
        title={currentStep.title}
        body={currentStep.body}
        primaryLabel={currentStep.ctaText ?? 'Continue →'}
        Screen={currentStep.previewScreen}
        onPrimary={nextStep}
        onSkip={skipTutorial}
        onPrevious={previousStep}
      />,
      document.body,
    );
  }

  // ── Modal step (welcome / completion / phase intros without mockup)
  if (currentStep.type === 'modal') {
    const isComplete = currentStep.phase === 'complete';
    return createPortal(
      <div
        role="dialog"
        aria-modal="true"
        aria-label={currentStep.title}
        style={{
          position: 'fixed', inset: 0, zIndex: 1003,
          background: 'rgba(15,23,42,0.55)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 16,
        }}
      >
        <div
          style={{
            // Confetti container is at z-index 10000; the card sits above so
            // celebration falls *around* the CTA, not over its text. The dim
            // scrim (parent) stays below confetti so the rain reads as a
            // celebration, not a UI blocker.
            position: 'relative',
            zIndex: 10001,
            width: 'min(420px, 100%)',
            background: '#fff',
            borderRadius: 24,
            padding: 28,
            textAlign: 'center',
            boxShadow: '0 25px 50px -12px rgba(14,16,32,0.25)',
          }}
        >
          {currentStep.modalIcon && (
            <div style={{ fontSize: 56, lineHeight: 1, marginBottom: 12 }} aria-hidden>
              {currentStep.modalIcon}
            </div>
          )}
          <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: -0.3, color: '#0F172A' }}>
            {currentStep.title}
          </div>
          <div style={{ fontSize: 14, lineHeight: 1.5, color: '#6B6F82', marginTop: 8 }}>
            {currentStep.body}
          </div>
          <button
            type="button"
            onClick={isComplete ? completeTutorial : nextStep}
            autoFocus
            style={{
              marginTop: 20,
              background: '#4F46FF', color: '#fff',
              border: 'none', borderRadius: 12,
              padding: '12px 24px', minWidth: 200,
              fontSize: 14, fontWeight: 800,
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(79,70,255,0.4)',
            }}
          >
            {currentStep.ctaText ?? (isComplete ? 'Start my shift' : 'Continue')}
          </button>
          {!isComplete && (
            <div>
              <button
                type="button"
                onClick={skipTutorial}
                style={{
                  marginTop: 12, background: 'transparent', border: 'none',
                  fontSize: 12, fontWeight: 600, color: '#9498A8', cursor: 'pointer',
                }}
              >
                Skip tutorial
              </button>
            </div>
          )}
        </div>
      </div>,
      document.body,
    );
  }

  // ── Interactive / Highlight step: Spotlight + CoachMark
  // The two elements are wrapped in a fragment that fades in over 240ms when
  // the step changes. Combined with PhasePreview's exit fade, the handoff
  // from preview → live app reads as a cross-fade instead of a hard cut.
  return createPortal(
    <div
      key={`overlay-${currentStepIndex}`}
      style={{ animation: 'tutorialPreviewIn 240ms ease-out' }}
    >
      <Spotlight
        selector={currentStep.target}
        padding={currentStep.highlightPadding ?? 12}
        tight={currentStep.tightSpotlight}
        onMissingChange={reportSpotlightMissing}
      />
      <CoachMark
        step={currentStepIndex}
        total={totalSteps}
        title={currentStep.title}
        body={currentStep.body}
        hint={currentStep.hint}
        primaryLabel={currentStepIndex === totalSteps - 1 ? "I'm ready" : 'Got it'}
        onPrimary={nextStep}
        onSkip={skipTutorial}
        onPrevious={previousStep}
        isWaitingForAction={isWaitingForAction && !spotlightMissing}
        successMessage={showSuccessMessage ? successMessage : null}
        shake={wrongClickCount > 0}
        spotlightMissing={spotlightMissing}
        // Lift the card when targeting a bottom-nav tab so it doesn't overlap
        // the very element it's describing (Gemini v2 #3 MAJOR).
        liftAboveBottomNav={typeof currentStep.target === 'string' && currentStep.target.startsWith('tab-')}
        // Pin to top when the step explicitly opts in (e.g. confirm-tap-row,
        // where the inline stepper appears below the row — keeping the bottom
        // clear lets the user see the app's own feedback. Gemini v3 #2.)
        placeTop={currentStep.placement === 'top'}
      />
    </div>,
    document.body,
  );
};
