/** @jsxImportSource solid-js */
/**
 * Which place holds which control, what each stage opens on, and how a
 * person moves between the places of a matched game.
 */

import { afterEach, describe, expect, test } from 'bun:test';
import { cleanup, screen } from '@solidjs/testing-library';
import { FINISHED, GAME, mountPlaces } from './multiplayer-places-fixture';

afterEach(cleanup);

const ids = (...names: readonly string[]) =>
  names.filter((name) => screen.queryByTestId(name) !== null);

/** The stage and place the screen's one mark names. */
function mark(): { stage: string | null; place: string | null } {
  const root = screen.getByTestId('multiplayer-screen');
  return {
    stage: root.getAttribute('data-stage'),
    place: root.getAttribute('data-place'),
  };
}

const GAME_COMMANDS = [
  'multiplayer-offer-draw',
  'multiplayer-flip-board',
  'multiplayer-open-moves',
  'multiplayer-resign',
  'multiplayer-abort',
] as const;

describe('each stage opens on its own small screen', () => {
  test('every place names its stage and itself on the one mark', () => {
    const view = mountPlaces({ stage: 'loading' });
    expect(mark()).toEqual({ stage: 'loading', place: 'status' });
    expect(ids('multiplayer-loading', 'multiplayer-unavailable')).toEqual([
      'multiplayer-loading',
    ]);
    view.setStage('unavailable');
    expect(mark()).toEqual({ stage: 'unavailable', place: 'status' });
    view.setStage('idle');
    expect(mark()).toEqual({ stage: 'idle', place: 'find' });
    view.setStage('searching');
    expect(mark()).toEqual({ stage: 'searching', place: 'searching' });
    expect(ids('multiplayer-waiting', 'multiplayer-stop')).toHaveLength(2);
    view.setStage('setup');
    expect(mark()).toEqual({ stage: 'setup', place: 'private-setup' });
    expect(ids('slot-setup', 'slot-board')).toHaveLength(2);
    view.setStage('playing');
    expect(mark()).toEqual({ stage: 'playing', place: 'play' });
    view.set({ game: FINISHED });
    view.setStage('finished');
    expect(mark()).toEqual({ stage: 'finished', place: 'result' });
    expect(ids('slot-outcome', 'slot-board')).toHaveLength(2);
  });

  test('a watcher with no game is told so and given the way back', () => {
    const view = mountPlaces({ stage: 'unavailable' });
    const state = screen.getByTestId('multiplayer-unavailable');
    expect(state.textContent).toContain(
      'No multiplayer game is available to you.'
    );
    screen.getByTestId('multiplayer-unavailable-action').click();
    expect(view.props().onLeave).toHaveBeenCalledTimes(1);
  });

  test('the connection notice and a refusal show on every place', () => {
    const view = mountPlaces({
      stage: 'idle',
      props: {
        online: false,
        error: 'Not now.',
        find: { players: 2, timed: true, timeControl: '5+0' },
      },
    });
    const noticed = () => ids('multiplayer-offline', 'multiplayer-error');
    for (const open of [
      'multiplayer-open-time-control',
      'multiplayer-open-ratings',
      'multiplayer-open-guide',
    ]) {
      expect(noticed()).toHaveLength(2);
      screen.getByTestId(open).click();
      expect(noticed()).toHaveLength(2);
      view.setStage('searching');
      view.setStage('idle');
    }
    expect(view.place()).toBe('find');
    for (const stage of ['searching', 'setup', 'playing'] as const) {
      view.setStage(stage);
      expect(noticed()).toHaveLength(2);
    }
    screen.getByTestId('multiplayer-open-commands').click();
    expect(noticed()).toHaveLength(2);
    screen.getByTestId('multiplayer-open-moves').click();
    expect(noticed()).toHaveLength(2);
    view.set({ game: FINISHED });
    view.setStage('finished');
    expect(noticed()).toHaveLength(2);
  });
});

