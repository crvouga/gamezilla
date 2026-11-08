import { expect, test } from 'bun:test';
import { openContentLibrary } from '@libs/runtime-harness-ts/content-library-navigation';
import { JOURNEY_WAIT_MS } from '@libs/runtime-harness-ts/journey-gestures';
import type {
  Driver,
  DriverNode,
} from '@pkgs/ui-testing-root-shared-ts/driver';

function restoringLibrary(destinationAppears: boolean) {
  let screen = 'choice';
  const taps: string[] = [];
  const destinationWaits: number[] = [];
  const original = new Error(
    'Bun.WebView: trusted click missed the selected control; hit DIV; the element is gone'
  );
  const unused = (): never => {
    throw new Error('Unexpected driver operation');
  };
  const shown = (id: string): boolean =>
    (screen === 'choice' && id === 'game-choice-puzzle-library') ||
    (screen === 'library' && id === 'content-create-puzzle');
  const visible: DriverNode['expect']['visible'] = async (options) => {
    destinationWaits.push(options?.timeoutMs ?? 0);
    if (screen === 'loading' && destinationAppears) screen = 'library';
    if (screen !== 'library') throw new Error('Library never became visible');
  };
  const ui: Driver = {
    kind: 'script',
    launch: unused,
    close: unused,
    key: unused,
    snapshotHtml: unused,
    get: (id): DriverNode => ({
      get: unused,
      attribute: unused,
      tapAt: unused,
      drag: unused,
      layout: unused,
      selectFile: unused,
      input: unused,
      clear: unused,
      key: unused,
      scroll: unused,
      text: unused,
      isVisible: async () => shown(id),
      wait: async (_state, options) => {
        if (shown(id) || options?.visibleOr?.some(shown)) return;
        throw new Error('No navigation destination');
      },
      tap: async () => {
        taps.push(id);
        screen = 'loading';
        throw original;
      },
      expect: { visible, hidden: unused, text: unused },
    }),
  };
  return { ui, taps, original, destinationWaits };
}

// regression: content-library-interrupted-selection-before-destination-paint
test('a removed library choice waits for its delayed destination without clicking again', async () => {
  const fixture = restoringLibrary(true);
  await openContentLibrary(fixture.ui, 'numberlink');
  expect(fixture.taps).toEqual(['game-choice-puzzle-library']);
  expect(fixture.destinationWaits).toContain(JOURNEY_WAIT_MS);
  expect(await fixture.ui.get('content-create-puzzle').isVisible()).toBe(true);
});

test('an interrupted library selection preserves its original error when the destination never appears', async () => {
  const fixture = restoringLibrary(false);
  await expect(openContentLibrary(fixture.ui, 'numberlink')).rejects.toBe(
    fixture.original
  );
  expect(fixture.taps).toEqual(['game-choice-puzzle-library']);
  expect(fixture.destinationWaits).toEqual([JOURNEY_WAIT_MS]);
});
