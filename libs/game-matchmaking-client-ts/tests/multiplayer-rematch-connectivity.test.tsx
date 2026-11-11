/** @jsxImportSource solid-js */

import { afterEach, expect, test } from 'bun:test';
import { cleanup, screen } from '@solidjs/testing-library';
import { FINISHED, mountPlaces } from './multiplayer-places-fixture';

afterEach(cleanup);

// regression: rematch-command-during-disconnection
test('rematch commands follow connectivity without losing the offered game', () => {
  const view = mountPlaces({
    stage: 'finished',
    props: { game: { ...FINISHED, rematch: 'answer' } },
  });
  const accept = screen.getByTestId('multiplayer-accept-rematch');
  const decline = screen.getByTestId('multiplayer-decline-rematch');
  expect(accept).not.toHaveAttribute('disabled');
  view.set({ online: false });
  expect(accept.hasAttribute('disabled')).toBe(true);
  expect(decline.hasAttribute('disabled')).toBe(true);
  view.set({ online: true });
  expect(screen.getByTestId('multiplayer-accept-rematch')).toBe(accept);
  expect(accept).not.toHaveAttribute('disabled');
  expect(decline).not.toHaveAttribute('disabled');
  view.set({ game: FINISHED });
  const offer = screen.getByTestId('multiplayer-offer-rematch');
  expect(offer).not.toHaveAttribute('disabled');
  view.set({ online: false });
  expect(offer.hasAttribute('disabled')).toBe(true);
  // The result and its other command stay through the disconnection.
  expect(screen.getByTestId('multiplayer-announcement')).toBeTruthy();
  expect(
    screen.getByTestId('multiplayer-new-opponent').hasAttribute('disabled')
  ).toBe(false);
  view.set({ online: true });
  expect(offer).not.toHaveAttribute('disabled');
});