describe('a place does not outlive its stage', () => {
  test('a place opened in a stage is forgotten when the stage changes, even on return', () => {
    const view = mountPlaces({ stage: 'playing', open: 'commands' });
    expect(view.place()).toBe('commands');
    view.setStage('finished');
    expect(view.place()).toBe('result');
    // A rematch: the new game opens on its board, not on the old menu.
    view.setStage('playing');
    expect(view.place()).toBe('play');
  });

  test('a person stepping through the moves goes on when the game ends', () => {
    const view = mountPlaces({ stage: 'playing', open: 'moves' });
    view.set({ game: FINISHED });
    view.setStage('finished');
    expect(view.place()).toBe('moves');
    expect(view.props().commands.returnToCurrent).not.toHaveBeenCalled();
    expect(mark()).toEqual({ stage: 'finished', place: 'moves' });
  });

  test('leaving the moves returns the board to the game as it stands', () => {
    const view = mountPlaces({ stage: 'playing' });
    screen.getByTestId('multiplayer-move-1').click();
    expect(view.place()).toBe('moves');
    expect(view.props().commands.returnToCurrent).not.toHaveBeenCalled();
    view.setStage('searching');
    expect(view.props().commands.returnToCurrent).toHaveBeenCalledTimes(1);
  });
});

describe('play holds the board and one way to the commands', () => {
  test('play shows no command of the game but the one control that opens them', () => {
    mountPlaces({ stage: 'playing' });
    expect(ids(...GAME_COMMANDS)).toEqual([]);
    expect(ids('slot-board', 'multiplayer-open-commands')).toHaveLength(2);
    // The moves played are listed; the steps through them are not here.
    expect(ids('multiplayer-move-1', 'multiplayer-move-2')).toHaveLength(2);
    expect(ids('multiplayer-review-back', 'multiplayer-moves')).toEqual([]);
  });

  test('a draw offered to the person is answered under the board', () => {
    const view = mountPlaces({
      stage: 'playing',
      props: { game: { ...GAME, draw: 'answer' } },
    });
    screen.getByTestId('multiplayer-accept-draw').click();
    expect(view.props().commands.acceptDraw).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('multiplayer-decline-draw')).toBeTruthy();
    // Offering one back is not among the commands while one waits.
    screen.getByTestId('multiplayer-open-commands').click();
    expect(ids('multiplayer-offer-draw')).toEqual([]);
  });

  test('the commands are rows: a draw, the board, the moves, then leaving apart', () => {
    const view = mountPlaces({ stage: 'playing' });
    screen.getByTestId('multiplayer-open-commands').click();
    expect(view.place()).toBe('commands');
    expect(ids(...GAME_COMMANDS)).toEqual([
      'multiplayer-offer-draw',
      'multiplayer-flip-board',
      'multiplayer-open-moves',
      'multiplayer-resign',
    ]);
    expect(ids('slot-board')).toEqual([]);
    const sections = view.container.querySelectorAll(
      '[data-component="MenuSection"]'
    );
    expect(sections).toHaveLength(2);
    expect(
      sections[1]?.contains(screen.getByTestId('multiplayer-resign'))
    ).toBe(true);
    expect(screen.getByTestId('multiplayer-offer-draw').textContent).toBe(
      'Offer a multiplayer draw'
    );
    expect(screen.getByTestId('multiplayer-resign').textContent).toBe(
      'Resign multiplayer game'
    );
  });

  test('before both have moved, leaving is aborting', () => {
    mountPlaces({
      stage: 'playing',
      open: 'commands',
      props: { game: { ...GAME, leave: 'abort' } },
    });
    expect(ids('multiplayer-abort', 'multiplayer-resign')).toEqual([
      'multiplayer-abort',
    ]);
    expect(screen.getByTestId('multiplayer-abort').textContent).toContain(
      'Abort the multiplayer game'
    );
  });

  test('offering a draw returns to the game once it is accepted', async () => {
    const view = mountPlaces({ stage: 'playing', open: 'commands' });
    screen.getByTestId('multiplayer-offer-draw').click();
    expect(view.props().commands.offerDraw).toHaveBeenCalledTimes(1);
    // While it is sent the other rows wait.
    expect(
      screen.getByTestId('multiplayer-resign').hasAttribute('disabled')
    ).toBe(true);
    await Promise.resolve();
    await Promise.resolve();
    expect(view.place()).toBe('play');
  });

  test('a refused draw offer stays on the commands', async () => {
    const view = mountPlaces({ stage: 'playing', open: 'commands' });
    view.set({
      commands: {
        ...view.props().commands,
        offerDraw: () => Promise.reject(new Error('refused')),
      },
    });
    screen.getByTestId('multiplayer-offer-draw').click();
    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();
    expect(view.place()).toBe('commands');
    expect(
      screen.getByTestId('multiplayer-resign').hasAttribute('disabled')
    ).toBe(false);
  });

  test('flipping the board returns to the game', () => {
    const view = mountPlaces({ stage: 'playing', open: 'commands' });
    screen.getByTestId('multiplayer-flip-board').click();
    expect(view.props().commands.flip).toHaveBeenCalledTimes(1);
    expect(view.place()).toBe('play');
  });

  test('resigning only asks, and the confirmation outlives the game ending under it', () => {
    const view = mountPlaces({ stage: 'playing', open: 'commands' });
    screen.getByTestId('multiplayer-resign').click();
    expect(view.props().commands.ask).toHaveBeenCalledWith('resign');
    expect(view.props().onConfirm).not.toHaveBeenCalled();
    expect(view.place()).toBe('commands');
    view.set({ confirming: 'resign' });
    const confirm = screen.getByTestId('multiplayer-confirm');
    view.set({ game: FINISHED });
    view.setStage('finished');
    expect(view.place()).toBe('result');
    expect(screen.getByTestId('multiplayer-confirm')).toBe(confirm);
  });

  test('a watcher is offered only their own board and the moves', () => {
    mountPlaces({
      stage: 'playing',
      open: 'commands',
      props: { game: { ...GAME, leave: null, draw: 'none' } },
    });
    expect(ids(...GAME_COMMANDS)).toEqual([
      'multiplayer-flip-board',
      'multiplayer-open-moves',
    ]);
  });

  test('a game with nothing to command shows no way to the commands', () => {
    mountPlaces({
      stage: 'playing',
      props: {
        game: { ...GAME, leave: null, draw: 'none', flip: null, moves: null },
      },
    });
    expect(ids('multiplayer-open-commands')).toEqual([]);
  });

  test('while private setups are chosen the commands offer no moves to step through', () => {
    const view = mountPlaces({
      stage: 'setup',
      props: { game: { ...GAME, leave: 'abort' } },
    });
    screen.getByTestId('multiplayer-open-commands').click();
    expect(view.place()).toBe('commands');
    expect(ids(...GAME_COMMANDS)).toEqual([
      'multiplayer-offer-draw',
      'multiplayer-flip-board',
      'multiplayer-abort',
    ]);
  });
});

