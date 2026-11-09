/** @jsxImportSource solid-js */

import type { ComponentDataSet } from '@pkgs/ui-root-shared-ts/component-id';
import { dataAttrs } from '@pkgs/ui-root-shared-ts/component-id';
import { createEffect, createMemo, For, Index, type JSX, Show } from 'solid-js';
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
   * `turn`: only the turn holding the shown move, whole and centred (inside
   * a `MoveStrip`), so a phone never shows a cut-off move; `table`: a turn
   * per line, its moves in columns, scrolling down past the latest few.
   */
  layout: 'turn' | 'table';
  'aria-label': string;
  /** Before the first turn, inside the list: how many earlier moves are not listed. */
  leading?: JSX.Element | undefined;
  /**
   * The word that names every move once, when the game's notation alone
   * is a bare number (`Column`): the `table`'s heading over its move
   * columns, and after the `turn` strip's turn label. The moves stay bare
   * (`● 4`) wherever the record shows them, so the word never repeats.
   */
  heading?: string | undefined;
  /**
   * `turn` only: the shown turn's number in words (`Move 4`), so a strip
   * under a phone's board never leaves a bare number beside the moves.
   */
  turnLabel?: ((turn: number) => JSX.Element) | undefined;
  /**
   * `turn` only: a turn too long for its line (`Move 4 ● G2 hit ● C4 miss`
   * on a phone) wraps between its moves onto a second line, every move
   * whole, instead of running past the strip's edge. For a `MoveStrip`
   * with `overflow="wrap"`.
   */
  wrap?: boolean | undefined;
  dataSet?: ComponentDataSet | undefined;
};

type Turn = {
  readonly number: number;
  readonly moves: readonly GameMoveListEntry[];
};

/** The number of the turn holding a ply; the opening position is turn 1's. */
function turnOf(ply: number, perTurn: number): number {
  return Math.ceil(Math.max(1, ply) / Math.max(1, perTurn));
}

/** Group moves into numbered turns; a turn cut by the window keeps its number. */
function turnsOf(
  moves: readonly GameMoveListEntry[],
  perTurn: number
): readonly Turn[] {
  const size = Math.max(1, perTurn);
  const turns: { number: number; moves: GameMoveListEntry[] }[] = [];
  for (const move of moves) {
    const number = turnOf(move.ply, size);
    const last = turns.at(-1);
    if (last?.number === number) last.moves.push(move);
    else turns.push({ number, moves: [move] });
  }
  return turns;
}

function MoveButton(props: {
  readonly move: GameMoveListEntry;
  readonly layout: GameMoveListProps['layout'];
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
 * move is a button that shows its position. `turn` shows only the turn
 * holding the shown move, whole and centred, for a `MoveStrip` under a
 * phone's board (stepping moves it along); `table` gives every turn its
 * own line with the moves in columns, for the record beside a wide board,
 * and scrolls the marked move into view, the latest while the game is live.
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
  const turns = createMemo(() => {
    const all = turnsOf(props.moves, props.perTurn);
    if (props.layout === 'table') return all;
    const shown = turnOf(props.current, props.perTurn);
    return all.filter((turn) => turn.number === shown);
  });
  let root: HTMLDivElement | undefined;
  // The marked move stays in view. The table scrolls only itself, so the
  // page never jumps to a record beside the board.
  createEffect(() => {
    void props.current;
    void turns();
    if (props.layout !== 'table') return;
    const marked = root?.querySelector<HTMLElement>('[aria-current="step"]');
    if (root === undefined || marked === null || marked === undefined) return;
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
      data-many-seats={columns() > 2}
      data-wrap={props.layout === 'turn' && props.wrap === true}
      style={{ '--move-columns': String(columns()) }}
      {...dataAttrs({ component: 'GameMoveList', ...props.dataSet })}
    >
      {props.leading}
      <Show when={props.layout === 'table' && props.heading}>
        {(heading) => (
          <span
            class={`${styles['heading']} text textCaption`}
            aria-hidden="true"
          >
            {heading()}
          </span>
        )}
      </Show>
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
                <Show
                  when={props.layout === 'turn' && props.turnLabel}
                  fallback={turn().number}
                >
                  {(label) => label()(turn().number)}
                </Show>
              </span>
              <Show when={props.layout === 'turn' && props.heading}>
                {(heading) => (
                  <span
                    class={`${styles['heading']} text textCaption`}
                    aria-hidden="true"
                  >
                    {heading()}
                  </span>
                )}
              </Show>
              <Index each={turn().moves}>
                {(move) => (
                  <MoveButton
                    move={move()}
                    layout={props.layout}
                    perTurn={props.perTurn}
                    current={props.current === move().ply}
                    onSelect={(ply) => props.onSelect(ply)}
                  />
                )}
              </Index>
              <Show when={props.layout === 'turn' && props.wrap === true}>
                <TurnReserve
                  moves={turn().moves}
                  perTurn={props.perTurn}
                  layout={props.layout}
                />
              </Show>
            </li>
          )}
        </Index>
      </ol>
    </div>
  );
}

/**
 * A wrapping turn still waiting on moves keeps the room its full turn will
 * take: an unseen, inert copy of its last move per move to come, so the
 * strip wraps the same before and after they land and nothing under it
 * moves between turns.
 */
function TurnReserve(props: {
  moves: readonly GameMoveListEntry[];
  perTurn: number;
  layout: 'turn' | 'table';
}): JSX.Element {
  const last = (): GameMoveListEntry | undefined => props.moves.at(-1);
  const missing = (): number[] =>
    Array.from(
      { length: Math.max(0, props.perTurn - props.moves.length) },
      (_, n) => n
    );
  return (
    <Show when={last()}>
      {(move) => (
        <For each={missing()}>
          {() => (
            <span
              class={styles['reserve']}
              aria-hidden="true"
              inert
              data-testid="game-move-list-reserve"
            >
              <MoveButton
                move={{ ...move(), testId: undefined }}
                layout={props.layout}
                perTurn={props.perTurn}
                current={false}
                onSelect={() => undefined}
              />
            </span>
          )}
        </For>
      )}
    </Show>
  );
}
