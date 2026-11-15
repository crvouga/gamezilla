/** @jsxImportSource solid-js */
/** The builder's draft copies tell each copy apart before one is chosen. */

import { afterEach, expect, test } from 'bun:test';
import { ContentAuthorCopiesListView } from '@libs/game-puzzle-client-ts/content-author-copies-list';
import { renderWithI18n } from '@pkgs/bun-test-solid-client-ts/render';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';
import { cleanup, fireEvent, screen } from '@solidjs/testing-library';

afterEach(cleanup);

// regression: builder-copies-indistinguishable — every copy read "Saved
// draft copy" under its title, so two copies could not be told apart.
test('each copy says where it was kept, its check and its details', () => {
  const chosen: string[] = [];
  renderWithI18n(() => (
    <ThemeProvider
      colorScheme="light"
      fixedLayout={{ width: 390, height: 844 }}
    >
      <ContentAuthorCopiesListView
        copies={[
          {
            id: 'a',
            title: 'Count to seven',
            difficulty: 'Easy',
            description: 'Reach seven.',
            conflicted: false,
            validation: 'unchecked',
          },
          {
            id: 'b',
            title: '',
            difficulty: '',
            description: '',
            conflicted: true,
            validation: 'valid',
          },
        ]}
        currentId="a"
        disabled={false}
        onSelect={(id) => chosen.push(id)}
      />
    </ThemeProvider>
  ));
  expect(screen.getByTestId('content-use-copy-a').textContent).toBe(
    'Count to sevenKept on this device · not checked yetEasy · Reach seven.Editing now'
  );
  expect(screen.getByTestId('content-use-copy-b').textContent).toBe(
    'Untitled draftKept from another device · passed its check'
  );
  fireEvent.click(screen.getByTestId('content-use-copy-b'));
  expect(chosen).toEqual(['b']);
});
