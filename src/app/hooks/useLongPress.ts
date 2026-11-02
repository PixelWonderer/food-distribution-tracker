import { useCallback, useRef } from 'react';

type LongPressOptions = {
  /** Duration in milliseconds before long press triggers (default: 500ms) */
  threshold?: number;
  /** Called when long press is triggered */
  onLongPress: () => void;
  /** Called on regular click (if long press wasn't triggered) */
  onClick?: () => void;
  /** Called when press starts */
  onStart?: () => void;
  /** Called when press ends (regardless of whether long press was triggered) */
  onEnd?: () => void;
};

type LongPressHandlers = {
  onMouseDown: (e: React.MouseEvent) => void;
  onMouseUp: (e: React.MouseEvent) => void;
  onMouseLeave: (e: React.MouseEvent) => void;
  onTouchStart: (e: React.TouchEvent) => void;
  onTouchEnd: (e: React.TouchEvent) => void;
};

/**
 * Hook to detect long-press gestures on both touch and mouse events.
 * Returns event handlers to spread onto the target element.
 *
 * @example
 * const handlers = useLongPress({
 *   threshold: 500,
 *   onLongPress: () => console.log('Long pressed!'),
 *   onClick: () => console.log('Regular click'),
 * });
 *
 * return <button {...handlers}>Press me</button>;
 */
export const useLongPress = ({
  threshold = 500,
  onLongPress,
  onClick,
  onStart,
  onEnd,
}: LongPressOptions): LongPressHandlers => {
  const timerRef = useRef<number | null>(null);
  const isLongPressRef = useRef(false);
  const isActiveRef = useRef(false);

  const start = useCallback(() => {
    if (isActiveRef.current) return;

    isActiveRef.current = true;
    isLongPressRef.current = false;
    onStart?.();

    timerRef.current = window.setTimeout(() => {
      isLongPressRef.current = true;
      onLongPress();
    }, threshold);
  }, [threshold, onLongPress, onStart]);

  const end = useCallback(
    (shouldTriggerClick = true) => {
      if (!isActiveRef.current) return;

      isActiveRef.current = false;

      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }

      // Only trigger onClick if it wasn't a long press
      if (shouldTriggerClick && !isLongPressRef.current && onClick) {
        onClick();
      }

      onEnd?.();
    },
    [onClick, onEnd]
  );

  const cancel = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    isActiveRef.current = false;
    onEnd?.();
  }, [onEnd]);

  const onMouseDown = useCallback(
    (e: React.MouseEvent) => {
      // Only respond to left clicks
      if (e.button !== 0) return;
      start();
    },
    [start]
  );

  const onMouseUp = useCallback(() => {
    end();
  }, [end]);

  const onMouseLeave = useCallback(() => {
    cancel();
  }, [cancel]);

  const onTouchStart = useCallback(() => {
    start();
  }, [start]);

  const onTouchEnd = useCallback(() => {
    end();
  }, [end]);

  return {
    onMouseDown,
    onMouseUp,
    onMouseLeave,
    onTouchStart,
    onTouchEnd,
  };
};

export default useLongPress;
