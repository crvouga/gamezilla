import { useTimers } from '@pkgs/clock/solid';
import { Box, motion, Text } from '@pkgs/ui';
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
    <Box
      sx={{
        transform: [{ scale: scale() }],
        transitionProperty: 'transform',
        transitionDuration: 'var(--ui-duration-fast)',
        transitionTimingFunction: 'var(--ui-easing-standard)',
      }}
    >
      <Box
        dataSet={
          props.testID !== undefined ? { testid: props.testID } : undefined
        }
        sx={{
          px: 2,
          py: 1,
          borderRadius: 6,
          background: isPrimary() ? 'tintMuted' : 'surfaceMuted',
        }}
      >
        <Text
          variant={isPrimary() ? 'bodyBold' : 'caption'}
          sx={{ color: isPrimary() ? 'tint' : 'textSecondary' }}
          label={String(props.elo)}
        />
      </Box>
    </Box>
  );
}
