/** @jsxImportSource solid-js */

import { expect, test } from 'bun:test';
import { AppStage } from '@pkgs/ui-devtools-client-ts/app-stage';
import { renderUi } from './render';

// regression: app-stage-hidden-view-flashes-phone-layout
test('a view that is not on show stays in the layout, out of sight and out of reach', () => {
  renderUi(() => (
    <AppStage
      aria-label="Devices"
      shown="alice"
      views={['alice', 'bob'].map((id) => ({
        id,
        title: id,
        live: true,
        content: () => <p>{`${id} app`}</p>,
      }))}
      handle={{ label: 'Next device', onTap: () => undefined }}
    />
  ));
  const view = (id: string): HTMLElement => {
    const element = document.querySelector<HTMLElement>(
      `[data-view-id="${id}"]`
    );
    if (element === null) throw new Error(`no view ${id}`);
    return element;
  };
  // `display: none` gives a view no size: an app that lays itself out by the
  // room it has would then lay out for no room, and visibly correct itself
  // when shown.
  expect(view('bob').classList.contains('hidden')).toBe(false);
  expect(view('bob').classList.contains('invisible')).toBe(true);
  expect(view('bob').hasAttribute('inert')).toBe(true);
  expect(view('bob').getAttribute('aria-hidden')).toBe('true');
  expect(view('alice').classList.contains('invisible')).toBe(false);
  expect(view('alice').hasAttribute('inert')).toBe(false);
});
