import { dataAttrs } from '@pkgs/ui';
import type { JSX } from 'solid-js';

export type ChessPuzzleEloChipProps = {
  elo: number;
  variant?: 'primary' | 'muted';
  testID?: string;
};

export function ChessPuzzleEloChip(
  props: ChessPuzzleEloChipProps
): JSX.Element {
  const isPrimary = () =>
    props.variant === undefined || props.variant === 'primary';

  return (
    <div
      class="box px-2 py-1 rounded-[6px]"
      style={{ background: isPrimary() ? 'tintMuted' : 'surfaceMuted' }}
      {...dataAttrs(
        props.testID !== undefined ? { testid: props.testID } : undefined
      )}
    >
      <p
        class="text"
        classList={{
          textBodyBold: isPrimary(),
          textCaption: !isPrimary(),
        }}
        style={{ color: isPrimary() ? 'tint' : 'textSecondary' }}
      >
        {String(props.elo)}
      </p>
    </div>
  );
}
