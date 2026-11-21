import { afterEach, describe, expect, test } from 'bun:test';
import type { CustomGamePlace } from '@libs/game-session-client-ts/custom-game-places';
import { FRAME_NO_PLAY } from '@libs/game-session-client-ts/game-frame-empty';
import { cleanup, fireEvent, screen } from '@solidjs/testing-library';
import { frameProps, mountFrame, record, status } from './frame-fixture';

afterEach(cleanup);

const shown = (id: string): boolean => screen.queryByTestId(id) !== null;

const over = (place: CustomGamePlace) =>
  frameProps({
    phase: 'completed',
    place,
    play: FRAME_NO_PLAY,
    status: status({
      description: 'Second side wins by resignation.',
      emphasis: 'neutral',
    }),
    next: { plays: true, canCreate: true, reviewable: true },
  });

describe('the moves place', () => {
  test('shows the board at one position, the four steps under it and every move', () => {
    const sought: number[] = [];
    mountFrame(() =>
      frameProps({
        place: { screen: 'moves' },
        record: record(['1', '2', '3'], { displayedPly: 2 }),
        onSeek: (ply) => sought.push(ply),
      })
    );
    expect(screen.getByTestId('custom-game-reviewing').textContent).toContain(
      'After move 2 of 3'
    );
    fireEvent.click(screen.getByTestId('custom-game-review-back'));
    fireEvent.click(screen.getByTestId('custom-game-review-forward'));
    fireEvent.click(screen.getByTestId('custom-game-review-first'));
    expect(sought).toEqual([1, 3, 0]);
    expect(shown('custom-game-review-move-1')).toBe(true);
    // It never plays: no command of the game.
    expect(shown('custom-game-commands')).toBe(false);
    expect(shown('custom-game-resign')).toBe(false);
  });

  test('a move that was not played is refused in words, with the field still there', () => {
    mountFrame(() =>
      frameProps({
        place: { screen: 'moves' },
        record: record(['1', '2'], {
          displayedPly: 1,
          error: 'Choose a position from the moves actually played.',
        }),
      })
    );
    expect(screen.getByTestId('custom-game-error').textContent).toContain(
      'Choose a position from the moves actually played.'
    );
    expect(shown('custom-game-review-ply')).toBe(true);
  });

  test('the way back leads to the game while it is played and to the result once it is over', () => {
    mountFrame(() => frameProps({ place: { screen: 'moves' } }));
    expect(screen.getByTestId('custom-game-back-to-live').textContent).toBe(
      'Back to the game'
    );
    cleanup();
    mountFrame(() => over({ screen: 'moves' }));
    expect(screen.getByTestId('custom-game-back-to-live').textContent).toBe(
      'Back to the result'
    );
  });
});
