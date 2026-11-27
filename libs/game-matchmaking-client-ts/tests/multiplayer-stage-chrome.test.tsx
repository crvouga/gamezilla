/** @jsxImportSource @solidjs/web */
/**
 * The matchmaking home and the search drawn as a game's own stage: the
 * chosen clock is one row over the Find command, and a search is a state
 * on the board's place over the person's seat, with Stop at the foot.
 */

import { afterEach, expect, test } from 'bun:test';
import { cleanup, screen } from '@solidjs/testing-library';
import { mountPlaces } from './multiplayer-places-fixture';

afterEach(cleanup);

const WIDTHS = [390, 1440];

const YOU = {
  avatar: <span data-testid="you-avatar" />,
  name: <span data-testid="you-name">River</span>,
};

test('a timed game puts its chosen clock as one row directly over Find, in the dock', () => {
  for (const width of WIDTHS) {
    const { container } = mountPlaces({
      stage: 'idle',
      width,
      props: { find: { players: 2, timed: true, timeControl: '3+2' } },
    });
    const dock = container.querySelector('[data-component="GameLobbyDock"]');
    const row = screen.getByTestId('multiplayer-open-time-control');
    const find = screen.getByTestId('multiplayer-find');
    expect(dock?.contains(row)).toBe(true);
    // Words and speed, not shorthand.
    expect(row.textContent).toContain('3 min');
    expect(row.textContent).toContain('Blitz');
    expect(row.getAttribute('aria-label')).toContain('Time control');
    // Directly above the command: nothing sits between the row and Find.
    const choice = screen.getByTestId('multiplayer-time-control-choice');
    expect(choice.nextElementSibling).toBe(find);
    // One row for the clock, and only the ratings row stays in the hub.
    expect(
      container.querySelectorAll(
        '[data-testid="multiplayer-open-time-control"]'
      )
    ).toHaveLength(1);
    row.click();
    expect(screen.queryByTestId('multiplayer-find')).toBeNull();
    cleanup();
  }
});

test('an untimed game has no clock row and no fake clock', () => {
  const { container } = mountPlaces({
    stage: 'idle',
    props: { find: { players: 2, timed: false, timeControl: '5+0' } },
  });
  expect(screen.queryByTestId('multiplayer-open-time-control')).toBeNull();
  expect(screen.queryByTestId('multiplayer-time-control-choice')).toBeNull();
  expect(screen.getByTestId('multiplayer-find-clock').textContent).toBe(
    'Untimed'
  );
  expect(container.querySelector('[data-component="GameClock"]')).toBeNull();
});

test('the time-control place marks the chosen control pressed and no other', () => {
  mountPlaces({
    stage: 'idle',
    open: 'time-control',
    props: { find: { players: 2, timed: true, timeControl: '3+2' } },
  });
  const pressed = [
    ...document.querySelectorAll('[data-testid^="multiplayer-time-control-"]'),
  ].filter((button) => button.getAttribute('aria-pressed') === 'true');
  expect(pressed.map((button) => button.getAttribute('data-testid'))).toEqual([
    'multiplayer-time-control-3-2',
  ]);
});

test('a search is a state on the board place, over the person and their clock, with Stop in the dock', () => {
  for (const width of WIDTHS) {
    const { container } = mountPlaces({
      stage: 'searching',
      width,
      props: {
        you: YOU,
        search: {
          players: 2,
          gameName: 'Chess',
          timeControl: '5+3',
          seconds: 9,
        },
      },
    });
    const stage = container.querySelector('[data-component="GameSearchStage"]');
    expect(stage?.querySelector('h2')?.textContent).toBe('Searching…');
    // What is sought and how long, in the stage's own words.
    expect(screen.getByTestId('multiplayer-waiting').textContent).toContain(
      'Looking for a 5+3 Chess opponent.'
    );
    expect(screen.getByTestId('multiplayer-waiting-seconds').textContent).toBe(
      '9'
    );
    // The person's seat, with their chosen clock in words, stays visible.
    const seat = screen.getByTestId('multiplayer-search-seat');
    expect(stage?.contains(seat)).toBe(true);
    expect(seat.contains(screen.getByTestId('you-name'))).toBe(true);
    expect(screen.getByTestId('multiplayer-waiting-clock').textContent).toBe(
      '5 min + 3 sec'
    );
    // The clock is said once: the card's line names no time.
    expect(
      container.querySelector('[data-component="GameModeCard"]')?.textContent
    ).not.toContain('5 min');
    // Stop is the bottom command.
    const dock = container.querySelector('[data-component="GameLobbyDock"]');
    expect(dock?.contains(screen.getByTestId('multiplayer-stop'))).toBe(true);
    cleanup();
  }
});

test('an untimed search says untimed once and shows no clock on the seat', () => {
  const { container } = mountPlaces({
    stage: 'searching',
    props: {
      you: YOU,
      search: { players: 2, gameName: 'Chess', timeControl: null, seconds: 1 },
    },
  });
  expect(screen.queryByTestId('multiplayer-waiting-clock')).toBeNull();
  expect(
    container.querySelector('[data-component="GameModeCard"]')?.textContent
  ).toContain('Untimed');
});

test('offline, the search holds still: a still mark, its words, and Stop held back', () => {
  const { container } = mountPlaces({
    stage: 'searching',
    props: { you: YOU, online: false },
  });
  expect(
    container.querySelector('[data-component="GameSearchStage"] h2')
      ?.textContent
  ).toBe("You're offline");
  expect(screen.getByTestId('multiplayer-waiting-offline')).toBeTruthy();
  expect(screen.getByTestId('multiplayer-stop').hasAttribute('disabled')).toBe(
    true
  );
});
