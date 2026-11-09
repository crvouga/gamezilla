import { expect, test } from 'bun:test';
import { customGameCanMove } from '@libs/game-session-client-ts/custom-game-can-move';
import { useFrameStatus } from '@libs/game-session-client-ts/custom-game-status';
import {
  FrameErrorView,
  FrameStatusView,
} from '@libs/game-session-client-ts/game-frame-status-view';
import type { CustomGameReview } from '@libs/game-session-client-ts/use-custom-game-review';
import { frameSeatDeciding } from '@libs/game-session-client-ts/use-frame-seats';
import { screen } from '@solidjs/testing-library';
import {
  pendingFrameModel,
  renderPendingFrame,
} from './frame-pending-status-fixture';

const live = { live: () => true } as CustomGameReview;
function mount(fixture: ReturnType<typeof pendingFrameModel>) {
  return renderPendingFrame(() => {
    const status = useFrameStatus(fixture.model);
    return (
      <>
        <FrameStatusView status={status()} spokenOnly />
        <FrameErrorView text={fixture.model.error()} />
      </>
    );
  });
}

// regression: game-frame-pending-turn-contradiction
test('a deferred choice replaces the own-turn prompt until success without editing the position', async () => {
  const fixture = pendingFrameModel();
  mount(fixture);
  const status = () => screen.getByTestId('custom-game-status');
  expect(status()).toHaveTextContent('Your turn.');
  const completion = Promise.withResolvers<void>();
  const request = fixture.submit(completion.promise);
  expect(customGameCanMove(fixture.model, live)).toBe(false);
  expect(status()).toHaveTextContent('Sending choice…');
  expect(status()).not.toHaveTextContent('Your turn.');
  expect(status().closest('[data-emphasis="yours"]')).toBeNull();
  expect(status().closest('[data-spoken-only="true"]')).toBeNull();
  expect(frameSeatDeciding(fixture.initial, 'white', fixture.model)).toBe(
    false
  );
  expect(fixture.model.current()).toBe(fixture.initial);
  completion.resolve();
  await request;
  expect(status()).toHaveTextContent('Your turn.');
  expect(status()).not.toHaveTextContent('Sending choice…');
  expect(customGameCanMove(fixture.model, live)).toBe(true);
  expect(frameSeatDeciding(fixture.initial, 'white', fixture.model)).toBe(true);
  expect(fixture.model.current()).toBe(fixture.initial);
});

test('a refused choice restores the own-turn cue and retry eligibility with the same position', async () => {
  const fixture = pendingFrameModel();
  mount(fixture);
  const completion = Promise.withResolvers<void>();
  const request = fixture.submit(completion.promise);
  expect(screen.getByTestId('custom-game-status')).not.toHaveTextContent(
    'Your turn.'
  );
  completion.reject(new Error('The host refused this choice. Try again.'));
  await request;
  expect(screen.getByTestId('custom-game-error')).toHaveTextContent(
    'Try again.'
  );
  expect(screen.getByTestId('custom-game-status')).toHaveTextContent(
    'Your turn.'
  );
  expect(customGameCanMove(fixture.model, live)).toBe(true);
  expect(frameSeatDeciding(fixture.initial, 'white', fixture.model)).toBe(true);
  expect(fixture.model.current()).toBe(fixture.initial);
});

test('pending suppresses only the submitting viewer seat, including simultaneous choices', async () => {
  const fixture = pendingFrameModel();
  const game = { ...fixture.initial, awaiting: ['white', 'black'] as const };
  // The model stores a mutable array, as the room snapshot does.
  const simultaneous = { ...game, awaiting: [...game.awaiting] };
  const completion = Promise.withResolvers<void>();
  const request = fixture.submit(completion.promise);
  expect(frameSeatDeciding(simultaneous, 'white', fixture.model)).toBe(false);
  expect(frameSeatDeciding(simultaneous, 'black', fixture.model)).toBe(true);
  fixture.setMySide(null);
  expect(frameSeatDeciding(simultaneous, 'white', fixture.model)).toBe(true);
  expect(frameSeatDeciding(simultaneous, 'black', fixture.model)).toBe(true);
  expect(
    frameSeatDeciding(
      { ...simultaneous, status: 'completed' },
      'white',
      fixture.model
    )
  ).toBe(false);
  completion.resolve();
  await request;
});
