import { useTimers } from '@pkgs/clock/solid';
import { dataAttrs, motion, Text } from '@pkgs/ui';
import { createEffect, createSignal, type JSX, onCleanup } from 'solid-js';

const PULSE_SCALE = 1.14;

export type ChessPuzzleEloChipProps = {
  elo: number;
  variant?: 'primary' | 'muted';
  testID?: string;
  pulseNonce?: number;
};

export function ChessPuzzleEloChip(
  props: ChessPuzzleEloChipProps
): JSX.Element {
  const timers = useTimers();
  const isPrimary = () =>
    props.variant === undefined || props.variant === 'primary';
  const [scale, setScale] = createSignal(1);

  createEffect(() => {
    const nonce = props.pulseNonce ?? 0;
    if (nonce === 0) return;
    setScale(PULSE_SCALE);
    const id = timers.setTimeout(() => setScale(1), motion.duration.fast);
    onCleanup(() => timers.clearTimeout(id));
  });

  return (
    <div
      class="box [transition-property:transform] [transition-duration:var(--ui-duration-fast)] [transition-timing-function:var(--ui-easing-standard)]"
      style={{ transform: `scale(${scale()})` }}
    >
      <div
        class="box px-2 py-1 rounded-[6px]"
        style={{ background: isPrimary() ? 'tintMuted' : 'surfaceMuted' }}
        {...dataAttrs(
          props.testID !== undefined ? { testid: props.testID } : undefined
        )}
      >
        <Text
          variant={isPrimary() ? 'bodyBold' : 'caption'}
          style={{ color: isPrimary() ? 'tint' : 'textSecondary' }}
        >
          {String(props.elo)}
        </Text>
      </div>
    </div>
  );
}
