import { afterEach, expect, test } from 'bun:test';
import {
  FRAME_NO_NEXT,
  FRAME_NO_PLAY,
} from '@libs/game-session-client-ts/game-frame-empty';
import {
  GameFrameScreenView,
  type GameFrameScreenViewProps,
} from '@libs/game-session-client-ts/game-frame-screen-view';
import { stableFrameTable } from '@libs/game-session-client-ts/game-frame-stable-table';
import type {
  FramePlaySeat,
  FrameRecord,
  FrameTable,
} from '@libs/game-session-client-ts/game-frame-view-types';
import { renderWithI18n } from '@pkgs/bun-test-solid-client-ts/render';
import { ClockProvider } from '@pkgs/clock-client-ts/solid';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import type { GameSide } from '@pkgs/turn-game-shared-ts/game-rules';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';
import { cleanup, screen } from '@solidjs/testing-library';
import { createRoot, createSignal } from 'solid-js';

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

const resolved = async (): Promise<void> => undefined;

function props(): GameFrameScreenViewProps {
  return {
    title: 'Light Cycles Trio',
    phase: 'active',
    viewerSide: 'white',
    watchers: 0,
    connection: 'online',
    error: '',
    stopped: false,
    status: {
      lineup: '',
      description: 'Round 1 · first to 3',
      plainTurn: false,
      emphasis: 'neutral',
      tone: 'neutral',
      sending: false,
      minutes: 0,
      increment: 0,
    },
    canCreate: false,
    playerCount: 3,
    setup: null,
    table: {
      shape: 'rail',
      near: seat('white', 'avery'),
      others: [seat('black', 'jordan'), seat('red', 'morgan')],
    },
    play: { ...FRAME_NO_PLAY, canResign: true },
    result: null,
    next: FRAME_NO_NEXT,
    record: RECORD,
    board: <div data-testid="arena" />,
    onChoose: resolved,
    onReady: resolved,
    onPlayBot: resolved,
    onRandomSetup: resolved,
    onBack: () => undefined,
    onSeek: () => undefined,
    onReturnLive: () => undefined,
    onSelectRecord: () => undefined,
    onOpenHistory: () => undefined,
  };
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
// per-tick work beside the arena).
test('wide: a position-only tick keeps every player strip; a changed figure updates in place', () => {
  const time = createHarnessClock();
  const first = props().table;
  const [table, setTable] = createSignal(first);
  renderWithI18n(() => (
    <ClockProvider clock={time.clock} timers={time.timers}>
      <ThemeProvider
        colorScheme="dark"
        fixedLayout={{ width: 1440, height: 900 }}
      >
        <GameFrameScreenView {...props()} table={table()} />
      </ThemeProvider>
    </ClockProvider>
  ));
  const strips = () =>
    ['white', 'black', 'red'].map((side) =>
      screen.getByTestId(`custom-game-${side}`)
    );
  const before = strips();
  setTable(tick(first));
  for (const [index, strip] of strips().entries())
    expect(strip === before[index]).toBe(true);
  setTable(tick(first, { black: '1' }));
  const after = strips();
  for (const [index, strip] of after.entries())
    expect(strip === before[index]).toBe(true);
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
