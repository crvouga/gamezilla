import { expect, test } from 'bun:test';
import { useFrameStatus } from '@libs/game-session-client-ts/custom-game-status';
import type { FrameBoard } from '@libs/game-session-client-ts/game-frame-play';
import type {
  FramePlay,
  FrameStatus,
} from '@libs/game-session-client-ts/game-frame-view-types';
import { useFramePlay } from '@libs/game-session-client-ts/use-frame-play';
import { frameSeatDeciding } from '@libs/game-session-client-ts/use-frame-seats';
import type { Accessor } from 'solid-js';
import {
  pendingFrameModel,
  renderPendingFrame,
} from './frame-pending-status-fixture';

const board: FrameBoard = {
  session: () => null,
  position: () => 'fixture:4',
  interactive: () => true,
  orientation: () => 'white',
};

function mount(fixture: ReturnType<typeof pendingFrameModel>) {
  let play: Accessor<FramePlay> = () => {
    throw new Error('not mounted');
  };
  let status: Accessor<FrameStatus | null> = () => null;
  renderPendingFrame(() => {
    play = useFramePlay(fixture.model, board);
    status = useFrameStatus(fixture.model);
    return null;
  });
  return { play: () => play(), status: () => status() };
}

// regression: frame-offline-claims-your-move — with the connection needed
// or the viewer's move waiting for it, the frame still said "Your move" (a
// deciding seat, own-turn emphasis) and offered Resign and Offer draw,
// which cannot reach the other player.
test('while the connection is needed or a move waits, nothing claims the move or offers resign or draw', () => {
  const fixture = pendingFrameModel();
  const frame = mount(fixture);
  const deciding = () =>
    frameSeatDeciding(fixture.initial, 'white', fixture.model);
  expect(deciding()).toBe(true);
  expect(frame.status()?.emphasis).toBe('yours');
  expect(frame.play().canResign).toBe(true);
  for (const held of ['needed', 'waiting'] as const) {
    fixture.setConnection(held);
    expect(deciding()).toBe(false);
    expect(frame.status()?.emphasis).toBe('neutral');
    expect(frame.play().canResign).toBe(false);
    expect(frame.play().canOfferDraw).toBe(false);
    // The other seat's turn is unaffected.
    expect(frameSeatDeciding(fixture.initial, 'black', fixture.model)).toBe(
      false
    );
  }
  // A local game that can go on offline is not held; online restores all.
  for (const free of ['offline-local', 'online'] as const) {
    fixture.setConnection(free);
    expect(deciding()).toBe(true);
    expect(frame.status()?.emphasis).toBe('yours');
    expect(frame.play().canResign).toBe(true);
  }
});

test('a watcher is never held by the connection', () => {
  const fixture = pendingFrameModel();
  fixture.setMySide(null);
  fixture.setConnection('needed');
  expect(frameSeatDeciding(fixture.initial, 'white', fixture.model)).toBe(true);
});
