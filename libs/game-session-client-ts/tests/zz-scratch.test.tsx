import { expect, test } from 'bun:test';
import { createSignal } from 'solid-js';
import { fireEvent, screen } from '@solidjs/testing-library';
import type { CustomGamePlace } from '@libs/game-session-client-ts/custom-game-places';
import { frameProps, mountFrame, record } from './frame-fixture';

test('scratch', () => {
  const [place, setPlace] = createSignal<CustomGamePlace>({ screen: 'play' });
  mountFrame(() => frameProps({ place: place(), record: record(['1','2','3']), onOpen: setPlace }));
  fireEvent.click(screen.getByTestId('custom-game-commands'));
  fireEvent.click(screen.getByTestId('custom-game-review-move-2'));
  console.log('place', place().screen, 'dialogs', document.querySelectorAll('[role="dialog"]').length, 'inert', document.querySelectorAll('[inert]').length, 'aria-hidden', document.querySelectorAll('[aria-hidden="true"]').length);
  const rec = screen.queryAllByTestId('custom-game-record');
  console.log('records', rec.length, rec.map(r => r.closest('[inert]') !== null));
});
