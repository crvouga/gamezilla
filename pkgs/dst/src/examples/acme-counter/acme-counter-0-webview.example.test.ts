import { describe, expect, test } from 'bun:test';
import { ActionNotEnabled, start, walk } from '../../index';
import { replay } from '../../pbt';
import {
  COUNTER_ACTIONS,
  COUNTER_PROPERTIES,
  count,
  counter,
  decrement,
  increment,
  leaveSettings,
  openSettings,
  reset,
  route,
  setStep,
  webViewHost,
} from './scenario';
import { webViewAvailable } from './webview-page';

/**
 * Runs before happy-dom tests (filename `0-` < `1-`). Loading happy-dom in the
 * same process breaks `Bun.WebView` spawn, so keep this file free of happy-dom.
 */
describe('acme-counter Bun.WebView', () => {
  const available = webViewAvailable();

  test.skipIf(!available)(
    'scripted settings → step → increment → reset',
    async () => {
      await using run = await start(counter, {
        host: webViewHost(),
        seed: 1,
        properties: COUNTER_PROPERTIES,
      });

      await run.apply(openSettings);
      await run.apply(setStep, 5);
      await run.apply(leaveSettings);
      await run.apply(increment);
      await run.apply(increment);
      expect(await run.observe(count)).toBe(10);
      expect(await run.observe(route)).toBe('home');

      await run.apply(reset);
      expect(await run.observe(count)).toBe(0);
      await expect(run.apply(decrement)).rejects.toBeInstanceOf(
        ActionNotEnabled
      );
      await expect(run.apply(reset)).rejects.toBeInstanceOf(ActionNotEnabled);
    }
  );

  test.skipIf(!available)('walk + replay', async () => {
    await using run = await start(counter, {
      host: webViewHost(),
      seed: 42,
      properties: COUNTER_PROPERTIES,
    });
    const w = await walk(run, { actions: COUNTER_ACTIONS, steps: 12 });
    expect(w.violations).toEqual([]);
    expect(w.choices.length).toBeGreaterThan(0);
    await replay(counter, w, {
      host: webViewHost(),
      properties: COUNTER_PROPERTIES,
      actions: COUNTER_ACTIONS,
    });
  });
});
