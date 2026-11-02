import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';

import { DS } from './storyboard/tokens';

const HIGHLIGHT_MIN_SIZE = 64;
// Some targets (small mode-toggle chips, header icons) are visually compact;
// inflating them to the default minimum makes the saffron ring bleed onto
// neighbours. When `tight` is set the floor drops to a snug 36px.
const HIGHLIGHT_TIGHT_SIZE = 36;

const resolveTarget = (selector: string | undefined): HTMLElement | null => {
  if (!selector) return null;
  // Match the priority used by previous tutorial: raw CSS → data-tutorial-id → data-tutorial.
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

type SpotlightProps = {
  selector?: string;
  /** Inner padding around the spotlight cutout. Defaults to 14 for breathing room. */
  padding?: number;
  /** Use the tight 36px minimum size (small chips / header icons) instead of
   *  the default 64px floor that bleeds onto neighbouring elements. */
  tight?: boolean;
  /** Called with `true` once the target search times out so the host can show
   *  a fallback hint, and `false` once the target is found and measured. */
  onMissingChange?: (missing: boolean) => void;
};

/**
 * Spotlight overlay — dims the screen everywhere except a target element, with
 * a saffron pulse around the cutout. Tracks the target's bounding rect across
 * scroll/resize and retries if the element is missing on first paint (common
 * after a tab switch — the new tab's content hasn't mounted yet).
 *
 * Returns null when there's no target (e.g. modal-style steps); the host
 * overlay still renders the coach mark.
 */
export const Spotlight: React.FC<SpotlightProps> = ({ selector, padding = 14, tight = false, onMissingChange }) => {
  const [rect, setRect] = useState<DOMRect | null>(null);
  const observerRef = useRef<ResizeObserver | null>(null);

  useLayoutEffect(() => {
    if (!selector) {
      setRect(null);
      onMissingChange?.(false);
      return;
    }

    let cancelled = false;
    let attempts = 0;
    // 30 attempts × 100ms = 3s. Functional review found 1.5s wasn't long enough
    // when a tab switch + content mount happened back-to-back (e.g. confirm-bulk
    // bar only renders once an item is staged from the previous step).
    const maxAttempts = 30;
    const minSize = tight ? HIGHLIGHT_TIGHT_SIZE : HIGHLIGHT_MIN_SIZE;

    const measure = (node: HTMLElement) => {
      const r = node.getBoundingClientRect();
      const padded = new DOMRect(
        r.left - padding,
        r.top - padding,
        Math.max(minSize, r.width + padding * 2),
        Math.max(minSize, r.height + padding * 2),
      );
      setRect(padded);
    };

    const attach = (node: HTMLElement) => {
      onMissingChange?.(false);
      // Scroll target into view before measuring. The scroll is async, so we
      // measure: (1) immediately for fast initial paint, (2) on the next rAF
      // pair to catch the post-scroll position before the user perceives the
      // ring teleporting, and (3) again at 380ms once `behavior: smooth` has
      // settled on slower devices. Functional review flagged scrim/ring
      // de-sync; the rAF pair fixes it.
      try {
        node.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
      } catch {
        // ignore
      }
      const update = () => measure(node);
      update();
      let raf1 = 0;
      const raf2 = window.requestAnimationFrame(() => {
        raf1 = window.requestAnimationFrame(update);
      });
      const t = window.setTimeout(update, 380);
      const onWindow = () => update();
      window.addEventListener('resize', onWindow);
      window.addEventListener('scroll', onWindow, true);
      observerRef.current = new ResizeObserver(update);
      observerRef.current.observe(node);
      return () => {
        window.cancelAnimationFrame(raf1);
        window.cancelAnimationFrame(raf2);
        window.clearTimeout(t);
        window.removeEventListener('resize', onWindow);
        window.removeEventListener('scroll', onWindow, true);
        observerRef.current?.disconnect();
      };
    };

    let cleanup: (() => void) | undefined;

    const tryFind = () => {
      if (cancelled) return;
      const node = resolveTarget(selector);
      if (node) {
        cleanup = attach(node);
        return;
      }
      attempts += 1;
      if (attempts < maxAttempts) {
        window.setTimeout(tryFind, 100);
      } else {
        // Give up — host shows a "can't find that button — Skip to continue" hint.
        setRect(null);
        onMissingChange?.(true);
      }
    };

    tryFind();

    return () => {
      cancelled = true;
      cleanup?.();
    };
  }, [selector, padding, tight, onMissingChange]);

  // Keyframes for the saffron pulse — scoped here so the component is self-contained.
  useEffect(() => {
    const id = 'tutorial-spotlight-keyframes';
    if (document.getElementById(id)) return;
    const style = document.createElement('style');
    style.id = id;
    style.textContent = `
      @keyframes tutorialSpotlightPulse {
        0%, 100% { box-shadow: 0 0 0 0 rgba(245,196,34,0.7); }
        50%      { box-shadow: 0 0 0 8px rgba(245,196,34,0); }
      }
    `;
    document.head.appendChild(style);
  }, []);

  if (!rect) {
    // Full-screen scrim when no target — used by modal/preview steps' caller; here we noop.
    return null;
  }

  // Frame-shape clip path: outer rectangle minus the target rect, so taps still
  // pass through to the highlighted element while everything else dims.
  const inset = 4;
  const x1 = Math.max(0, rect.left - inset);
  const y1 = Math.max(0, rect.top - inset);
  const x2 = rect.left + rect.width + inset;
  const y2 = rect.top + rect.height + inset;
  const clip = `polygon(
    0% 0%, 0% 100%,
    ${x1}px 100%, ${x1}px ${y1}px,
    ${x2}px ${y1}px, ${x2}px ${y2}px,
    ${x1}px ${y2}px, ${x1}px 100%,
    100% 100%, 100% 0%
  )`;

  return (
    <>
      {/* Scrim with cutout */}
      <div
        aria-hidden
        style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(15,23,42,0.55)',
          clipPath: clip,
          WebkitClipPath: clip,
          pointerEvents: 'none',
          transition: 'clip-path 240ms ease-out, background 240ms ease-out',
        }}
      />
      {/* Saffron pulse ring around the cutout — transitions left/top/width/height
          smoothly between steps so the ring slides instead of teleporting. */}
      <div
        aria-hidden
        style={{
          position: 'fixed',
          left: rect.left, top: rect.top, width: rect.width, height: rect.height,
          zIndex: 1001,
          border: `2px solid ${DS.saffron}`,
          borderRadius: 12,
          pointerEvents: 'none',
          animation: 'tutorialSpotlightPulse 2s ease-in-out infinite',
          transition: 'left 240ms ease-out, top 240ms ease-out, width 240ms ease-out, height 240ms ease-out',
        }}
      />
    </>
  );
};
