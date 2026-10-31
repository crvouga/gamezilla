import { afterAll, beforeAll, expect, test } from 'bun:test';
import { runInThisContext } from 'node:vm';
import { GlobalRegistrator } from '@happy-dom/global-registrator';
import { assertProperty } from '@pkgs/property-shared-ts/assert-property';
import { trackPressVisibility } from '@pkgs/ui-testing-bun-webview-shared-ts/track-press-visibility';
import fc from 'fast-check';

beforeAll(() => GlobalRegistrator.register());
afterAll(() => GlobalRegistrator.unregister());

test('scroll tracking releases its frame after success, rejection or navigation', async () => {
  await assertProperty(
    'press visibility cleanup',
    fc.asyncProperty(fc.boolean(), fc.boolean(), async (reject, navigate) => {
      const frame = globalThis.requestAnimationFrame;
      const cancel = globalThis.cancelAnimationFrame;
      const callbacks = new Map<number, FrameRequestCallback>();
      globalThis.requestAnimationFrame = (callback) => {
        callbacks.set(1, callback);
        return 1;
      };
      globalThis.cancelAnimationFrame = (id) => {
        callbacks.delete(id);
      };
      const original = new Error('native click failed');
      try {
        const result = await trackPressVisibility(
          { evaluate: async (script) => runInThisContext(script) },
          '[data-testid="attempt"]',
          async () => {
            expect(callbacks.size).toBe(1);
            if (navigate) {
              // Navigating discards callbacks and state belonging to the old document.
              callbacks.clear();
              Reflect.deleteProperty(window, '__uiTestingPressVisibility');
            }
            if (reject) throw original;
          }
        ).then(
          () => null,
          (error: unknown) => error
        );
        expect(result).toBe(reject ? original : null);
        expect(callbacks.size).toBe(0);
        expect(Reflect.has(window, '__uiTestingPressVisibility')).toBe(false);
      } finally {
        globalThis.requestAnimationFrame = frame;
        globalThis.cancelAnimationFrame = cancel;
        Reflect.deleteProperty(window, '__uiTestingPressVisibility');
      }
    })
  );
});
