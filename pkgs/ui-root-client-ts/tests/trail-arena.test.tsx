import { afterEach, expect, test } from 'bun:test';
import {
  TrailArena,
  type TrailOverlay,
  type TrailRider,
} from '@pkgs/ui-root-client-ts/trail-arena';
import { cleanup, fireEvent, render } from '@solidjs/testing-library';
import { createSignal } from 'solid-js';

afterEach(cleanup);

const WIDTH = 6;
const HEIGHT = 4;
/* Rider 0 owns a run of three and a cell below; rider 1 owns two separate cells. */
const CELLS = ['000...', '0...1.', '......', '1.....'].join('');

function rider(
  index: 0 | 1 | 2 | 3,
  controlled: boolean,
  alive = true
): TrailRider {
  return {
    index,
    x: index + 1,
    y: 2,
    heading: index === 0 ? 'right' : 'left',
    alive,
    mark: 'CENV'.charAt(index),
    controlled,
    label: `Rider ${index}`,
  };
}

function arena(options: {
  riders: readonly TrailRider[];
  enabled?: boolean;
  overlay?: TrailOverlay | undefined;
}) {
  const directions: unknown[] = [];
  const view = render(() => (
    <TrailArena
      width={WIDTH}
      height={HEIGHT}
      cells={CELLS}
      riders={options.riders}
      crashes={[{ index: 1, x: 2, y: 2 }]}
      overlay={options.overlay}
      enabled={options.enabled ?? true}
      label="Light cycles arena"
      instructionsId="arena-help"
      testId="arena"
      onDirection={(heading, slot) => directions.push([heading, slot])}
    />
  ));
  const element = view.getByRole('application');
  element.setPointerCapture = () => undefined;
  return { ...view, element, directions };
}

test('riders, trails and crashes expose their state as data attributes', () => {
  const view = arena({ riders: [rider(0, true), rider(1, false, false)] });
  expect(view.element.dataset['component']).toBe('TrailArena');
  expect(view.element.dataset['testid']).toBe('arena');
  const first = view.getByTestId('arena-rider-0');
  expect(first.dataset['x']).toBe('1');
  expect(first.dataset['y']).toBe('2');
  expect(first.dataset['heading']).toBe('right');
  expect(first.dataset['alive']).toBe('true');
  expect(first.dataset['controlled']).toBe('true');
  expect(first.dataset['trailCount']).toBe('4');
  expect(first.textContent).toContain('C');
  const second = view.getByTestId('arena-rider-1');
  expect(second.dataset['alive']).toBe('false');
  expect(second.dataset['trailCount']).toBe('2');
  expect(view.getByTestId('arena-trail-0').getAttribute('d')).toBe(
    'M0 0h3v1h-3zM0 1h1v1h-1z'
  );
  expect(view.getByTestId('arena-trail-1').dataset['trailCount']).toBe('2');
  expect(view.getByTestId('arena-trail-2').hasAttribute('d')).toBe(false);
  const crash = view.getByTestId('arena-crash-1');
  expect([crash.dataset['x'], crash.dataset['y']]).toEqual(['2', '2']);
});

