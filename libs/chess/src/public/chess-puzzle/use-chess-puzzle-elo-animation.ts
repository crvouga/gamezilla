import { useClock, useTimers } from '@pkgs/clock/solid';
import { motion } from '@pkgs/ui';
import { type Accessor, createEffect, createSignal, onCleanup } from 'solid-js';

const COUNT_UP_MS = 1200;
const TICK_INTERVAL_MS = 50;

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

function runCompletePulse(
  setCompletePulse: (next: number) => void,
  timers: ReturnType<typeof useTimers>
): () => void {
  setCompletePulse(1.12);
  const id = timers.setTimeout(() => setCompletePulse(1), motion.duration.fast);
  return () => timers.clearTimeout(id);
}

export function useChessPuzzleEloAnimation(args: {
  ratingBefore: number;
  ratingAfter: number;
  animationKey: string;
  enabled: boolean;
  onRatingStep?: (rating: number) => void;
  onComplete?: () => void;
}): { displayRating: Accessor<number>; completePulse: Accessor<number> } {
  const clock = useClock();
  const timers = useTimers();
  const [displayRating, setDisplayRating] = createSignal(args.ratingBefore);
  const [completePulse, setCompletePulse] = createSignal(1);
  const lastReportedRef: { current: number } = { current: args.ratingBefore };

  createEffect(() => {
    void args.animationKey;
    if (!args.enabled) {
      setDisplayRating(args.ratingBefore);
      lastReportedRef.current = args.ratingBefore;
      return;
    }
    const ratingBefore = args.ratingBefore;
    const ratingAfter = args.ratingAfter;
    setDisplayRating(ratingBefore);
    lastReportedRef.current = ratingBefore;

    const report = (next: number): void => {
      setDisplayRating(next);
      if (next === lastReportedRef.current) return;
      lastReportedRef.current = next;
      args.onRatingStep?.(next);
    };

    const startMs = clock.now();
    const id = timers.setInterval(() => {
      const elapsed = clock.now() - startMs;
      const t = Math.min(1, elapsed / COUNT_UP_MS);
      report(
        Math.round(
          ratingBefore + (ratingAfter - ratingBefore) * easeOutCubic(t)
        )
      );
      if (t < 1) return;
      timers.clearInterval(id);
      report(ratingAfter);
      args.onComplete?.();
      onCleanup(runCompletePulse(setCompletePulse, timers));
    }, TICK_INTERVAL_MS);
    onCleanup(() => timers.clearInterval(id));
  });

  return { displayRating, completePulse };
}
