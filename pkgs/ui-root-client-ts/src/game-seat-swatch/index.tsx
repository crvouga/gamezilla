/** @jsxImportSource solid-js */

import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import { type JSX, Show } from 'solid-js';
import type { AvatarSeatColor } from '../avatar/index';

/** A seat's look: its player color, its mark, or both. */
export type GameSeatLook =
  | { color: AvatarSeatColor; mark?: string | undefined }
  | { color?: AvatarSeatColor | undefined; mark: string };

const DOT: Readonly<Record<AvatarSeatColor, string>> = {
  player1: 'bg-player1',
  player2: 'bg-player2',
  player3: 'bg-player3',
  player4: 'bg-player4',
  player5: 'bg-player5',
  player6: 'bg-player6',
  player7: 'bg-player7',
  player8: 'bg-player8',
};

export type GameSeatSwatchProps = {
  look: GameSeatLook;
  /** Accessible name; without one the swatch is decorative. */
  label?: string | undefined;
  /** DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet | undefined;
};

/**
 * `GameSeatSwatch` -- how a seat looks on the board: a round dot in the
 * seat's player color (`player1`..`player8`) and / or a short mark glyph
 * (`●`, `◆`, `X`). A seat with a mark never relies on hue alone.
 *
 * Decorative by default, because the seat's name sits beside it; with a
 * `label` it is an image with that accessible name.
 *
 * @example
 * ```tsx
 * <GameSeatSwatch look={{ color: 'player1', mark: '●' }} />
 * <GameSeatSwatch look={{ mark: 'X' }} label="Plays X" />
 * ```
 */
export function GameSeatSwatch(props: GameSeatSwatchProps): JSX.Element {
  const labelled = (): boolean =>
    props.label !== undefined && props.label.length > 0;
  return (
    <span
      class="box inline-flex flex-row shrink-0 items-center gap-1 h-5"
      role={labelled() ? 'img' : undefined}
      aria-label={labelled() ? props.label : undefined}
      aria-hidden={labelled() ? undefined : 'true'}
      {...dataAttrs({ component: 'GameSeatSwatch', ...props.dataSet })}
      data-seat-color={props.look.color}
      data-mark={props.look.mark}
    >
      <Show when={props.look.color}>
        {(color) => (
          <span
            class={`box size-3 rounded-full ${DOT[color()]}`}
            data-swatch-part="dot"
          />
        )}
      </Show>
      <Show when={props.look.mark}>
        {(mark) => (
          <span class="text textLabel text-text whitespace-nowrap">
            {mark()}
          </span>
        )}
      </Show>
    </span>
  );
}
