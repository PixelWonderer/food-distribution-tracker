import React, { useCallback, useEffect } from 'react';

import { DS } from './tokens';
import { STORYBOARD_SCREENS } from './screens';

type StoryboardProps = {
  index: number;
  onNext: () => void;
  onPrevious: () => void;
  onSkip: () => void;
  onComplete: () => void;
};

const TOTAL = STORYBOARD_SCREENS.length;

/**
 * Self-contained storyboard tutorial. Renders one phone-frame mockup at a time
 * with a coach mark overlay. The user navigates linearly with Prev/Next or the
 * arrow keys; Esc exits. The final screen advances to onComplete (confetti +
 * persisted completion flag).
 *
 * Why a storyboard instead of an in-app interactive walkthrough? The previous
 * implementation hooked into real DOM (data-tutorial selectors, scroll-into-view,
 * action listeners) and broke whenever the underlying UI shifted. A storyboard
 * is decoupled from the live components — it always works, can demonstrate edge
 * cases that would be impossible to script live (e.g. multi-volunteer sync),
 * and renders identically across mobile, tablet, and desktop.
 */
export const Storyboard: React.FC<StoryboardProps> = ({ index, onNext, onPrevious, onSkip, onComplete }) => {
  const isLast = index >= TOTAL - 1;
  const Screen = STORYBOARD_SCREENS[Math.min(index, TOTAL - 1)];

  const advance = useCallback(() => {
    if (isLast) {
      onComplete();
    } else {
      onNext();
    }
  }, [isLast, onNext, onComplete]);

  // Keyboard navigation: ← previous, → / Enter advance, Esc dismiss
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onSkip();
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        onPrevious();
      } else if (event.key === 'ArrowRight' || event.key === 'Enter') {
        event.preventDefault();
        advance();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [advance, onPrevious, onSkip]);

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Food Tracker tutorial"
      style={{
        position: 'fixed', inset: 0, zIndex: 1001,
        background: '#f0eee9',
        display: 'flex', flexDirection: 'column',
        fontFamily: DS.font,
      }}
    >
      {/* Storyboard-scoped keyframes. Kept inline so the tutorial is hermetic —
          if it gets removed, no orphaned animations linger in the global CSS. */}
      <style>{`
        @keyframes pulseBreathe {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.55; transform: scale(0.85); }
        }
      `}</style>
      {/* Top bar — title + skip */}
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
          }}>Step {index + 1} of {TOTAL}</div>
        </div>
        <button
          type="button"
          onClick={onSkip}
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
          width: `${((index + 1) / TOTAL) * 100}%`,
          background: `linear-gradient(90deg, ${DS.indigo}, ${DS.indigoDeep})`,
          transition: 'width 240ms ease-out',
        }} />
      </div>

      {/* Phone-frame canvas (vertically scrollable on short viewports) */}
      <div style={{
        flex: 1, overflow: 'auto',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '8px 0',
      }}>
        <div style={{ width: 340, height: 680, position: 'relative' }}>
          <Screen />
        </div>
      </div>

      {/* Bottom nav bar */}
      <div style={{
        flexShrink: 0,
        padding: '10px 16px calc(env(safe-area-inset-bottom, 0px) + 14px)',
        background: '#fff',
        borderTop: `1px solid ${DS.slate200}`,
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <button
          type="button"
          onClick={onPrevious}
          disabled={index === 0}
          style={{
            background: '#fff',
            border: `1px solid ${DS.slate200}`,
            borderRadius: 12, padding: '10px 16px',
            fontSize: 13, fontWeight: 700,
            color: index === 0 ? DS.slate300 : DS.slate700,
            cursor: index === 0 ? 'default' : 'pointer',
            fontFamily: DS.font,
            opacity: index === 0 ? 0.5 : 1,
          }}
        >
          ← Back
        </button>
        <div style={{ flex: 1, display: 'flex', justifyContent: 'center', gap: 4 }} aria-hidden>
          {Array.from({ length: TOTAL }).map((_, i) => (
            <span
              key={i}
              style={{
                width: i === index ? 18 : 6, height: 6, borderRadius: 3,
                background: i === index ? DS.indigo : (i < index ? DS.indigoSoft : DS.slate200),
                transition: 'width 200ms ease-out, background 200ms ease-out',
              }}
            />
          ))}
        </div>
        <button
          type="button"
          onClick={advance}
          autoFocus
          style={{
            background: DS.indigo, color: '#fff',
            border: 'none',
            borderRadius: 12, padding: '10px 18px',
            fontSize: 13, fontWeight: 800,
            cursor: 'pointer', fontFamily: DS.font,
            boxShadow: `0 4px 12px ${DS.indigo}55`,
            letterSpacing: -0.1,
          }}
        >
          {isLast ? 'Finish 🎉' : 'Next →'}
        </button>
      </div>
    </div>
  );
};