test('the viewBox is fixed in cells and each rider has its own trail pattern', () => {
  const view = arena({ riders: [rider(0, false)] });
  const svg = view.getByTestId('arena-drawing');
  expect(svg.getAttribute('viewBox')).toBe('-1.5 -1.5 9 7');
  expect(svg.getAttribute('aria-hidden')).toBe('true');
  const fills = [0, 1, 2, 3].map((index) =>
    view.getByTestId(`arena-trail-${index}`).getAttribute('fill')
  );
  expect(new Set(fills).size).toBe(4);
  for (const fill of fills) {
    const id = /^url\(#(.+)\)$/.exec(fill ?? '')?.[1] ?? '';
    expect(view.container.querySelector(`pattern[id="${id}"]`)).not.toBeNull();
  }
});

test('a single steered rider takes both arrows and WASD, and repeats are ignored', () => {
  const view = arena({ riders: [rider(0, false), rider(1, true)] });
  expect(view.element.tabIndex).toBe(0);
  const up = fireEvent.keyDown(view.element, { key: 'ArrowUp' });
  fireEvent.keyDown(view.element, { key: 'a' });
  fireEvent.keyDown(view.element, { key: 'ArrowUp', repeat: true });
  fireEvent.keyDown(view.element, { key: 'ArrowDown', ctrlKey: true });
  const other = fireEvent.keyDown(view.element, { key: 'x' });
  expect(up).toBe(false);
  expect(other).toBe(true);
  expect(view.directions).toEqual([
    ['up', 0],
    ['left', 0],
  ]);
});

test('two riders on one keyboard: arrows steer slot 0 and WASD steers slot 1', () => {
  const view = arena({ riders: [rider(0, true), rider(1, true)] });
  fireEvent.keyDown(view.element, { key: 'ArrowLeft' });
  fireEvent.keyDown(view.element, { key: 'W' });
  fireEvent.keyDown(view.element, { key: 'd' });
  fireEvent.keyDown(view.element, { key: 'z', code: 'KeyW' });
  fireEvent.keyDown(view.element, { key: 'ArrowDown' });
  expect(view.directions).toEqual([
    ['left', 0],
    ['up', 1],
    ['right', 1],
    ['up', 1],
    ['down', 0],
  ]);
});

test('a swipe steers the rider on its side once it travels far enough', () => {
  const view = arena({ riders: [rider(0, true), rider(1, true)] });
  view.element.getBoundingClientRect = () => ({
    x: 0,
    y: 0,
    top: 0,
    left: 0,
    right: 600,
    bottom: 400,
    width: 600,
    height: 400,
    toJSON: () => ({}),
  });
  const touch = { pointerType: 'touch' };
  fireEvent.pointerDown(view.element, {
    ...touch,
    pointerId: 1,
    clientX: 100,
    clientY: 100,
  });
  fireEvent.pointerDown(view.element, {
    ...touch,
    pointerId: 2,
    clientX: 500,
    clientY: 100,
  });
  fireEvent.pointerMove(view.element, {
    ...touch,
    pointerId: 1,
    clientX: 110,
    clientY: 100,
  });
  fireEvent.pointerMove(view.element, {
    ...touch,
    pointerId: 1,
    clientX: 100,
    clientY: 140,
  });
  fireEvent.pointerMove(view.element, {
    ...touch,
    pointerId: 2,
    clientX: 460,
    clientY: 105,
  });
  fireEvent.pointerUp(view.element, { ...touch, pointerId: 1 });
  fireEvent.pointerMove(view.element, {
    ...touch,
    pointerId: 1,
    clientX: 100,
    clientY: 300,
  });
  expect(view.directions).toEqual([
    ['down', 1],
    ['left', 0],
  ]);
});

test('a watched or disabled arena cannot be focused, steered or capture scrolling', () => {
  for (const view of [
    arena({ riders: [rider(0, false), rider(1, false)] }),
    arena({ riders: [rider(0, true)], enabled: false }),
  ]) {
    const handled = fireEvent.keyDown(view.element, { key: 'ArrowUp' });
    fireEvent.pointerDown(view.element, {
      pointerId: 1,
      pointerType: 'touch',
      clientX: 0,
      clientY: 0,
    });
    fireEvent.pointerMove(view.element, {
      pointerId: 1,
      pointerType: 'touch',
      clientX: 0,
      clientY: 80,
    });
    expect(handled).toBe(true);
    expect(view.element.tabIndex).toBe(-1);
    expect(view.element.dataset['interactive']).toBe('false');
    expect(view.directions).toEqual([]);
    cleanup();
  }
});

test('the arena is named and described, and the overlay is announced in place', () => {
  const [overlay, setOverlay] = createSignal<TrailOverlay | undefined>();
  const directions: unknown[] = [];
  const view = render(() => (
    <TrailArena
      width={WIDTH}
      height={HEIGHT}
      cells={CELLS}
      riders={[rider(0, true)]}
      crashes={[]}
      overlay={overlay()}
      enabled={true}
      label="Light cycles arena"
      instructionsId="arena-help"
      testId="arena"
      onDirection={(heading, slot) => directions.push([heading, slot])}
    />
  ));
  const element = view.getByRole('application', { name: 'Light cycles arena' });
  expect(element.getAttribute('aria-describedby')).toBe('arena-help');
  const status = view.getByRole('status');
  expect(status.textContent).toBe('');
  setOverlay({ title: '3', detail: 'Round 2' });
  expect(status.textContent).toBe('3Round 2');
  setOverlay({ title: 'Comet wins the round' });
  expect(status.textContent).toBe('Comet wins the round');
  expect(view.getByTestId('arena-overlay').dataset['open']).toBe('true');
});