describe('the moves are a place of their own', () => {
  test('choosing a move on the game opens the moves on it', () => {
    const view = mountPlaces({ stage: 'playing' });
    screen.getByTestId('multiplayer-move-1').click();
    expect(view.props().commands.chooseMove).toHaveBeenCalledWith(1);
    expect(view.place()).toBe('moves');
    expect(
      ids(
        'multiplayer-moves',
        'multiplayer-review-start',
        'multiplayer-review-back',
        'multiplayer-review-forward',
        'multiplayer-review-current',
        'multiplayer-flip-board'
      )
    ).toHaveLength(6);
  });

  test('an earlier position is named, with one step back to the game as it stands', () => {
    const view = mountPlaces({
      stage: 'playing',
      open: 'moves',
      props: {
        game: {
          ...GAME,
          moves: {
            ...GAME.moves!,
            shownPly: 1,
            reviewing: { after: '1. e4' },
          },
        },
      },
    });
    expect(screen.getByTestId('multiplayer-reviewing').textContent).toContain(
      'You are reviewing an earlier position, after 1. e4.'
    );
    expect(
      screen.getByTestId('multiplayer-move-1').getAttribute('aria-current')
    ).toBe('true');
    screen.getByTestId('multiplayer-return-to-current').click();
    expect(view.props().commands.returnToCurrent).toHaveBeenCalledTimes(1);
    screen.getByTestId('multiplayer-review-back').click();
    expect(view.props().commands.stepBack).toHaveBeenCalledTimes(1);
  });

  test('on the current position there is nothing to return to', () => {
    mountPlaces({ stage: 'playing', open: 'moves' });
    expect(ids('multiplayer-reviewing')).toEqual([]);
    expect(
      screen.getByTestId('multiplayer-review-forward').hasAttribute('disabled')
    ).toBe(true);
    expect(
      screen.getByTestId('multiplayer-review-current').hasAttribute('disabled')
    ).toBe(true);
    expect(
      screen.getByTestId('multiplayer-review-back').hasAttribute('disabled')
    ).toBe(false);
  });

  test('an unfinished game offers no record; a finished one offers it with the moves', () => {
    const view = mountPlaces({ stage: 'playing', open: 'moves' });
    const copies = [
      'multiplayer-copy-game-record',
      'multiplayer-copy-final-position',
    ];
    expect(ids(...copies)).toEqual([]);
    view.set({ game: FINISHED });
    expect(ids(...copies)).toEqual(copies);
    screen.getByTestId('multiplayer-copy-final-position').click();
    expect(view.props().commands.copy).toHaveBeenCalledWith('final');
  });
});

