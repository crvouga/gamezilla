import { expect, test } from 'bun:test';
import { createHarnessClock } from '@pkgs/clock-shared-ts/harness-clock';
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
