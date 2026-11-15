/** @jsxImportSource solid-js */
/** A restart that was refused says why, with a retry; the earlier attempt stays. */

import { afterEach, expect, test } from 'bun:test';
import {
  ContentAttemptRestart,
  ContentAttemptRestartFailure,
  type ContentAttemptRestartTools,
} from '@libs/game-puzzle-client-ts/content-attempt-restart';
import { renderWithI18n } from '@pkgs/bun-test-solid-client-ts/render';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';
import { cleanup, fireEvent, screen } from '@solidjs/testing-library';

afterEach(cleanup);

function tools(failure: string | null, pending = false) {
  let restarts = 0;
  const value = {
    restart: () => {
      restarts += 1;
    },
    pending: () => pending,
    failure: () => failure,
  } as ContentAttemptRestartTools;
  return { value, restarts: () => restarts };
}

test('Restart is one press: it asks for the new attempt straight away', () => {
  const restart = tools(null);
  renderWithI18n(() => (
    <ThemeProvider
      colorScheme="light"
      fixedLayout={{ width: 390, height: 844 }}
    >
      <ContentAttemptRestart tools={restart.value} disabled={false} />
      <ContentAttemptRestartFailure tools={restart.value} />
    </ThemeProvider>
  ));
  fireEvent.click(screen.getByTestId('content-restart'));
  expect(restart.restarts()).toBe(1);
  expect(screen.queryByTestId('content-restart-failed')).toBeNull();
});

test('a refused restart keeps its reason beside a retry', () => {
  const restart = tools('A new attempt could not be saved.');
  renderWithI18n(() => (
    <ThemeProvider
      colorScheme="light"
      fixedLayout={{ width: 390, height: 844 }}
    >
      <ContentAttemptRestartFailure tools={restart.value} />
    </ThemeProvider>
  ));
  const failed = screen.getByTestId('content-restart-failed');
  expect(failed.textContent).toContain('A new attempt could not be saved.');
  fireEvent.click(screen.getByRole('button', { name: /try again|retry/i }));
  expect(restart.restarts()).toBe(1);
});
