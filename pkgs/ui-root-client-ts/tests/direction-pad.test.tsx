import { afterEach, expect, test } from 'bun:test';
import { DirectionPad } from '@pkgs/ui-root-client-ts/direction-pad';
import { cleanup, fireEvent, render } from '@solidjs/testing-library';

afterEach(cleanup);

const LABELS = {
  up: 'Steer up',
  right: 'Steer right',
  down: 'Steer down',
  left: 'Steer left',
};

function pad(disabled = false) {
  const headings: string[] = [];
  const view = render(() => (
    <DirectionPad
      labels={LABELS}
      disabled={disabled}
      testId="pad"
      onDirection={(heading) => headings.push(heading)}
    />
  ));
  return { ...view, headings };
}

test('four named buttons, each with its own test id', () => {
  const view = pad();
  expect(view.getByRole('group').dataset['component']).toBe('DirectionPad');
  for (const heading of ['up', 'right', 'down', 'left'] as const) {
    const button = view.getByRole('button', { name: LABELS[heading] });
    expect(button.dataset['testid']).toBe(`pad-${heading}`);
    expect(button.getAttribute('type')).toBe('button');
  }
});

test('a touch steers on pointer-down and its click does not steer again', () => {
  const view = pad();
  const up = view.getByTestId('pad-up');
  fireEvent.pointerDown(up, { pointerType: 'touch', pointerId: 1 });
  expect(view.headings).toEqual(['up']);
  fireEvent.click(up, { detail: 1 });
  expect(view.headings).toEqual(['up']);
  const left = view.getByTestId('pad-left');
  fireEvent.pointerDown(left, { pointerType: 'mouse', button: 2 });
  fireEvent.pointerDown(left, { pointerType: 'mouse', button: 0 });
  fireEvent.click(left, { detail: 1 });
  expect(view.headings).toEqual(['up', 'left']);
});

test('keyboard and assistive-technology clicks steer on click', () => {
  const view = pad();
  const right = view.getByTestId('pad-right');
  right.focus();
  expect(document.activeElement).toBe(right);
  fireEvent.click(right, { detail: 0 });
  fireEvent.click(view.getByTestId('pad-down'), { detail: 1 });
  expect(view.headings).toEqual(['right', 'down']);
});

test('a cancelled touch does not swallow the next click', () => {
  const view = pad();
  const down = view.getByTestId('pad-down');
  fireEvent.pointerDown(down, { pointerType: 'touch', pointerId: 1 });
  fireEvent.pointerCancel(down, { pointerId: 1 });
  fireEvent.click(down, { detail: 1 });
  expect(view.headings).toEqual(['down', 'down']);
});

test('a disabled pad steers nothing', () => {
  const view = pad(true);
  for (const heading of ['up', 'right', 'down', 'left'] as const) {
    const button = view.getByTestId(`pad-${heading}`) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    fireEvent.pointerDown(button, { pointerType: 'touch', pointerId: 1 });
    fireEvent.click(button, { detail: 0 });
  }
  expect(view.headings).toEqual([]);
});
