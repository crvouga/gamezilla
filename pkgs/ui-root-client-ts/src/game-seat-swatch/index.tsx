/** @jsxImportSource solid-js */

import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import { type JSX, Show } from 'solid-js';
import type { AvatarSeatColor } from '../avatar/index';

/**
 * A seat's paint: a player color (`player1`..`player8`), or the paint of a
 * board whose pieces are not drawn in player colors, so the swatch matches
 * the pieces on it in both themes: `disc-one` and `disc-two` are the first
 * and second disc of the disc-drop board, `trail-one` to `trail-four` the
 * first to fourth rider's trail in a trail arena, `pawn-one` to `pawn-four`
 * the first to fourth pawn ink of the pawn-and-wall board.
 */
export type GameSeatColor =
  | AvatarSeatColor
  | 'disc-one'
  | 'disc-two'
  | 'trail-one'
  | 'trail-two'
  | 'trail-three'
  | 'trail-four'
  | 'pawn-one'
  | 'pawn-two'
  | 'pawn-three'
  | 'pawn-four';

/** A seat's look: its paint, its mark, or both. */
export type GameSeatLook =
  | { color: GameSeatColor; mark?: string | undefined }
  | { color?: GameSeatColor | undefined; mark: string };

const DOT: Readonly<Record<GameSeatColor, string>> = {
  'disc-one': 'bg-game-connect-four-one',
  'disc-two': 'bg-game-connect-four-two',
  'trail-one': 'bg-game-light-cycles-accent',
  'trail-two': 'bg-game-light-cycles-one',
  'trail-three': 'bg-game-light-cycles-two',
  'trail-four': 'bg-game-light-cycles-ink',
  'pawn-one': 'bg-game-quoridor-surface',
  'pawn-two': 'bg-game-quoridor-surface',
  'pawn-three': 'bg-game-quoridor-surface',
  'pawn-four': 'bg-game-quoridor-surface',
  player1: 'bg-player1',
  player2: 'bg-player2',
  player3: 'bg-player3',
  player4: 'bg-player4',
  player5: 'bg-player5',
  player6: 'bg-player6',
  player7: 'bg-player7',
  player8: 'bg-player8',
};

/**
 * A pawn paint is the board's own square with the pawn's ink on it, as the
 * pawn is drawn: the mark carries the color, so the seat's chip, legend and
 * pawn read the same in both themes, where a theme's player colors cannot.
 */
export const GAME_SEAT_PAWN_INKS: Readonly<
  Record<'pawn-one' | 'pawn-two' | 'pawn-three' | 'pawn-four', string>
> = {
  'pawn-one': 'text-game-quoridor-one',
  'pawn-two': 'text-game-quoridor-three',
  'pawn-three': 'text-game-quoridor-two',
  'pawn-four': 'text-game-quoridor-ink',
};

function isPawnPaint(
  paint: GameSeatColor | undefined
): paint is keyof typeof GAME_SEAT_PAWN_INKS {
  return (
    paint === 'pawn-one' ||
    paint === 'pawn-two' ||
    paint === 'pawn-three' ||
    paint === 'pawn-four'
  );
}

export type GameSeatSwatchProps = {
  look: GameSeatLook;
  /** Accessible name; without one the swatch is decorative. */
  label?: string | undefined;
  /** DOM `data-*` identifiers (`data-component`, `data-src`, …). */
  dataSet?: ComponentDataSet | undefined;
};

/**
 * `GameSeatSwatch` -- how a seat looks on the board, as one token: a disc in
 * the seat's paint (a player color, or the board's own disc paint, so the
 * legend matches the pieces) carrying its short mark
 * glyph (`●`, `◆`, `X`) in the canvas ink, like a piece on the board; a mark
 * alone without a color. A seat with a mark never relies on hue alone.
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
  const color = (): GameSeatColor | undefined => props.look.color;
  // A board's own paint carries its mark in the board's canvas ink, as
  // the pieces on it do; a player color in the screen's canvas ink.
  const discPaint = (): boolean =>
    color() === 'disc-one' || color() === 'disc-two';
  const trailPaint = (): boolean => color()?.startsWith('trail-') === true;
  const pawnInk = (): string | undefined => {
    const paint = color();
    return isPawnPaint(paint) ? GAME_SEAT_PAWN_INKS[paint] : undefined;
  };
  return (
    <span
      class="box inline-flex flex-row shrink-0 items-center justify-center size-5"
      classList={{
        'rounded-full': color() !== undefined,
        [DOT[color() ?? 'player1']]: color() !== undefined,
      }}
      role={labelled() ? 'img' : undefined}
      aria-label={labelled() ? props.label : undefined}
      aria-hidden={labelled() ? undefined : 'true'}
      {...dataAttrs({ component: 'GameSeatSwatch', ...props.dataSet })}
      data-seat-color={props.look.color}
      data-mark={props.look.mark}
    >
      <Show when={props.look.mark}>
        {(mark) => (
          <span
            class={`text textLabel whitespace-nowrap ${pawnInk() ?? ''}`}
            classList={{
              'text-background':
                color() !== undefined &&
                !discPaint() &&
                !trailPaint() &&
                pawnInk() === undefined,
              'text-game-connect-four-canvas': discPaint(),
              'text-game-light-cycles-canvas': trailPaint(),
              'text-text': color() === undefined,
            }}
          >
            {mark()}
          </span>
        )}
      </Show>
    </span>
  );
}
