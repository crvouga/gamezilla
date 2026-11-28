import { expect, test } from 'bun:test';
import { renderWithI18n } from '@pkgs/bun-test-solid-client-ts/render';
import meta from '@pkgs/chess-board-root-client-ts/chess-board/chess-board.stories';
import { parameters } from '@pkgs/chess-board-root-client-ts/chess-board/space-preview.example';
import { ClockProvider } from '@pkgs/clock-client-ts/solid';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import space from '@pkgs/ui-root-client-ts/space-in-game-template/space-in-game-template.stories';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';

// regression: storybook-clock-context-child-spread
test('the initial chess story mounts once inside its real injected providers', () => {
  const { clock, timers } = createHarnessClock({ startMs: 1_700_000_000_000 });
  const view = renderWithI18n(() => (
    <ClockProvider clock={clock} timers={timers}>
      <ThemeProvider>{meta.render(meta.args)}</ThemeProvider>
    </ClockProvider>
  ));
  expect(
    view.container.querySelectorAll('[data-component="ChessBoard"]')
  ).toHaveLength(1);
  view.unmount();
});

test('the space screen renders the chess example supplied by its preview', () => {
  const { clock, timers } = createHarnessClock({ startMs: 0 });
  const view = renderWithI18n(() => (
    <ClockProvider clock={clock} timers={timers}>
      <ThemeProvider>
        {space.render(space.args, {
          globals: { spaceGame: 'chess' },
          parameters,
        })}
      </ThemeProvider>
    </ClockProvider>
  ));
  expect(
    view.container.querySelectorAll('[data-component="ChessBoard"]')
  ).toHaveLength(1);
  view.unmount();
});

test('composing the chess screen without its preview names the missing annotation', () => {
  expect(() =>
    space.render(space.args, {
      globals: { spaceGame: 'chess' },
      parameters: {},
    })
  ).toThrow('chess preview annotation');
});
