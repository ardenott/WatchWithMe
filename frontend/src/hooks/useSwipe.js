import { useRef, useState, useCallback, useEffect } from 'react';

const SWIPE_THRESHOLD = 80;

export function useSwipe({ onSwipeLeft, onSwipeRight, disabled = false }) {
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  // 'idle' | 'exiting-right' | 'exiting-left'
  const [exitState, setExitState] = useState('idle');
  const startPos = useRef(null);
  const exitTimerRef = useRef(null);

  // Clean up any pending swipe timer on unmount
  useEffect(() => () => clearTimeout(exitTimerRef.current), []);

  const getPoint = (e) =>
    e.touches
      ? { x: e.touches[0].clientX, y: e.touches[0].clientY }
      : { x: e.clientX, y: e.clientY };

  const triggerSwipe = useCallback(
    (direction) => {
      // Guard: don't re-trigger during an exit animation
      if (exitState !== 'idle') return;

      setExitState(direction === 'right' ? 'exiting-right' : 'exiting-left');
      setIsDragging(false);

      // Notify parent after animation completes
      exitTimerRef.current = setTimeout(() => {
        if (direction === 'right') onSwipeRight?.();
        else onSwipeLeft?.();
      }, 400);
    },
    [exitState, onSwipeLeft, onSwipeRight]
  );

  const onStart = useCallback(
    (e) => {
      if (disabled || exitState !== 'idle') return;
      startPos.current = getPoint(e);
      setIsDragging(true);
    },
    [disabled, exitState]
  );

  const onMove = useCallback(
    (e) => {
      if (!isDragging || !startPos.current) return;
      e.preventDefault();
      const pt = getPoint(e);
      setOffset({ x: pt.x - startPos.current.x, y: pt.y - startPos.current.y });
    },
    [isDragging]
  );

  const onEnd = useCallback(() => {
    if (!isDragging) return;
    setIsDragging(false);
    startPos.current = null;

    if (Math.abs(offset.x) >= SWIPE_THRESHOLD) {
      triggerSwipe(offset.x > 0 ? 'right' : 'left');
    } else {
      // Snap back: reset offset with spring transition
      setOffset({ x: 0, y: 0 });
    }
  }, [isDragging, offset.x, triggerSwipe]);

  const rotation = offset.x * 0.06;
  const likeOpacity = Math.max(0, Math.min(offset.x / SWIPE_THRESHOLD, 1));
  const passOpacity = Math.max(0, Math.min(-offset.x / SWIPE_THRESHOLD, 1));

  // Build cardStyle based on exit state — avoids any snap-back interpolation
  let cardStyle;
  if (exitState === 'exiting-right' || exitState === 'exiting-left') {
    cardStyle = {
      transform: exitState === 'exiting-right'
        ? 'translateX(130vw) rotate(25deg)'
        : 'translateX(-130vw) rotate(-25deg)',
      opacity: 0,
      transition: 'transform 0.4s cubic-bezier(0.4, 0, 0.8, 1), opacity 0.4s ease',
      pointerEvents: 'none',
      cursor: 'grabbing',
    };
  } else if (isDragging) {
    cardStyle = {
      transform: `translateX(${offset.x}px) translateY(${offset.y * 0.2}px) rotate(${rotation}deg)`,
      transition: 'none',
      cursor: 'grabbing',
    };
  } else {
    // Idle / snapping back to center
    cardStyle = {
      transform: `translateX(${offset.x}px) translateY(${offset.y * 0.2}px) rotate(${rotation}deg)`,
      transition: 'transform 0.35s cubic-bezier(0.34, 1.2, 0.64, 1)',
      cursor: 'grab',
    };
  }

  return {
    cardStyle,
    likeOpacity,
    passOpacity,
    exitState,
    isDragging,
    triggerSwipe,
    handlers: {
      onMouseDown: onStart,
      onMouseMove: onMove,
      onMouseUp: onEnd,
      onMouseLeave: onEnd,
      onTouchStart: onStart,
      onTouchMove: onMove,
      onTouchEnd: onEnd,
    },
  };
}
