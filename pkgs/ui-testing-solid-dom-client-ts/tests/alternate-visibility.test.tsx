import { expect, test } from 'bun:test';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
import { dismissDialogOutcome } from '@pkgs/ui-testing-root-shared-ts/dismiss-dialog-outcome';
import { SolidDomDriver } from '@pkgs/ui-testing-solid-dom-client-ts/solid-dom-driver';
import { createSignal, Show } from 'solid-js';

test('an alternate visibility wait keeps its locator scope and pumps one landing screen', async () => {
  const { clock } = createHarnessClock();
  const [ready, setReady] = createSignal(false);
  let pumps = 0;
  const driver = new SolidDomDriver({
    clock,
    pump: () => {
      pumps++;
      clock.advance(1);
      setReady(true);
    },
    harness: {
      createRoot: () => () => (
        <>
          <button data-testid="library">Outside this screen</button>
          <section data-testid="panel">
            <Show when={ready()}>
              <button data-testid="library">Restored library</button>
            </Show>
          </section>
        </>
      ),
    },
  });
  await driver.launch();
  try {
    await driver
      .get('panel')
      .get('game-menu')
      .wait('visible', {
        timeoutMs: 10,
        visibleOr: ['library'],
      });
    expect(pumps).toBe(1);
    expect(await driver.get('panel').get('game-menu').isVisible()).toBe(false);
    expect(await driver.get('panel').get('library').isVisible()).toBe(true);
  } finally {
    await driver.close();
  }
});

// regression: sign-out-done-disappears-with-authenticated-screen
test.each(['closed', 'success'] as const)(
  'waits for a %s sign-out dialog before returning to the signed-out account',
  async (outcome) => {
    const { clock } = createHarnessClock();
    const [phase, setPhase] = createSignal<'pending' | 'success' | 'closed'>(
      'pending'
    );
    let dismissals = 0;
    const driver = new SolidDomDriver({
      clock,
      pump: () => {
        clock.advance(1);
        setPhase((previous) => (previous === 'pending' ? outcome : previous));
      },
      harness: {
        createRoot: () => () => (
          <>
            <button data-testid="account-sign-in">Sign in</button>
            <Show when={phase() !== 'closed'}>
              <section data-testid="auth-sign-out-modal">
                <Show when={phase() === 'success'} fallback="Signing out…">
                  <button
                    data-testid="auth-sign-out-done"
                    onClick={() => {
                      dismissals++;
                      setPhase('closed');
                    }}
                  >
                    Done
                  </button>
                </Show>
              </section>
            </Show>
          </>
        ),
      },
    });
    await driver.launch();
    try {
      await dismissDialogOutcome(
        driver,
        'auth-sign-out-modal',
        'auth-sign-out-done',
        { timeoutMs: 10 }
      );
      expect(await driver.get('account-sign-in').isVisible()).toBe(true);
      expect(await driver.get('auth-sign-out-modal').isVisible()).toBe(false);
      expect(dismissals).toBe(outcome === 'success' ? 1 : 0);
    } finally {
      await driver.close();
    }
  }
);
