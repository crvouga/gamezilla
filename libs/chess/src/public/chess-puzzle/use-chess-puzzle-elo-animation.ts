import { type Accessor, createEffect, createSignal } from 'solid-js';

/**
 * Instant ELO display for low-end Android — no count-up interval or pulse.
 */
export function useChessPuzzleEloAnimation(args: {
  ratingBefore: number;
  ratingAfter: number;
  animationKey: string;
  enabled: boolean;
  onComplete?: () => void;
}): { displayRating: Accessor<number> } {
  const [displayRating, setDisplayRating] = createSignal(args.ratingBefore);

  createEffect(() => {
    void args.animationKey;
    if (!args.enabled) {
      setDisplayRating(args.ratingBefore);
      return;
    }
    const ratingAfter = args.ratingAfter;
    setDisplayRating(ratingAfter);
    args.onComplete?.();
  });

  return { displayRating };
}
