import { afterEach, expect, test } from 'bun:test';
import { EmptyState } from '@pkgs/ui-root-client-ts/empty-state';
import { cleanup, render } from '@solidjs/testing-library';

afterEach(cleanup);

function mount(align?: 'center' | 'start') {
  return render(() => (
    <EmptyState
      align={align}
      title="There's nothing at this address"
      body="The link may be old or mistyped."
      action={{ label: 'Go to Spaces', onClick: () => undefined }}
      dataSet={{ testid: 'empty' }}
    />
  ));
}

test('an empty state is centered by default', () => {
  const view = mount();
  const block = view.getByTestId('empty');
  expect(block.dataset['align']).toBe('center');
  expect(view.getByText("There's nothing at this address").className).toContain(
    'text-center'
  );
});

test('aligned to start, it lines up on its column edge, copy and actions alike', () => {
  const view = mount('start');
  const block = view.getByTestId('empty');
  expect(block.dataset['align']).toBe('start');
  expect(block.className).toContain('items-start');
  expect(
    view.getByText("There's nothing at this address").className
  ).not.toContain('text-center');
  expect(
    view.getByText('The link may be old or mistyped.').className
  ).not.toContain('text-center');
  const actions = view.getByText('Go to Spaces').closest('.box.mt-2');
  expect(actions?.className).toContain('justify-start');
});
