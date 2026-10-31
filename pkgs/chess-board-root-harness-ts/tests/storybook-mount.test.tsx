import { expect, test } from 'bun:test';
import { renderWithI18n } from '@pkgs/bun-test-solid-client-ts/render';
import { ClockProvider } from '@pkgs/clock-client-ts/solid';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';
import meta from '../../chess-board-root-client-ts/src/chess-board/chess-board.stories';

// regression: storybook-clock-context-child-spread
test('the initial chess story mounts once inside its real injected providers', () => {
  const { clock, timers } = createHarnessClock({ startMs: 1_700_000_000_000 });
  const view = renderWithI18n(() => (
    <ClockProvider clock={clock} timers={timers}>
      <ThemeProvider colorScheme="light">
        {meta.render(meta.args)}
      </ThemeProvider>
    </ClockProvider>
  ));
  expect(
    view.container.querySelectorAll('[data-component="ChessBoard"]')
  ).toHaveLength(1);
  view.unmount();
});
