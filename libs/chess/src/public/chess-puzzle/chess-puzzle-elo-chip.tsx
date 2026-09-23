import { dataAttrs } from '@pkgs/ui';
import type { JSX } from 'solid-js';

export type ChessPuzzleEloChipProps = {
  elo: number;
  variant?: 'primary' | 'muted';
  testID?: string;
  /** Hide the chip without dropping its box, so a later rating cannot reflow the row. */
  invisible?: boolean;
};

export function ChessPuzzleEloChip(
  props: ChessPuzzleEloChipProps
): JSX.Element {
  const isPrimary = () =>
    props.variant === undefined || props.variant === 'primary';

  return (
    <div
      class={`box px-2 py-1 rounded-sm shrink-0${props.invisible === true ? ' invisible' : ''}`}
      style={{ background: isPrimary() ? 'tintMuted' : 'surfaceMuted' }}
      {...dataAttrs(
        props.testID !== undefined ? { testid: props.testID } : undefined
      )}
    >
      <p
        class="text w-[2.4em] tabular-nums text-center whitespace-nowrap"
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
