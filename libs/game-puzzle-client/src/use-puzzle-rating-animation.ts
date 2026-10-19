import {
  type Accessor,
  createEffect,
  createMemo,
  createSignal,
  on,
} from 'solid-js';

/**
 * Instant rating display for low-end Android — no count-up interval or pulse.
 */
export function usePuzzleRatingAnimation(args: {
  ratingBefore: number;
  ratingAfter: number;
  animationKey: string;
  enabled: boolean;
  onComplete?: () => void;
}): { displayRating: Accessor<number> } {
  const [displayRating, setDisplayRating] = createSignal(args.ratingBefore);
  const completionKey = createMemo(() =>
    args.enabled ? args.animationKey : null
  );

  createEffect(
    on(completionKey, (key) => {
      if (key === null) {
        setDisplayRating(args.ratingBefore);
        return;
      }
      const ratingAfter = args.ratingAfter;
      setDisplayRating(ratingAfter);
      args.onComplete?.();
    })
  );

  return { displayRating };
}
