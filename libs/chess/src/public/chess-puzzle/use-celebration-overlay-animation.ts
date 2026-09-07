import { useTimers } from '@pkgs/clock/solid';
import { motion } from '@pkgs/ui';
import { type Accessor, createEffect, createSignal, onCleanup } from 'solid-js';

export type CelebrationOverlayAnimation = {
  scrimOpacity: Accessor<number>;
  cardOpacity: Accessor<number>;
  cardScale: Accessor<number>;
  vignetteOpacity: Accessor<number>;
};

export function useCelebrationOverlayAnimation(
  completionKey: string
): CelebrationOverlayAnimation {
  const timers = useTimers();
  const [scrimOpacity, setScrimOpacity] = createSignal(0);
  const [cardOpacity, setCardOpacity] = createSignal(0);
  const [cardScale, setCardScale] = createSignal(0.92);
  const [vignetteOpacity, setVignetteOpacity] = createSignal(0.15);

  createEffect(() => {
    void completionKey;
    setScrimOpacity(0);
    setCardOpacity(0);
    setCardScale(0.92);
    setVignetteOpacity(0.15);

    const enterId = timers.setTimeout(() => {
      setScrimOpacity(1);
      setCardOpacity(1);
      setCardScale(1);
    }, 0);

    let pulse = true;
    const loopId = timers.setInterval(() => {
      pulse = !pulse;
      setVignetteOpacity(pulse ? 0.35 : 0.15);
    }, motion.duration.slower);

    onCleanup(() => {
      timers.clearTimeout(enterId);
      timers.clearInterval(loopId);
    });
  });

  return { scrimOpacity, cardOpacity, cardScale, vignetteOpacity };
}
