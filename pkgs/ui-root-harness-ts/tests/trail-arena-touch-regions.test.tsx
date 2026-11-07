import { afterEach, expect, test } from 'bun:test';
import { renderWithI18n } from '@pkgs/bun-test-solid-client-ts/render';
import { TrailArena } from '@pkgs/ui-root-client-ts/trail-arena';
import { cleanup } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';

afterEach(cleanup);

// regression: light-cycles-unmarked-touch-halves
test('touch ownership stays outside the drawing and disappears when shared steering ends', () => {
  const [shared, setShared] = createSignal(true);
  const view = renderWithI18n(() => (
    <TrailArena
      width={40}
      height={28}
      cells={'.'.repeat(40 * 28)}
      riders={[]}
      crashes={[]}
      enabled={false}
      onDirection={() => {}}
      label="Arena"
      instructionsId="instructions"
      testId="arena"
      touchRegions={shared() ? ['Left: Ember', 'Right: Comet'] : undefined}
    />
  ));
  const drawing = view.getByTestId('arena-drawing');
  const labels = view.getByTestId('arena-touch-regions');
  expect(drawing.contains(labels)).toBe(false);
  expect(labels.textContent).toBe('Left: EmberRight: Comet');
  expect(
    drawing.compareDocumentPosition(labels) & Node.DOCUMENT_POSITION_FOLLOWING
  ).not.toBe(0);
  setShared(false);
  expect(view.queryByTestId('arena-touch-regions')).toBeNull();
});
