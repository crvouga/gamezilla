import { afterEach, expect, mock, spyOn, test } from 'bun:test';
import { ActionBar } from '@pkgs/ui-root-client-ts/action-bar';
import { screen } from '@solidjs/testing-library';
import { cssOf, mustQuery, renderUi } from './render';

afterEach(() => mock.restore());

test('a lone overflow text action reserves its full inline width beside a title', () => {
  // regression: friend-long-name-escapes-profile
  // Literal automated diagnostic: Block is 62.28125px inside a 44px bar,
  // with no icon items or More trigger.
  const original = HTMLElement.prototype.getBoundingClientRect;
  spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
    function (this: HTMLElement) {
      if (this.dataset['component'] === 'ActionBar')
        return new DOMRect(0, 0, 44, 44);
      if (this.firstElementChild?.tagName === 'BUTTON')
        return new DOMRect(0, 0, 62.28125, 44);
      return original.call(this);
    }
  );
  renderUi(
    () => (
      <ActionBar
        items={[]}
        textActions={[
          {
            id: 'block',
            label: 'Block',
            onClick: () => undefined,
            overflow: 'always',
          },
        ]}
      />
    ),
    { width: 390 }
  );
  expect(screen.getByRole('button', { name: 'Block' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'More' })).toBeNull();
  const css = cssOf(mustQuery('[data-component="ActionBar"]'));
  expect(css).toContain('width:63px');
  expect(css).toContain('min-width:63px');
});
