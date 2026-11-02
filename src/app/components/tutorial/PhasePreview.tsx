import React, { ComponentType, useEffect, useState } from 'react';

import { DS } from './storyboard/tokens';
import { StoryboardContext } from './storyboard/primitives';

type PhasePreviewProps = {
  step: number;
  total: number;
  title: string;
  body: string;
  primaryLabel: string;
  Screen: ComponentType;
  onPrimary: () => void;
  onSkip: () => void;
  onPrevious?: () => void;
};

/**
 * Phase intro modal — a full-screen card that holds a storyboard mockup
 * (e.g. ScreenConfirmIntro) above the phase intro copy. Used to give the user
 * a visual "this is what you're about to do" before dropping them into the
 * real app for the interactive steps. The mockup is decorative — the actual
 * teaching happens in the spotlit interactive steps that follow.
 */
export const PhasePreview: React.FC<PhasePreviewProps> = ({
  step,
  total,
  title,
  body,
  primaryLabel,
  Screen,
  onPrimary,
  onSkip,
  onPrevious,
}) => {
  // Keyframes for the storyboard's pulseBreathe animation + the preview enter /
  // exit cross-fade. Scoped to the document so the mockup screens render
  // correctly while this preview is mounted, and the cross-fade runs even on
  // first mount.
  useEffect(() => {
    const id = 'tutorial-storyboard-keyframes';
    if (document.getElementById(id)) return;
    const style = document.createElement('style');
    style.id = id;
    style.textContent = `
      @keyframes pulseBreathe {
        0%, 100% { opacity: 1; transform: scale(1); }
        50%      { opacity: 0.55; transform: scale(0.85); }
      }
      @keyframes tutorialPreviewIn {
        from { opacity: 0; }
        to   { opacity: 1; }
      }
      @keyframes tutorialPreviewOut {
        from { opacity: 1; }
        to   { opacity: 0; }
      }
    `;
    document.head.appendChild(style);
  }, []);

  // Exit cross-fade. We render an overlay layer that fades to opacity 0 just
  // long enough (180ms) for the live overlay's fade-in to mask the unmount.
  // The actual onPrimary fires immediately so the next step mounts in
  // parallel with our exit fade — no awkward "wait then jump".
  const [exiting, setExiting] = useState(false);
  const advance = (cb: () => void) => {
    if (exiting) return;
    setExiting(true);
    cb();
  };
  const handleAdvance = () => advance(onPrimary);
  const handleSkip = () => advance(onSkip);
  const handleBack = onPrevious ? () => advance(onPrevious) : undefined;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      style={{
        position: 'fixed', inset: 0, zIndex: 1003,
        background: '#f0eee9',
        display: 'flex', flexDirection: 'column',
        fontFamily: DS.font,
        // Only the entrance fade — the exit happens implicitly when the parent
        // swaps to the live overlay, whose own fade-in masks the cut. A real
        // cross-fade would require holding both children mounted in parallel,
        // which we avoid for click-handler simplicity.
        animation: exiting ? 'tutorialPreviewOut 180ms ease-out forwards' : 'tutorialPreviewIn 240ms ease-out',
        pointerEvents: exiting ? 'none' : 'auto',
      }}
    >
      {/* Top bar */}
      <div style={{
        flexShrink: 0,
        padding: '12px 16px 10px',
        background: '#fff',
        borderBottom: `1px solid ${DS.slate200}`,
        display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{
            fontSize: 9, fontWeight: 700, color: DS.slate500,
            textTransform: 'uppercase', letterSpacing: 1.2,
          }}>Food Tracker · Tutorial</div>
          <div style={{
            fontSize: 14, fontWeight: 800, color: DS.slate900,
            letterSpacing: -0.2, marginTop: 1,
          }}>Step {step + 1} of {total}</div>
        </div>
        <button
          type="button"
          onClick={handleSkip}
          aria-label="Close tutorial"
          style={{
            background: '#fff', border: `1px solid ${DS.slate200}`,
            borderRadius: 999, padding: '6px 12px',
            fontSize: 12, fontWeight: 700, color: DS.slate600,
            cursor: 'pointer', fontFamily: DS.font,
          }}
        >
          Skip ✕
        </button>
      </div>

      {/* Progress bar */}
      <div style={{
        flexShrink: 0, height: 3, background: DS.slate100, position: 'relative',
      }}>
        <div style={{
          position: 'absolute', top: 0, left: 0, bottom: 0,
          width: `${((step + 1) / total) * 100}%`,
          background: `linear-gradient(90deg, ${DS.indigo}, ${DS.indigoDeep})`,
          transition: 'width 240ms ease-out',
        }} />
      </div>

      {/* Mockup canvas — phone-frame mockup centered, capped width so wide
          desktops don't render the bezel as an asymmetric black rectangle.
          The StoryboardContext suppresses the mockup's inner CoachMark + step
          label so this preview shows exactly one teaching surface. */}
      <StoryboardContext.Provider value={{ embedded: true }}>
        <div style={{
          flex: 1, overflow: 'auto',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: '12px 16px',
        }}>
          <div style={{
            width: 340, maxWidth: '100%', height: 632,
            position: 'relative', flexShrink: 0,
          }}>
            <Screen />
          </div>
        </div>
      </StoryboardContext.Provider>

      {/* Phase intro card pinned bottom — sticky-note */}
      <div style={{
        flexShrink: 0,
        padding: '12px 16px calc(env(safe-area-inset-bottom, 0px) + 14px)',
        background: '#fff',
        borderTop: `1px solid ${DS.slate200}`,
      }}>
        <div style={{
          background: '#FFF8E6',
          border: `1px solid ${DS.amberBorder}`,
          borderRadius: 14,
          padding: '12px 14px',
          boxShadow: '0 18px 40px rgba(15,23,42,0.18), 0 2px 4px rgba(15,23,42,0.08)',
          transform: 'rotate(-0.6deg)',
          maxWidth: 480,
          margin: '0 auto',
        }}>
          <div style={{ fontSize: 14, fontWeight: 800, color: DS.slate900, letterSpacing: -0.2 }}>{title}</div>
          <div style={{ fontSize: 12, lineHeight: 1.5, color: DS.slate700, marginTop: 4 }}>{body}</div>
          <div style={{
            marginTop: 10, display: 'flex', alignItems: 'center', gap: 8,
          }}>
            {handleBack && step > 0 && (
              <button
                type="button"
                onClick={handleBack}
                style={{
                  background: 'transparent', border: 'none',
                  fontSize: 12, fontWeight: 700, color: DS.slate700,
                  padding: '6px 8px', cursor: 'pointer', fontFamily: DS.font,
                }}
              >
                ← Back
              </button>
            )}
            <button
              type="button"
              onClick={handleAdvance}
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
          </div>
        </div>
      </div>
    </div>
  );
};
