import { afterEach, expect, test } from 'bun:test';
import { PaddleCourt } from '@pkgs/ui-root-client-ts/paddle-court';
import { cleanup, fireEvent, render } from '@solidjs/testing-library';

afterEach(cleanup);

function court(controlled: ('first' | 'second')[] = ['first', 'second']) {
  const directions: unknown[] = [];
  const targets: unknown[] = [];
  const view = render(() => (
    <PaddleCourt
      width={1200}
      height={800}
      controlled={controlled}
      enabled={true}
      label="Pong court"
      instructionsId="court-help"
      testId="court"
      paddles={[
        { side: 'first', x: 64, y: 400, width: 18, height: 144 },
        { side: 'second', x: 1136, y: 400, width: 18, height: 144 },
      ]}
      ball={{ x: 600, y: 400, size: 20 }}
      onDirection={(side, direction) => directions.push([side, direction])}
      onTarget={(side, target) => targets.push([side, target])}
      onRelease={() => {}}
    />
  ));
  const element = view.getByRole('application');
  element.setPointerCapture = () => undefined;
  return { ...view, element, directions, targets };
}

test('focused court keys control separate paddles and release on blur', () => {
  const view = court();
  fireEvent.keyDown(view.element, { key: 'w' });
  fireEvent.keyDown(view.element, { key: 'ArrowDown' });
  fireEvent.keyUp(view.element, { key: 'w' });
  expect(view.directions).toEqual([
    ['first', -1],
    ['second', 1],
    ['first', 0],
  ]);
  fireEvent.blur(view.element);
  expect(view.directions.slice(-2)).toEqual([
    ['first', 0],
    ['second', 0],
  ]);
  expect(view.element.querySelector('svg')?.getAttribute('viewBox')).toBe(
    '0 0 1200 800'
  );
});

test('a single player can use arrow keys on either side without moving the opponent', () => {
  const view = court(['first']);
  fireEvent.keyDown(view.element, { key: 'ArrowUp' });
  fireEvent.keyDown(view.element, { key: 's' });
  fireEvent.keyUp(view.element, { key: 'ArrowUp' });
  expect(view.directions).toEqual([
    ['first', -1],
    ['first', 0],
    ['first', 1],
  ]);
  fireEvent.keyDown(view.element, { key: 'ArrowDown', ctrlKey: true });
  expect(view.directions).toHaveLength(3);
});

test('simultaneous touches stay assigned to their own side and cancellation stops movement', () => {
  const view = court();
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
  fireEvent.pointerDown(view.element, {
    pointerId: 1,
    pointerType: 'touch',
    clientX: 100,
    clientY: 100,
  });
  fireEvent.pointerDown(view.element, {
    pointerId: 2,
    pointerType: 'touch',
    clientX: 500,
    clientY: 300,
  });
  fireEvent.pointerMove(view.element, {
    pointerId: 1,
    pointerType: 'touch',
    clientX: 500,
    clientY: 500,
  });
  expect(view.targets).toEqual([
    ['first', 0.25],
    ['second', 0.75],
    ['first', 1],
  ]);
  fireEvent.pointerCancel(view.element, { pointerId: 1 });
  expect(view.directions.at(-1)).toEqual(['first', 0]);
});

test('a spectator cannot focus controls, move either paddle or capture scrolling', () => {
  const view = court([]);
  fireEvent.keyDown(view.element, { key: 'w' });
  fireEvent.pointerDown(view.element, {
    pointerId: 1,
    pointerType: 'touch',
    clientX: 100,
    clientY: 100,
  });
  expect(view.element.tabIndex).toBe(-1);
  expect(view.element.dataset['interactive']).toBe('false');
  expect(view.directions).toEqual([]);
  expect(view.targets).toEqual([]);
});
