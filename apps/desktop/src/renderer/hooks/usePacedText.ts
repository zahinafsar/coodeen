import { useEffect, useRef, useState } from "react";

/**
 * Progressively reveal `target` at roughly ~24ms per frame with adaptive
 * step sizing so bursty deltas still catch up quickly. Mirrors opencode's
 * createPacedValue behaviour.
 *
 * When `isStreaming` is false, the full text is revealed immediately.
 */
export function usePacedText(target: string, isStreaming: boolean): string {
  const [shown, setShown] = useState("");
  const rafRef = useRef<number | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const shownLenRef = useRef(0);

  useEffect(() => {
    if (!isStreaming) {
      setShown(target);
      shownLenRef.current = target.length;
      return;
    }

    if (target.length < shownLenRef.current) {
      // Content shrunk (rare — e.g. replacement); snap.
      setShown(target);
      shownLenRef.current = target.length;
      return;
    }

    const tick = () => {
      const remaining = target.length - shownLenRef.current;
      if (remaining <= 0) {
        timerRef.current = null;
        return;
      }
      // Adaptive step: bigger chunks when far behind, smaller when close.
      const step = Math.max(
        1,
        Math.min(
          remaining,
          Math.ceil(remaining / 24),
        ),
      );
      shownLenRef.current += step;
      setShown(target.slice(0, shownLenRef.current));
      timerRef.current = setTimeout(tick, 24);
    };

    if (timerRef.current == null && shownLenRef.current < target.length) {
      tick();
    }

    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, [target, isStreaming]);

  return isStreaming ? shown : target;
}
