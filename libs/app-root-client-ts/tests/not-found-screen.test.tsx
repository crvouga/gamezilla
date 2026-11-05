/** @jsxImportSource solid-js */
/** What the not-found screen says, once, and where it offers to go. */

import { afterEach, expect, test } from 'bun:test';
import { RouteStubScreenView } from '@libs/app-root-client-ts/route-stub-screen-view';
import { Handles } from '@libs/test-ids-shared-ts/handles';
import { cleanup, fireEvent, screen } from '@solidjs/testing-library';
import { renderChrome } from './render-chrome';

afterEach(cleanup);

function mountNotFound(went: string[], back: boolean): void {
  renderChrome(() => (
    <RouteStubScreenView
      screenId="not-found"
      title="Page not found"
      notFound
      onGoToSpaces={() => went.push('spaces')}
      onGoBack={back ? () => went.push('back') : undefined}
    />
  ));
}

// regression: not-found-stranded-top-left
test('not found says so once, centred, with a way to Spaces', () => {
  const went: string[] = [];
  mountNotFound(went, true);
  // One heading: the page title. No second "nothing here" heading under it.
  expect(screen.queryByText("There's nothing at this address")).toBeNull();
  const state = screen.getByTestId(Handles.routeNotFound);
  expect(state.getAttribute('data-variant')).toBe('fill');
  expect(state.getAttribute('data-align')).toBe('center');
  fireEvent.click(screen.getByTestId(Handles.routeNotFoundAction));
  fireEvent.click(screen.getByRole('button', { name: 'Go back' }));
  expect(went).toEqual(['spaces', 'back']);
});

// regression: not-found-too-many-ways-out
test('two ways out on one line, and a message that does not echo the title', () => {
  mountNotFound([], true);
  expect(screen.queryByRole('button', { name: 'Search' })).toBeNull();
  expect(screen.queryByRole('button', { name: 'Profile' })).toBeNull();
  const spaces = screen.getByTestId(Handles.routeNotFoundAction);
  const back = screen.getByRole('button', { name: 'Go back' });
  // Both in the one actions row, so neither is stranded on a line alone.
  const row = spaces.parentElement;
  expect(row?.contains(back)).toBe(true);
  expect(row?.getAttribute('data-testid')).not.toBe(Handles.routeNotFound);
  expect(
    screen.getByText(
      'The link may be old or mistyped. Your spaces are still here.'
    )
  ).toBeTruthy();
  expect(screen.queryByText(/nothing at this address/)).toBeNull();
});

test('without a screen to return to, there is no Go back', () => {
  mountNotFound([], false);
  expect(screen.queryByRole('button', { name: 'Go back' })).toBeNull();
  expect(screen.getByTestId(Handles.routeNotFoundAction)).toBeTruthy();
});

// regression: not-found-message-floats-from-title
test('the message sits under the title instead of floating mid-page', () => {
  mountNotFound([], false);
  const holder = screen.getByTestId(Handles.routeNotFound).parentElement;
  expect(holder?.className ?? '').not.toMatch(/\b(grow|flex-1)\b/);
});
