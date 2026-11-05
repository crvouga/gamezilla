/** @jsxImportSource solid-js */
/** What the not-found screen says, once, and where it offers to go. */

import { afterEach, expect, test } from 'bun:test';
import { RouteStubScreenView } from '@libs/app-root-client-ts/route-stub-screen-view';
import { Handles } from '@libs/test-ids-shared-ts/handles';
import { cleanup, fireEvent, screen } from '@solidjs/testing-library';
import { renderChrome } from './render-chrome';

afterEach(cleanup);

const WIDE = { width: 1200, height: 884 };

function mountNotFound(
  went: string[],
  back: boolean,
  layout?: typeof WIDE
): void {
  renderChrome(() => (
    <RouteStubScreenView
      screenId="not-found"
      title="Page not found"
      notFound
      onGoToSpaces={() => went.push('spaces')}
      onGoBack={back ? () => went.push('back') : undefined}
    />
  ), layout);
}

// regression: not-found-stranded-top-left
test('not found says so once, as the head of its message, with a way to Spaces', () => {
  const went: string[] = [];
  mountNotFound(went, true);
  // One heading: the page title. No second "nothing here" heading under it.
  expect(screen.queryByText("There's nothing at this address")).toBeNull();
  const headings = screen.getAllByRole('heading');
  expect(headings.map((h) => h.textContent)).toEqual(['Page not found']);
  expect(headings[0]?.tagName).toBe('H1');
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
// regression: not-found-unit-not-centred — beside the sidebar the compass
// and one sentence sat in the content's top-left corner under a title at
// the top, the rest of the screen empty. The title, compass, sentence and
// ways out are now one unit centred in the content area, so the message
// can never drift away from the title it explains, on a phone or wide.
test.each([
  ['phone', undefined],
  ['wide', WIDE],
] as const)('%s: title, message and ways out are one centred unit', (_, layout) => {
  mountNotFound([], true, layout);
  const unit = screen.getByTestId(Handles.routeNotFound);
  expect(unit.getAttribute('data-align')).toBe('center');
  expect(unit.getAttribute('data-variant')).toBe('fill');
  const title = screen.getByRole('heading', { name: 'Page not found' });
  expect(unit.contains(title)).toBe(true);
  expect(unit.contains(screen.getByRole('button', { name: 'Go back' }))).toBe(
    true
  );
  expect(
    unit.contains(
      screen.getByText(
        'The link may be old or mistyped. Your spaces are still here.'
      )
    )
  ).toBe(true);
  // The header draws no second copy of the title.
  expect(screen.getAllByText('Page not found')).toHaveLength(1);
});
