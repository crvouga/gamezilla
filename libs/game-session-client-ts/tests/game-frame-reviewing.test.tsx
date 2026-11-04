import { afterEach, expect, mock, test } from 'bun:test';
import {
  FrameReviewingView,
  recordReviewing,
} from '@libs/game-session-client-ts/game-frame-record-view';
import type { FrameRecord } from '@libs/game-session-client-ts/game-frame-view-types';
import { renderWithI18n } from '@pkgs/bun-test-solid-client-ts/render';
import { cleanup, fireEvent, screen } from '@solidjs/testing-library';

afterEach(cleanup);

function record(displayedPly: number, selection = 'live'): FrameRecord {
  return {
    earlier: [],
    selection,
    turns: true,
    moves: ['4', '4', '5', '3', '3', '5', '6'],
    perTurn: 2,
    movers: [],
    displayedPly,
    error: '',
    history: false,
  };
}

test('the live board says nothing about reviewing', () => {
  expect(recordReviewing(record(7))).toBe(false);
  renderWithI18n(() => (
    <FrameReviewingView record={record(7)} onReturnLive={() => undefined} />
  ));
  expect(screen.queryByTestId('custom-game-reviewing')).toBeNull();
  expect(screen.queryByTestId('custom-game-back-to-live')).toBeNull();
});

test('an earlier position says which move it is and steps back to live', () => {
  const onReturnLive = mock(() => undefined);
  renderWithI18n(() => (
    <FrameReviewingView record={record(3)} onReturnLive={onReturnLive} />
  ));
  expect(screen.getByTestId('custom-game-reviewing').textContent).toBe(
    'Reviewing move 3 of 7'
  );
  fireEvent.click(screen.getByTestId('custom-game-back-to-live'));
  expect(onReturnLive).toHaveBeenCalledTimes(1);
});

test('the start and an earlier game are reviewing too', () => {
  expect(recordReviewing(record(0))).toBe(true);
  expect(recordReviewing(record(7, 'earlier-1'))).toBe(true);
  renderWithI18n(() => (
    <FrameReviewingView record={record(0)} onReturnLive={() => undefined} />
  ));
  expect(screen.getByTestId('custom-game-reviewing').textContent).toBe(
    'Reviewing the starting position'
  );
});
