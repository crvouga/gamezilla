import { describe, expect, test } from 'bun:test';
import { renderWithI18n as render } from '@pkgs/bun-test-solid-client-ts/render';
import { ClockProvider } from '@pkgs/clock-client-ts/solid';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import { GameActionButton } from '@pkgs/ui-root-client-ts/game-action-button';
import { GameCountdown } from '@pkgs/ui-root-client-ts/game-countdown';
import { ThemeProvider } from '@pkgs/ui-root-client-ts/theme-context';
import { fireEvent } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';
import GameArenaExample from '../../ui-root-client-ts/src/game-board-stage/game-arena.example';

describe('game presentation contracts', () => {
  test('countdown follows the deadline, freezes, resumes and releases its timer', () => {
    const { clock, timers } = createHarnessClock({ startMs: 100 });
    const [paused, setPaused] = createSignal<number | null>(null);
    const [deadline, setDeadline] = createSignal<number | null>(2600);
    const view = render(() => (
      <ClockProvider clock={clock} timers={timers}>
        <GameCountdown
          label="First move"
          deadline={deadline()}
          pausedAt={paused()}
        />
      </ClockProvider>
    ));
    expect(view.getByRole('timer').textContent).toBe('3');
    clock.advance(499);
    expect(view.getByRole('timer').textContent).toBe('3');
    clock.advance(1);
    expect(view.getByRole('timer').textContent).toBe('2');
    setPaused(clock.now());
    expect(clock.pendingOneShotCount()).toBe(0);
    clock.advance(4000);
    expect(view.getByRole('timer').textContent).toBe('2');
    setPaused(null);
    expect(view.getByRole('timer').textContent).toBe('0');
    expect(clock.pendingOneShotCount()).toBe(0);
    setDeadline(clock.now() + 3000);
    expect(clock.pendingOneShotCount()).toBe(1);
    setDeadline(null);
    expect(view.queryByRole('timer')).toBeNull();
    expect(clock.pendingOneShotCount()).toBe(0);
    setDeadline(clock.now() + 1000);
    view.unmount();
    expect(clock.pendingOneShotCount()).toBe(0);
  });

  test('the example composes native radio choices and a labelled inline disclosure', () => {
    const { clock, timers } = createHarnessClock({ startMs: 0 });
    const view = render(() => (
      <ClockProvider clock={clock} timers={timers}>
        <ThemeProvider
          colorScheme="light"
          fixedLayout={{ width: 390, height: 844 }}
        >
          <GameArenaExample />
        </ThemeProvider>
      </ClockProvider>
    ));
    const options = view.getAllByRole('radio') as HTMLInputElement[];
    expect(options.filter((input) => input.checked)).toHaveLength(1);
    fireEvent.click(view.getByRole('radio', { name: '2 min Quick round' }));
    expect(options[0]?.checked).toBe(true);
    expect(options[1]?.checked).toBe(false);
    const disclosure = view.getByRole('button', { name: 'Round options' });
    expect(disclosure.getAttribute('aria-expanded')).toBe('false');
    fireEvent.click(disclosure);
    expect(disclosure.getAttribute('aria-expanded')).toBe('true');
    expect(
      document.getElementById(disclosure.getAttribute('aria-controls') ?? '')
    ).not.toBeNull();
    expect(view.queryByRole('dialog')).toBeNull();
    fireEvent.click(disclosure);
    expect(disclosure.getAttribute('aria-expanded')).toBe('false');
    view.unmount();
  });

  test('inline commands prevent double submission and retain errors for retry', async () => {
    const { clock, timers } = createHarnessClock({ startMs: 0 });
    let submissions = 0;
    let reject: (reason: Error) => void = () => {};
    const view = render(() => (
      <ClockProvider clock={clock} timers={timers}>
        <ThemeProvider
          colorScheme="dark"
          fixedLayout={{ width: 390, height: 844 }}
        >
          <GameActionButton
            title="Join round"
            operation={() => {
              submissions += 1;
              return new Promise<void>((_resolve, refuse) => {
                reject = refuse;
              });
            }}
          />
        </ThemeProvider>
      </ClockProvider>
    ));
    const button = view.getByRole('button') as HTMLButtonElement;
    fireEvent.click(button);
    fireEvent.click(button);
    expect(submissions).toBe(1);
    expect(button.disabled).toBe(true);
    reject(new Error('Round is full'));
    await Promise.resolve();
    await Promise.resolve();
    expect(button.disabled).toBe(false);
    expect(button.getAttribute('data-phase')).toBe('error');
    clock.advance(5000);
    expect(button.getAttribute('data-phase')).toBe('error');
    fireEvent.click(button);
    expect(submissions).toBe(2);
    view.unmount();
  });
});
