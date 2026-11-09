import { afterEach, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import {
  FRAME_NO_NEXT,
  FRAME_NO_PLAY,
} from '@libs/game-session-client-ts/game-frame-empty';
import {
  GameFrameScreenView,
  type GameFrameScreenViewProps,
} from '@libs/game-session-client-ts/game-frame-screen-view';
import type {
  FramePlaySeat,
  FrameRecord,
} from '@libs/game-session-client-ts/game-frame-view-types';
import { renderWithI18n } from '@pkgs/bun-test-solid-client-ts/render';
import { ClockProvider } from '@pkgs/clock-client-ts/solid';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import type { GameSide } from '@pkgs/turn-game-shared-ts/game-rules';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';
import { cleanup, screen } from '@solidjs/testing-library';

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

const LONG = 'jordan_plays_every_night';

function mountWide(): void {
  const time = createHarnessClock();
  const shown = props();
  const black = shown.table.others[0];
  if (!black) throw new Error('Missing seat');
  // One long name and no tag; the viewer's own seat has You.
  const table = {
    ...shown.table,
    others: [
      { ...black, plainName: LONG, holder: { kind: 'local' as const } },
      ...shown.table.others.slice(1),
    ],
  };
  renderWithI18n(() => (
    <ClockProvider clock={time.clock} timers={time.timers}>
      <ThemeProvider
        colorScheme="light"
        fixedLayout={{ width: 1440, height: 900 }}
      >
        <GameFrameScreenView {...shown} table={table} />
      </ThemeProvider>
    </ClockProvider>
  ));
}

// regression: arena-rail-rows-misaligned — beside a wide arena a long
// name wrapped under its swatch and tags wrapped to a second line, so the
// Players card's rows differed in shape and height.
test('wide arena rail: each strip is one line, a long name cut short with its full name kept', () => {
  mountWide();
  const board = screen.getByTestId('custom-game-scoreboard');
  for (const side of ['white', 'black', 'red']) {
    const strip = board.querySelector(`[data-testid="custom-game-${side}"]`);
    const name = strip?.querySelector('[title]');
    const swatch = strip?.querySelector('[data-component="GameSeatSwatch"]');
    // Swatch and name share one line that never wraps.
    expect(swatch?.parentElement === name?.parentElement).toBe(true);
    expect(name?.parentElement?.classList.contains('flex-wrap')).toBe(false);
  }
  const long = board.querySelector(`[title="${LONG}"]`);
  // The whole name stays reachable in the tooltip when it is cut short.
  expect(long === null).toBe(false);
  const you = [...board.querySelectorAll('[data-component="Badge"]')].find(
    (badge) => badge.textContent === 'You'
  );
  expect(
    screen
      .getByTestId('custom-game-white')
      .querySelector('[title]')
      ?.parentElement?.contains(you ?? null)
  ).toBe(true);
  const sheet = readFileSync(
    join(
      import.meta.dir,
      '../../../pkgs/ui-root-client-ts/src/game-ui.module.css'
    ),
    'utf8'
  );
  const rule = (selector: string) =>
    sheet.split(`\n${selector} {`)[1]?.split('}')[0] ?? '';
  expect(rule('.playerOneLine')).toContain('flex-wrap: nowrap;');
  expect(rule('.playerOneLine > .playerTags')).toContain('flex-shrink: 0;');
  expect(rule('.playerName')).toContain('white-space: nowrap;');
  expect(rule('.playerName')).toContain('text-overflow: ellipsis;');
});
