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
      title="Not found"
      notFound
      onGoToSpaces={() => went.push('spaces')}
      onGoToSearch={() => went.push('search')}
      onGoToProfile={() => went.push('profile')}
      onGoBack={back ? () => went.push('back') : undefined}
    />
  ));
}

// regression: not-found-stranded-top-left
test('not found says so once, centred, with Spaces, Search and Profile', () => {
  const went: string[] = [];
  mountNotFound(went, true);
  // One heading: the page title. No second "nothing here" heading under it.
  expect(screen.queryByText("There's nothing at this address")).toBeNull();
  const state = screen.getByTestId(Handles.routeNotFound);
  expect(state.getAttribute('data-variant')).toBe('fill');
  expect(state.getAttribute('data-align')).toBe('center');
  fireEvent.click(screen.getByTestId(Handles.routeNotFoundAction));
  fireEvent.click(screen.getByRole('button', { name: 'Search' }));
  fireEvent.click(screen.getByRole('button', { name: 'Profile' }));
  fireEvent.click(screen.getByRole('button', { name: 'Go back' }));
  expect(went).toEqual(['spaces', 'search', 'profile', 'back']);
});

test('without a screen to return to, there is no Go back', () => {
  mountNotFound([], false);
  expect(screen.queryByRole('button', { name: 'Go back' })).toBeNull();
  expect(screen.getByTestId(Handles.routeNotFoundAction)).toBeTruthy();
});
