import { expect, test } from 'bun:test';
import { PuzzleActionButton } from '@libs/game-puzzle-client-ts/puzzle-action-bar-items';
import { renderWithI18n } from '@pkgs/bun-test-solid-client-ts/render';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';
import { screen } from '@solidjs/testing-library';

const noop = (): void => undefined;

// regression: puzzle-solution-label-hides-consequence
test('the move hint and the attempt-ending solution have distinct labels', () => {
  const model = {
    status: 'solving' as const,
    hintStage: 'highlight' as const,
    canGoForward: false,
    onHint: noop,
    onSolution: noop,
    onRetry: noop,
    onSkip: noop,
    onNext: noop,
  };
  const hint = renderWithI18n(() => (
    <ThemeProvider colorScheme="light">
      <PuzzleActionButton
        slot={{
          id: 'hint',
          type: 'action',
          hintLabel: 'solution',
          disabled: false,
        }}
        model={model}
      />
    </ThemeProvider>
  ));
  expect(screen.getByRole('button', { name: 'Reveal move' })).toBeTruthy();
  hint.unmount();
  renderWithI18n(() => (
    <ThemeProvider colorScheme="light">
      <PuzzleActionButton
        slot={{ id: 'solution', type: 'action', disabled: false }}
        model={model}
      />
    </ThemeProvider>
  ));
  expect(
    screen.getByRole('button', { name: 'Reveal and end attempt' })
  ).toBeTruthy();
});
