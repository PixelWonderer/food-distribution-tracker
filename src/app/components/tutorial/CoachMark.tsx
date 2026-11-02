import React, { useEffect } from 'react';

import { DS } from './storyboard/tokens';

type CoachMarkProps = {
  step: number;
  total: number;
  title: string;
  body: string;
  hint?: string;
  primaryLabel: string;
  onPrimary: () => void;
  onSkip: () => void;
  onPrevious?: () => void;
  isWaitingForAction?: boolean;
  successMessage?: string | null;
  shake?: boolean;
  /** When true, surface a "can't find that — Skip to continue" fallback hint
   *  in place of the normal action prompt. Set by the host overlay when the
   *  Spotlight times out finding its target. */
  spotlightMissing?: boolean;
  /** When true, lift the coach card above its default safe-area inset so it
   *  doesn't overlap the bottom-nav target it's describing (Gemini v2 #3). */
  liftAboveBottomNav?: boolean;
  /** Pin the coach card to the top of the viewport instead of the bottom. Use
   *  for steps where the highlighted element triggers UI to appear *below* it
   *  (e.g. the inline ran-low stepper) — keeping the bottom clear lets the
   *  user see the app's own feedback. */
  placeTop?: boolean;
};

/**
 * Coach mark — sticky-note styled instruction card pinned to the bottom of
 * the viewport. The cream paper + 1.2° tilt is intentional: it telegraphs
 * "this is a tutorial overlay, not part of the app". Pulled from the
 * storyboard's `paper` coach skin so the in-app tutorial and the storyboard
 * preview screens share visual vocabulary.
 */
