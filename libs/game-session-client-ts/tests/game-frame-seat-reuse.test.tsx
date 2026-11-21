import { afterEach, expect, test } from 'bun:test';
import { FRAME_NO_PLAY } from '@libs/game-session-client-ts/game-frame-empty';
import type { GameFrameScreenViewProps } from '@libs/game-session-client-ts/game-frame-screen-view';
import { stableFrameTable } from '@libs/game-session-client-ts/game-frame-stable-table';
import type {
  FramePlaySeat,
  FrameRecord,
  FrameTable,
} from '@libs/game-session-client-ts/game-frame-view-types';
import type { GameSide } from '@pkgs/turn-game-shared-ts/game-rules';
import { cleanup, screen } from '@solidjs/testing-library';
import { createRoot, createSignal } from 'solid-js';
import { frameProps, mountFrame, status } from './frame-fixture';

afterEach(cleanup);

function seat(side: GameSide, name: string): FramePlaySeat {
  return {
    side,
    sideLabel: name,
    holder: { kind: 'person', person: `${name}-id` },
    plainName: name,
    swatch: { mark: '●' },
    clock: null,
    stat: { label: 'Wins', value: '0' },
    state: null,
    standIn: false,
    committed: false,
    choosing: false,
    facts: [],
    deciding: false,
    reclaim: false,
  };
}

/** A real-time game's record: no turns, so no moves to list. */
const RECORD: FrameRecord = {
  earlier: [],
  selection: 'live',
  turns: false,
  moves: [],
  perTurn: 1,
  movers: [],
  displayedPly: 0,
  error: '',
  history: true,
};

/** A three-rider game played in real time, the viewer riding white. */
function props(): GameFrameScreenViewProps {
  return frameProps({
    title: 'Light Cycles Trio',
    status: status({ description: 'Round 1 · first to 3', plainTurn: false }),
    playerCount: 3,
    table: {
      shape: 'rail',
      near: seat('white', 'avery'),
      others: [seat('black', 'jordan'), seat('red', 'morgan')],
    },
    play: { ...FRAME_NO_PLAY, canResign: true },
    record: RECORD,
    board: <div data-testid="arena" />,
  });
}

/** A real-time tick: every seat read afresh from a new position, same values. */
function tick(
  table: FrameTable,
  wins: Partial<Record<GameSide, string>> = {}
): FrameTable {
  const read = (each: FramePlaySeat): FramePlaySeat => ({
    ...structuredClone({ ...each }),
    stat: { label: 'Wins', value: wins[each.side] ?? each.stat?.value ?? '0' },
  });
  return {
    ...table,
    near: table.near === null ? null : read(table.near),
    others: table.others.map(read),
  };
}

// regression: realtime-seats-rebuilt-every-tick — a game played in real
// time reads a new position many times a second, and every read built
// every seat afresh, so each player's strip, avatar and figure were torn
// down and rebuilt on every tick (most of Light Cycles' and Pong's
// per-tick work beside the arena). The people row keeps each cell.
test('wide: a position-only tick keeps every player cell; a changed figure updates in place', () => {
  const first = props().table;
  const [table, setTable] = createSignal(first);
  mountFrame(() => ({ ...props(), table: table() }), 1440);
  const cells = () =>
    ['white', 'black', 'red'].map((side) =>
      screen.getByTestId(`custom-game-${side}-person`)
    );
  const before = cells();
  setTable(tick(first));
  for (const [index, cell] of cells().entries())
    expect(cell === before[index]).toBe(true);
  setTable(tick(first, { black: '1' }));
  const after = cells();
  for (const [index, cell] of after.entries())
    expect(cell === before[index]).toBe(true);
  expect(after[1]?.textContent).toContain('1');
});

test('a seat that reads the same stays the same object; a changed one is replaced alone', () => {
  createRoot((dispose) => {
    const first = props().table;
    const [table, setTable] = createSignal(first);
    const stable = stableFrameTable(table);
    const near = stable().near;
    const others = stable().others;
    setTable(tick(first));
    expect(stable().near).toBe(near);
    expect(stable().others[0]).toBe(others[0]!);
    setTable(tick(first, { red: '2' }));
    expect(stable().near).toBe(near);
    expect(stable().others[0]).toBe(others[0]!);
    expect(stable().others[1]).not.toBe(others[1]!);
    expect(stable().others[1]?.stat?.value).toBe('2');
    dispose();
  });
});
