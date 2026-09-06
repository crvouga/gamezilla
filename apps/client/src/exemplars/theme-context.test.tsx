/** @jsxImportSource solid-js */

import { renderWithI18n } from '@pkgs/vitest-solid/render';
import { fireEvent, screen, waitFor } from '@solidjs/testing-library';
import { ErrorBoundary, lazy, Suspense } from 'solid-js';
import { describe, expect, test } from 'vitest';
import { ThemeSchemeProvider, ThemeToggle } from './theme-context';

const ThemedBadge = lazy(() => import('./themed-badge'));

describe('ThemeSchemeProvider', () => {
  test('toggle flips the scheme for every consumer, including lazy ones', async () => {
    renderWithI18n(() => (
      <ThemeSchemeProvider initial="dark">
        <ThemeToggle />
        <Suspense fallback={<span data-testid="loading" />}>
          <ThemedBadge />
        </Suspense>
      </ThemeSchemeProvider>
    ));

    const toggle = screen.getByRole('button', { name: 'Toggle theme' });
    expect(toggle).toHaveAttribute('data-scheme', 'dark');

    const badge = await screen.findByText('Current scheme: dark');
    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute('data-scheme', 'light');
    await waitFor(() => {
      expect(badge).toHaveTextContent('Current scheme: light');
    });
  });

  test('consumers outside the provider fail loudly', () => {
    renderWithI18n(() => (
      <ErrorBoundary
        fallback={(error: unknown) => (
          <p role="alert">{error instanceof Error ? error.message : 'x'}</p>
        )}
      >
        <ThemeToggle />
      </ErrorBoundary>
    ));
    expect(screen.getByRole('alert')).toHaveTextContent(
      'useThemeScheme must be used within ThemeSchemeProvider'
    );
  });
});
