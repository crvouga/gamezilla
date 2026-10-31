import { describe, expect, test } from 'bun:test';
import {
  frameHeadline,
  frameHeadlineText,
  frameStandingRows,
} from '@libs/game-session-client-ts/game-frame-headline';
import { FrameWatching } from '@libs/game-session-client-ts/game-frame-play';
import { customGameWinner } from '@libs/game-session-client-ts/game-frame-result';
import {
  frameTable,
  sameTable,
} from '@libs/game-session-client-ts/game-frame-table';
import { seatedPeople } from '@libs/game-session-client-ts/game-frame-watchers';
import type { CustomGameScreenModel } from '@libs/game-session-client-ts/use-custom-game-screen';
import {
  type CustomGame,
  newCustomGame,
} from '@libs/game-session-shared-ts/custom-game-state';
import { renderWithI18n } from '@pkgs/bun-test-solid-client-ts/render';
import {
  standingsByScore,
  standingsFromWinner,
} from '@pkgs/turn-game-shared-ts/game-frame';
import {
  GAME_SIDES,
  type GameSide,
} from '@pkgs/turn-game-shared-ts/game-rules';
import { GameStandings } from '@pkgs/ui-root-client-ts/game-result';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';
import { screen } from '@solidjs/testing-library';
import type { JSX } from 'solid-js';

const NAMES: Readonly<Record<GameSide, string>> = {
  white: 'Erin',
  black: 'Sam',
  red: 'Robin',
  blue: 'Kai',
};
const nameOf = (side: GameSide): string => NAMES[side];

function themed(ui: () => JSX.Element) {
  return renderWithI18n(() => (
    <ThemeProvider colorScheme="light">{ui()}</ThemeProvider>
  ));
}

describe('the table around the board', () => {
  test('one other seat is a strip, two or more a rail, a solo table none', () => {
    expect(frameTable(['white', 'black'], 'white').shape).toBe('strip');
    expect(frameTable(['white', 'black', 'red'], 'white').shape).toBe('rail');
    expect(frameTable(GAME_SIDES, 'red').shape).toBe('rail');
    expect(frameTable(['white'], 'white')).toEqual({
      near: null,
      others: [],
      shape: 'none',
    });
  });

  test('the near strip is the viewer own seat, every other seat is above', () => {
    expect(frameTable(GAME_SIDES, 'red')).toEqual({
      near: 'red',
      others: ['white', 'black', 'blue'],
      shape: 'rail',
    });
    expect(frameTable(['white', 'black'], 'black').others).toEqual(['white']);
  });

  test('a table seating everyone in the same places is the same table', () => {
    expect(
      sameTable(frameTable(GAME_SIDES, 'red'), frameTable(GAME_SIDES, 'red'))
    ).toBe(true);
    expect(
      sameTable(frameTable(GAME_SIDES, 'red'), frameTable(GAME_SIDES, null))
    ).toBe(false);
  });

  test('a watcher has no own seat: the first side sits nearest', () => {
    expect(frameTable(['white', 'black'], null)).toEqual({
      near: 'white',
      others: ['black'],
      shape: 'strip',
    });
    expect(frameTable(GAME_SIDES, null).others).toEqual([
      'black',
      'red',
      'blue',
    ]);
  });
});

function watchingModel(
  game: CustomGame | null,
  side: GameSide | null
): CustomGameScreenModel {
  return {
    current: () => game,
    mySide: () => side,
  } as unknown as CustomGameScreenModel;
}

function activeGame(): CustomGame {
  return { ...newCustomGame('g', 'alice', 'position'), status: 'active' };
}

describe('watching a game', () => {
  test('someone without a seat in a game under way is told they are watching', () => {
    themed(() => <FrameWatching model={watchingModel(activeGame(), null)} />);
    expect(screen.getByText("You're watching")).toBeInTheDocument();
  });

  test('a player, or a game not under way, shows no watching footer', () => {
    const view = themed(() => (
      <>
        <FrameWatching model={watchingModel(activeGame(), 'white')} />
        <FrameWatching
          model={watchingModel(newCustomGame('g', 'alice', 'position'), null)}
        />
      </>
    ));
    expect(view.container.textContent).toBe('');
  });

  test('the people seated at the game never count as watching', () => {
    const game: CustomGame = {
      ...activeGame(),
      black: { kind: 'person', person: 'bob' },
    };
    expect([...seatedPeople(game)].sort()).toEqual(['alice', 'bob']);
    expect(
      seatedPeople({ ...game, black: { kind: 'bot', person: '' } })
    ).toEqual(new Set(['alice']));
  });
});

describe('the game-over headline', () => {
  const twoSeats = ['white', 'black'] as const;
  const text = (
    standings: Parameters<typeof frameHeadline>[0],
    viewer: GameSide | null
  ) => frameHeadlineText(frameHeadline(standings, viewer), nameOf, 'en');

  test('a seated winner reads "You win", a seated loser their place', () => {
    const standings = standingsFromWinner('black', twoSeats);
    expect(text(standings, 'black')).toBe('You win');
    expect(text(standings, 'white')).toBe('You came 2nd');
  });

  test('a watcher reads who won, by name', () => {
    expect(text(standingsFromWinner('white', twoSeats), null)).toBe(
      'Erin wins'
    );
    expect(text(standingsFromWinner(['white', 'red'], GAME_SIDES), null)).toBe(
      'Erin and Robin win'
    );
  });

  test('a draw is a draw for everyone', () => {
    const standings = standingsFromWinner('draw', twoSeats);
    expect(text(standings, 'white')).toBe('Draw');
    expect(text(standings, null)).toBe('Draw');
  });

  test('a seated player placed third at a scored table', () => {
    const scores: Readonly<Record<GameSide, number>> = {
      white: 40,
      black: 12,
      red: 30,
      blue: 55,
    };
    const standings = standingsByScore({
      winner: 'black',
      sides: GAME_SIDES,
      score: (side) => scores[side],
      best: 'lowest',
    });
    expect(text(standings, 'white')).toBe('You came 3rd');
  });

  test('the result follows the stored outcome', () => {
    const over = { ...activeGame(), status: 'completed' as const };
    expect(customGameWinner({ ...over, outcome: 'draw' })).toBe('draw');
    expect(
      customGameWinner({ ...over, outcome: 'black wins by resignation' })
    ).toBe('black');
    expect(customGameWinner(activeGame())).toBeNull();
  });
});

describe('the standings', () => {
  test('first place first, the viewer marked, each with its score', () => {
    const scores: Readonly<Record<GameSide, number>> = {
      white: 40,
      black: 12,
      red: 30,
      blue: 55,
    };
    const rows = frameStandingRows(
      standingsByScore({
        winner: 'black',
        sides: GAME_SIDES,
        score: (side) => scores[side],
        best: 'lowest',
      }),
      'red',
      nameOf
    );
    expect(rows.map((row) => [row.name, row.place, row.score])).toEqual([
      ['Sam', 1, '12'],
      ['Robin', 2, '30'],
      ['Erin', 3, '40'],
      ['Kai', 4, '55'],
    ]);
    themed(() => (
      <GameStandings aria-label="Standings" scoreLabel="Score" rows={rows} />
    ));
    const items = screen.getAllByRole('listitem');
    expect(items.map((item) => item.getAttribute('data-testid'))).toEqual([
      'custom-game-standing-black',
      'custom-game-standing-red',
      'custom-game-standing-white',
      'custom-game-standing-blue',
    ]);
    expect(items[1]).toHaveAttribute('aria-current', 'true');
  });
});
