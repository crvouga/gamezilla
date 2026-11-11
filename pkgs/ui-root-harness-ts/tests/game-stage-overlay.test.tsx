/** @jsxImportSource solid-js */

import { describe, expect, mock, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { renderWithI18n as render } from '@pkgs/bun-test-solid-client-ts/render';
import { ClockProvider } from '@pkgs/clock-client-ts/solid';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import {
  GameResultOverlay,
  GameVersusOverlay,
} from '@pkgs/ui-root-client-ts/game-stage-overlay';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';

const CSS = readFileSync(
  join(
    import.meta.dir,
    '../../ui-root-client-ts/src/game-stage-overlay/game-stage-overlay.module.css'
  ),
  'utf8'
);

function resultCard(onDismiss: () => void, onRematch: () => void) {
  const { clock, timers } = createHarnessClock();
  return render(() => (
    <ClockProvider clock={clock} timers={timers}>
      <ThemeProvider
        colorScheme="dark"
        fixedLayout={{ width: 390, height: 844 }}
      >
        <GameResultOverlay
          live
          tone="won"
          eyebrow="Victory"
          title="You win"
          caption="Four in a row."
          dismissLabel="Show the board"
          onDismiss={onDismiss}
          actions={
            <button type="button" onClick={onRematch}>
              Rematch
            </button>
          }
          dataSet={{ testid: 'result' }}
        />
      </ThemeProvider>
    </ClockProvider>
  ));
}

function tabStops(root: HTMLElement): string[] {
  return [...root.querySelectorAll<HTMLElement>('button, a[href]')]
    .filter((node) => node.tabIndex >= 0)
    .map((node) => node.getAttribute('aria-label') ?? node.textContent ?? '');
}

describe('GameResultOverlay', () => {
  test('the result is one live announcement under a real heading', () => {
    const view = resultCard(
      () => undefined,
      () => undefined
    );
    const card = view.getByTestId('result');
    const status = card.querySelector('[role="status"]');
    expect(status?.getAttribute('aria-live')).toBe('polite');
    expect(status?.getAttribute('aria-atomic')).toBe('true');
    expect(status?.textContent).toBe('VictoryYou winFour in a row.');
    expect(view.getByRole('heading', { level: 2 }).textContent).toBe('You win');
  });

  test('the keyboard reaches the named close control, then the commands; never the dimmed board', () => {
    const view = resultCard(
      () => undefined,
      () => undefined
    );
    expect(tabStops(view.getByTestId('result'))).toEqual([
      'Show the board',
      'Rematch',
    ]);
    const scrim = view.getByTestId('result').querySelector('button');
    expect(scrim?.getAttribute('aria-hidden')).toBe('true');
    expect(scrim?.tabIndex).toBe(-1);
  });

  test('the close control and a press on the dimmed board both dismiss; a command does not', () => {
    const onDismiss = mock(() => undefined);
    const onRematch = mock(() => undefined);
    const view = resultCard(onDismiss, onRematch);
    view.getByRole('button', { name: 'Show the board' }).click();
    expect(onDismiss).toHaveBeenCalledTimes(1);
    view.getByTestId('result').querySelector('button')?.click();
    expect(onDismiss).toHaveBeenCalledTimes(2);
    view.getByRole('button', { name: 'Rematch' }).click();
    expect(onRematch).toHaveBeenCalledTimes(1);
    expect(onDismiss).toHaveBeenCalledTimes(2);
  });
});

describe('GameVersusOverlay', () => {
  function versus(onSkip: () => void, count = 3) {
    return render(() => (
      <ThemeProvider
        colorScheme="dark"
        fixedLayout={{ width: 390, height: 844 }}
      >
        <GameVersusOverlay
          others={[{ id: 'yellow', name: 'jordan', avatar: <span /> }]}
          own={[{ id: 'red', name: 'avery', avatar: <span /> }]}
          mark="VS"
          count={count}
          countLabel="Starts in"
          skipLabel="Skip"
          aria-label="avery versus jordan"
          onSkip={onSkip}
          dataSet={{ testid: 'versus' }}
        />
      </ThemeProvider>
    ));
  }

  test('the card is a named group whose one control is a real button', () => {
    const onSkip = mock(() => undefined);
    const view = versus(onSkip);
    const card = view.getByRole('group', { name: 'avery versus jordan' });
    expect(tabStops(card)).toEqual(['Skip']);
    view.getByRole('button', { name: 'Skip' }).click();
    expect(onSkip).toHaveBeenCalledTimes(1);
  });

  test('the count is shown as given and is not read out every second', () => {
    const view = versus(() => undefined, 2);
    const count = view
      .getByTestId('versus')
      .querySelector('[data-versus-count]');
    expect(count?.textContent).toBe('2');
    expect(count?.closest('[aria-live]')?.getAttribute('aria-live')).toBe(
      'off'
    );
  });
});

describe('stage overlay motion', () => {
  test('motion is entrance only, and only for people who have not asked for less', () => {
    const outside = CSS.split(
      '@media (prefers-reduced-motion: no-preference)'
    )[0];
    expect(outside).not.toContain('animation:');
    expect(CSS).not.toContain('infinite');
  });
});
