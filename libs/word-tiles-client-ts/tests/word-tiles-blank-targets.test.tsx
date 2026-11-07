import { expect, test } from 'bun:test';
import { WordTilesBlankChooser } from '@libs/word-tiles-client-ts/word-tiles-panels';
import { renderWithI18n as render } from '@pkgs/bun-test-solid-client-ts/render';
import { ClockProvider } from '@pkgs/clock-client-ts/solid';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import { SurfaceStackProvider } from '@pkgs/ui-root-client-ts/surface-stack';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';
import { fireEvent } from '@solidjs/testing-library';

// regression: word-tiles-blank-small-targets
test('all 26 blank letters use full medium controls and native keyboard-focusable buttons', () => {
  const chosen: string[] = [];
  const { clock, timers } = createHarnessClock();
  const view = render(() => (
    <ClockProvider clock={clock} timers={timers}>
      <ThemeProvider colorScheme="light">
        <SurfaceStackProvider>
          <WordTilesBlankChooser
            testId="blank"
            cells={[]}
            index={112}
            summary="Score: 0"
            onCancel={() => undefined}
            onChoose={(letter) => chosen.push(letter)}
          />
        </SurfaceStackProvider>
      </ThemeProvider>
    </ClockProvider>
  ));
  const buttons = view
    .getAllByRole('button')
    .filter((button) => /^[A-Z]$/.test(button.textContent ?? ''));
  expect(buttons).toHaveLength(26);
  expect(
    view
      .getByRole('group', { name: 'Choose the letter your blank plays' })
      .getAttribute('data-component')
  ).toBe('WordTileLetterChoices');
  expect(document.activeElement).toBe(view.getByRole('button', { name: 'A' }));
  for (const [index, button] of buttons.entries()) {
    expect(button.getAttribute('data-size')).toBe('md');
    expect(button.textContent).toBe(String.fromCharCode(65 + index));
    button.focus();
    expect(document.activeElement).toBe(button);
  }
  fireEvent.click(view.getByRole('button', { name: 'S' }));
  expect(chosen).toEqual(['S']);
});

// regression: word-tiles-blank-direct-letter-entry
test('typing lowercase s at the first blank choice immediately assigns S', () => {
  const chosen: string[] = [];
  const { clock, timers } = createHarnessClock();
  const view = render(() => (
    <ClockProvider clock={clock} timers={timers}>
      <ThemeProvider colorScheme="light">
        <SurfaceStackProvider>
          <WordTilesBlankChooser
            testId="direct"
            cells={[]}
            index={112}
            summary="Score: 0"
            onCancel={() => undefined}
            onChoose={(letter) => chosen.push(letter)}
          />
        </SurfaceStackProvider>
      </ThemeProvider>
    </ClockProvider>
  ));
  fireEvent.keyDown(view.getByRole('button', { name: 'A' }), { key: 's' });
  expect(chosen).toEqual(['S']);
});