describe('the result', () => {
  test('holds the outcome, a rematch and a new opponent, with the moves and ratings one row away', () => {
    const view = mountPlaces({ stage: 'finished', props: { game: FINISHED } });
    expect(
      ids(
        'slot-outcome',
        'slot-board',
        'multiplayer-offer-rematch',
        'multiplayer-new-opponent',
        'multiplayer-open-moves',
        'multiplayer-open-ratings'
      )
    ).toHaveLength(6);
    expect(
      ids(
        ...GAME_COMMANDS.filter((id) => id !== 'multiplayer-open-moves'),
        'multiplayer-copy-game-record',
        'multiplayer-rating-game',
        'multiplayer-move-1',
        'multiplayer-find'
      )
    ).toEqual([]);
    const filled = [
      ...view.container.querySelectorAll('button[data-variant="solid"]'),
    ].map((button) => button.getAttribute('data-testid'));
    expect(filled).toEqual(['multiplayer-new-opponent']);
    screen.getByTestId('multiplayer-open-ratings').click();
    expect(view.place()).toBe('ratings');
    expect(
      screen.getByTestId('multiplayer-rating-game-value').textContent
    ).toBe('1512?');
  });

  test('a rematch offered to the person is the one filled command', () => {
    const view = mountPlaces({
      stage: 'finished',
      props: { game: { ...FINISHED, rematch: 'answer' } },
    });
    const filled = [
      ...view.container.querySelectorAll('button[data-variant="solid"]'),
    ].map((button) => button.getAttribute('data-testid'));
    expect(filled).toEqual(['multiplayer-accept-rematch']);
  });

  test('an aborted game and a watcher are offered no rematch', () => {
    const view = mountPlaces({
      stage: 'finished',
      props: { game: { ...FINISHED, rematch: 'none', record: null } },
    });
    expect(
      ids('multiplayer-offer-rematch', 'multiplayer-accept-rematch')
    ).toEqual([]);
    expect(ids('multiplayer-new-opponent')).toHaveLength(1);
    view.set({ game: { ...FINISHED, rematch: 'none', newOpponent: false } });
    expect(ids('multiplayer-new-opponent')).toEqual([]);
    expect(ids('multiplayer-open-moves')).toHaveLength(1);
  });

  test('the moves of a finished game hold its record', () => {
    const view = mountPlaces({ stage: 'finished', props: { game: FINISHED } });
    screen.getByTestId('multiplayer-open-moves').click();
    expect(view.place()).toBe('moves');
    expect(
      ids('multiplayer-copy-game-record', 'multiplayer-move-2')
    ).toHaveLength(2);
  });
});
