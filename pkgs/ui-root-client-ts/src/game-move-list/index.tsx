/** @jsxImportSource solid-js */

import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import { createEffect, createMemo, Index, type JSX, Show } from 'solid-js';
import { type GameSeatLook, GameSeatSwatch } from '../game-seat-swatch/index';
import styles from './game-move-list.module.css';

/** One move of a game's record. */
export type GameMoveListEntry = {
  /** Moves played to reach the position after it: 1 for the first move. */
  readonly ply: number;
  /** The move as the game writes it (`e4`, `5`). */
  readonly label: string;
  /** The look of the seat that made it; unset when the game names no mover. */
  readonly swatch?: GameSeatLook | undefined;
  /** Accessible name of the move's button ("Move 3, Red circle: 5"). */
  readonly accessibleName: string;
  /** Rendered as the button's `data-testid`. */
  readonly testId?: string | undefined;
};

export type GameMoveListProps = {
  /** The listed moves, in order; a long game's latest only. */
  moves: readonly GameMoveListEntry[];
  /**
   * Moves per numbered turn: the seats in rotation (2 for chess:
   * `1 e4 e5`); 1 numbers every move.
   */
  perTurn: number;
  /** The ply shown on the board; its move is marked. */
  current: number;
  onSelect: (ply: number) => void;
  /**
   * `row`: one line that scrolls sideways (inside a `MoveStrip`);
   * `table`: a turn per line, its moves in columns, scrolling down past
   * the latest few.
   */
  layout: 'row' | 'table';
  'aria-label': string;
  /** Before the first turn, inside the list: how many earlier moves are not listed. */
  leading?: JSX.Element | undefined;
  dataSet?: ComponentDataSet | undefined;
};

type Turn = {
  readonly number: number;
  readonly moves: readonly GameMoveListEntry[];
};

/** Group moves into numbered turns; a turn cut by the window keeps its number. */
function turnsOf(
  moves: readonly GameMoveListEntry[],
  perTurn: number
): readonly Turn[] {
  const size = Math.max(1, perTurn);
  const turns: { number: number; moves: GameMoveListEntry[] }[] = [];
  for (const move of moves) {
    const number = Math.ceil(move.ply / size);
    const last = turns.at(-1);
    if (last?.number === number) last.moves.push(move);
    else turns.push({ number, moves: [move] });
  }
  return turns;
}

function MoveButton(props: {
  readonly move: GameMoveListEntry;
  readonly perTurn: number;
  readonly current: boolean;
  readonly onSelect: (ply: number) => void;
}): JSX.Element {
  // The button holds only the move's own words, so it reads as the game
  // wrote it; the seat's swatch sits beside it. Its column is its place in
  // the turn, so a turn cut by the window still lines up.
  const column = (): number =>
    ((props.move.ply - 1) % Math.max(1, props.perTurn)) + 2;
  return (
    <span class={styles['move']} style={{ '--move-column': String(column()) }}>
      <Show when={props.move.swatch}>
        {(look) => <GameSeatSwatch look={look()} />}
      </Show>
      <button
        type="button"
        class={`${styles['moveButton']} text textLabel`}
        data-current={props.current}
        aria-current={props.current ? 'step' : undefined}
        aria-label={props.move.accessibleName}
        data-testid={props.move.testId}
        onClick={() => props.onSelect(props.move.ply)}
      >
        {props.move.label}
      </button>
    </span>
  );
}

/**
 * `GameMoveList` -- a game's record as numbered turns: each turn's number,
 * then every move in it behind the swatch of the seat that made it
 * (`1 ● e4 ◆ e5`), the move on the board marked (also `aria-current`). A
 * move is a button that shows its position. `row` runs along one line for
 * a `MoveStrip` under a phone's board; `table` gives every turn its own
 * line with the moves in columns, for the record beside a wide board. The
 * marked move scrolls into view, the latest while the game is live.
 *
 * @example
 * ```tsx
 * <GameMoveList
 *   layout="table"
 *   aria-label="Moves played"
 *   perTurn={2}
 *   current={3}
 *   moves={[{ ply: 1, label: 'e4', swatch: { mark: '○' }, accessibleName: 'Move 1, White: e4' }]}
 *   onSelect={seek}
 * />
 * ```
 */
export function GameMoveList(props: GameMoveListProps): JSX.Element {
  const turns = createMemo(() => turnsOf(props.moves, props.perTurn));
  let root: HTMLDivElement | undefined;
  // The marked move stays in view. The table scrolls only itself, so the
  // page never jumps to a record beside the board.
  createEffect(() => {
    void props.current;
    void turns();
    const marked = root?.querySelector<HTMLElement>('[aria-current="step"]');
    if (root === undefined || marked === null || marked === undefined) return;
    if (props.layout === 'row') {
      marked.scrollIntoView({
        behavior: 'instant',
        block: 'nearest',
        inline: 'nearest',
      });
      return;
    }
    const box = root.getBoundingClientRect();
    const move = marked.getBoundingClientRect();
    if (move.bottom > box.bottom) root.scrollTop += move.bottom - box.bottom;
    else if (move.top < box.top) root.scrollTop -= box.top - move.top;
  });
  const columns = (): number => Math.max(1, props.perTurn);
  return (
    <div
      ref={root}
      class={styles['list']}
      data-layout={props.layout}
      style={{ '--move-columns': String(columns()) }}
      {...dataAttrs({ component: 'GameMoveList', ...props.dataSet })}
    >
      {props.leading}
      <ol class={styles['turns']} aria-label={props['aria-label']}>
        {/* By position, not by object: a move appended updates its own
            turn, never the whole list. */}
        <Index each={turns()}>
          {(turn) => (
            <li class={styles['turn']}>
              <span
                class={`${styles['number']} text textCaption`}
                aria-hidden="true"
              >
                {turn().number}
              </span>
              <Index each={turn().moves}>
                {(move) => (
                  <MoveButton
                    move={move()}
                    perTurn={props.perTurn}
                    current={props.current === move().ply}
                    onSelect={(ply) => props.onSelect(ply)}
                  />
                )}
              </Index>
            </li>
          )}
        </Index>
      </ol>
    </div>
  );
}