export const CoachMark: React.FC<CoachMarkProps> = ({
  step,
  total,
  title,
  body,
  hint,
  primaryLabel,
  onPrimary,
  onSkip,
  onPrevious,
  isWaitingForAction = false,
  successMessage = null,
  shake = false,
  spotlightMissing = false,
  liftAboveBottomNav = false,
  placeTop = false,
}) => {
  const titleId = `tutorial-title-${step}`;
  const bodyId = `tutorial-body-${step}`;
  // Bottom-nav targets need extra clearance so the card doesn't sit on top of
  // the very thing it's pointing at (and so iOS home indicator doesn't eat
  // the action row). 96px lifts above the bottom-nav rail without covering
  // the spotlight cutout above it.
  const bottomInset = liftAboveBottomNav
    ? 'calc(env(safe-area-inset-bottom, 0px) + 96px)'
    : 'calc(env(safe-area-inset-bottom, 0px) + 16px)';
  // Inject the entrance keyframes once. Scoped here so the tutorial keeps owning
  // its own animations without bleeding into the global CSS.
  useEffect(() => {
    const id = 'tutorial-coach-keyframes';
    if (document.getElementById(id)) return;
    const style = document.createElement('style');
    style.id = id;
    style.textContent = `
      @keyframes tutorialCoachIn {
        from { opacity: 0; transform: translateY(10px) rotate(-1.2deg); }
        to   { opacity: 1; transform: translateY(0)    rotate(-1.2deg); }
      }
    `;
    document.head.appendChild(style);
  }, []);

  return (
  <div
    role="dialog"
    aria-labelledby={titleId}
    aria-describedby={bodyId}
    key={`step-${step}`}
    className={shake ? 'tutorial-shake' : undefined}
    style={{
      position: 'fixed',
      left: 12, right: 12,
      // When placeTop is set, pin to top of viewport (clear of header chrome
      // at ~56px) instead of bottom; leaves the bottom of the screen clear so
      // app-native feedback (stepper, toast) is visible below the spotlit row.
      ...(placeTop
        ? { top: 'calc(env(safe-area-inset-top, 0px) + 56px)' }
        : { bottom: bottomInset }),
      zIndex: 1002,
      background: '#FFF8E6',
      color: DS.slate900,
      border: `1px solid ${DS.amberBorder}`,
      borderRadius: 14,
      padding: '14px 16px',
      boxShadow: '0 18px 40px rgba(15,23,42,0.18), 0 2px 4px rgba(15,23,42,0.08)',
      transform: 'rotate(-1.2deg)',
      maxWidth: 420,
      margin: '0 auto',
      fontFamily: DS.font,
      pointerEvents: 'auto',
      animation: 'tutorialCoachIn 220ms ease-out',
    }}
  >
    {/* Phase pip row + step counter */}
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
      <div style={{ display: 'flex', gap: 4 }} aria-hidden>
        {Array.from({ length: total }).map((_, i) => (
          <div key={i} style={{
            width: i === step ? 14 : 5, height: 5, borderRadius: 2,
            background: i === step ? DS.peachInk : (i < step ? DS.amberBorder : '#EBDFB1'),
            transition: 'width 200ms ease-out',
          }} />
        ))}
      </div>
      <span style={{ fontSize: 9, fontWeight: 700, color: DS.slate500, letterSpacing: 0.6, textTransform: 'uppercase' }}>
        {step + 1} of {total}
      </span>
    </div>

    {/* Title + body */}
    <div id={titleId} style={{ fontSize: 15, fontWeight: 700, color: DS.slate900, letterSpacing: -0.2, marginBottom: 4 }}>
      {title}
    </div>
    <div id={bodyId} style={{ fontSize: 13, lineHeight: 1.5, color: DS.slate700 }}>
      {body}
    </div>

    {/* Polite live region for the success message — separate from the dialog
        wrapper to avoid the role=dialog + aria-live conflict flagged in a11y. */}
    <div
      aria-live="polite"
      aria-atomic="true"
      style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}
    >
      {successMessage || ''}
    </div>

    {/* Hint badge — animated saffron dot. Hidden when the spotlight target
        couldn't be located, since the hint ("Tap the highlighted row") is
        actively misleading without a highlight to look at. */}
    {hint && !successMessage && !spotlightMissing && (
      <div style={{
        marginTop: 10, display: 'inline-flex', alignItems: 'center', gap: 5,
        fontSize: 10.5, fontWeight: 700,
        color: DS.peachInk,
        letterSpacing: 0.6, textTransform: 'uppercase',
      }}>
        <span style={{
          width: 6, height: 6, borderRadius: 3, background: DS.peachInk,
          animation: 'pulse-breathe 1.6s ease-in-out infinite',
        }} />
        {hint}
      </div>
    )}

    {/* Spotlight target missing fallback — surfaces an honest "we can't find
        that button" message instead of leaving the user to chase a ghost. */}
    {spotlightMissing && !successMessage && (
      <div style={{
        marginTop: 10, padding: '6px 10px', borderRadius: 8,
        background: DS.amberSoft, color: DS.amberInk,
        border: `1px solid ${DS.amberBorder}`,
        fontSize: 11, fontWeight: 700,
        display: 'inline-flex', alignItems: 'center', gap: 6,
      }}>
        <span aria-hidden>⚠️</span>
        Can't find that button. Tap Skip to continue.
      </div>
    )}

    {/* Success — replaces hint when a step completes */}
    {successMessage && (
      <div style={{
        marginTop: 10, padding: '6px 10px', borderRadius: 8,
        background: DS.greenSoft, color: DS.greenInk,
        border: `1px solid ${DS.greenBorder}`,
        fontSize: 11, fontWeight: 700,
        display: 'inline-flex', alignItems: 'center', gap: 6,
      }}>
        <span aria-hidden>✓</span>{successMessage}
      </div>
    )}

    {/* Action row */}
    <div style={{
      marginTop: 12, display: 'flex', alignItems: 'center', gap: 8,
    }}>
      {onPrevious && step > 0 && (
        <button
          type="button"
          onClick={onPrevious}
          style={{
            background: 'transparent', border: 'none',
            fontSize: 12, fontWeight: 700, color: DS.slate700,
            padding: '6px 8px', cursor: 'pointer', fontFamily: DS.font,
          }}
        >
          ← Back
        </button>
      )}
      {/* Skip button: was slate500 (#9498A8) on cream — 2.71:1, fails WCAG AA.
          slate700 (#373B4F) on cream is ~9.6:1. */}
      <button
        type="button"
        onClick={onSkip}
        style={{
          background: 'transparent', border: 'none',
          fontSize: 12, fontWeight: 700, color: DS.slate700,
          padding: '6px 8px', cursor: 'pointer', fontFamily: DS.font,
        }}
      >
        Skip tutorial
      </button>
      {!isWaitingForAction && (
        <button
          type="button"
          onClick={onPrimary}
          autoFocus
          style={{
            marginLeft: 'auto',
            background: DS.indigo, color: '#fff',
            border: 'none', borderRadius: 12,
            padding: '10px 18px',
            fontSize: 13, fontWeight: 800, letterSpacing: -0.1,
            cursor: 'pointer', fontFamily: DS.font,
            boxShadow: `0 4px 12px ${DS.indigo}55`,
          }}
        >
          {primaryLabel}
        </button>
      )}
    </div>
  </div>
  );
};
