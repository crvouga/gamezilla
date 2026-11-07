import { expect, test } from 'bun:test';
import { FrameStatusView } from '@libs/game-session-client-ts/game-frame-status-view';
import type { FrameStatus } from '@libs/game-session-client-ts/game-frame-view-types';
import { renderWithI18n } from '@pkgs/bun-test-solid-client-ts/render';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';
import { screen } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';

test('an empty arena status preserves its announcement without painting a pill', () => {
  // regression: arena-empty-status-pill
  const [sending, setSending] = createSignal(false);
  const status = (): FrameStatus => ({
    lineup: 'Left: Avery. Right: Jordan.',
    description: '',
    plainTurn: false,
    emphasis: 'yours',
    tone: 'neutral',
    sending: sending(),
    minutes: 0,
    increment: 0,
  });
  renderWithI18n(() => (
    <ThemeProvider colorScheme="light">
      <FrameStatusView status={status()} arena />
    </ThemeProvider>
  ));
  const words = () => screen.getByTestId('custom-game-status');
  expect(words()).toHaveTextContent('Left: Avery. Right: Jordan.');
  expect(words().closest('[data-spoken-only="true"]')).not.toBeNull();
  setSending(true);
  expect(words()).toHaveTextContent('Sending choice…');
  expect(words().closest('[data-spoken-only="true"]')).toBeNull();
});
