/** @jsxImportSource solid-js */

import { afterEach, describe, expect, mock, spyOn, test } from 'bun:test';
import { ActionBar } from '@pkgs/ui-root-client-ts/action-bar';
import { ACTION_BAR_FEEDBACK_RESET_MS } from '@pkgs/ui-root-client-ts/action-bar-icon-button';
import { ActionBarLabeledControl } from '@pkgs/ui-root-client-ts/action-bar-labeled-control';
import { BottomActionBar } from '@pkgs/ui-root-client-ts/bottom-action-bar';
import {
  PlusIcon,
  SettingsIcon,
  ShareIcon,
  UsersIcon,
  XIcon,
} from '@pkgs/ui-root-client-ts/icons';
import type { OverflowMenuRenderProps } from '@pkgs/ui-root-client-ts/overflow-menu-button';
import { fireEvent, screen } from '@solidjs/testing-library';
import type { JSX } from 'solid-js';
import { cssOf, mustQuery, renderUi } from './render';

describe('ActionBar', () => {
  test('renders inline icon buttons with ≥44px targets and fires clicks', () => {
    const share = mock();
    renderUi(() => (
      <ActionBar
        items={[
          { id: 'share', label: 'Share', icon: ShareIcon, onClick: share },
          {
            id: 'settings',
            label: 'Settings',
            icon: SettingsIcon,
            onClick: () => {},
          },
        ]}
      />
    ));
    const btn = screen.getByRole('button', { name: 'Share' });
    expect(cssOf(btn)).toContain('min-width:44px');
    fireEvent.click(btn);
    expect(share).toHaveBeenCalledTimes(1);
    expect(screen.getAllByRole('button')).toHaveLength(2);
  });

  test('always-overflow items collapse behind a More trigger that opens the menu', () => {
    const renderMenu = mock<(menu: OverflowMenuRenderProps) => JSX.Element>(
      () => null
    );
    const onOpenMenu = mock();
    renderUi(() => (
      <ActionBar
        items={[
          { id: 'a', label: 'Alpha', icon: ShareIcon, onClick: () => {} },
          {
            id: 'b',
            label: 'Beta',
            icon: SettingsIcon,
            onClick: () => {},
            overflow: 'always',
          },
          {
            id: 'c',
            label: 'Gamma',
            icon: PlusIcon,
            onClick: () => {},
            overflow: 'always',
          },
        ]}
        renderMenu={renderMenu}
        onOpenMenu={onOpenMenu}
      />
    ));
    expect(screen.queryByRole('button', { name: 'Beta' })).toBeNull();
    const more = screen.getByRole('button', { name: 'More' });
    expect(more).toHaveAttribute('aria-haspopup', 'menu');
    expect(more).toHaveAttribute('aria-expanded', 'false');
    fireEvent.click(more);
    expect(onOpenMenu).toHaveBeenCalledTimes(1);
    expect(more).toHaveAttribute('aria-expanded', 'true');
    const last = renderMenu.mock.calls.at(-1)?.[0];
    expect(last?.open).toBe(true);
    expect(last?.content.rows.map((r) => r.id)).toEqual(['b', 'c']);
  });

  test('overflow="never" keeps everything inline; text actions render as buttons', () => {
    const onText = mock();
    renderUi(() => (
      <ActionBar
        overflow="never"
        items={[
          {
            id: 'a',
            label: 'Alpha',
            icon: ShareIcon,
            onClick: () => {},
            overflow: 'always',
          },
        ]}
        textActions={[{ id: 't', label: 'Publish', onClick: onText }]}
      />
    ));
    expect(screen.getByRole('button', { name: 'Alpha' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'More' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Publish' }));
    expect(onText).toHaveBeenCalledTimes(1);
  });

  test('inline labels render captions and press feedback flips the label', () => {
    const onClick = mock();
    const { clock } = renderUi(() => (
      <ActionBar
        showInlineLabels
        items={[
          {
            id: 'copy',
            label: 'Copy link',
            shortLabel: 'Copy',
            icon: ShareIcon,
            onClick,
            pressFeedback: { successLabel: 'Copied' },
          },
        ]}
      />
    ));
    const btn = screen.getByRole('button', { name: 'Copy link' });
    expect(btn).toHaveTextContent('Copy');
    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalledTimes(1);
    clock.advance(ACTION_BAR_FEEDBACK_RESET_MS);
    expect(btn).toHaveTextContent('Copy');
  });

  test('renders nothing without items, text actions, or end slot', () => {
    renderUi(() => <ActionBar items={[]} />);
    expect(document.querySelector('[data-component="ActionBar"]')).toBeNull();
  });

  test('ActionBarLabeledControl is a labeled ≥44px button', () => {
    const onClick = mock();
    renderUi(() => (
      <ActionBarLabeledControl
        caption="More"
        label="More actions"
        buttonSize={36}
        slotWidth={36}
        onClick={onClick}
      >
        <span>·</span>
      </ActionBarLabeledControl>
    ));
    const btn = screen.getByRole('button', { name: 'More actions' });
    expect(cssOf(btn)).toContain('min-height:44px');
    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalledTimes(1);
  });
});

// regression: space-header-actions-overlap-title
describe('ActionBar in a box too narrow for its actions', () => {
  afterEach(() => {
    mock.restore();
  });

  /** Lay out every `ActionBar` box `width` px wide; nothing else is measured. */
  function layOutBarsAt(width: number): void {
    const original = HTMLElement.prototype.getBoundingClientRect;
    spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(
      function (this: HTMLElement) {
        if (this.dataset['component'] === 'ActionBar') {
          return new DOMRect(0, 0, width, 44);
        }
        return original.call(this);
      }
    );
  }

  function SpaceLikeBar(props: {
    renderMenu: (menu: OverflowMenuRenderProps) => JSX.Element;
  }): JSX.Element {
    return (
      <ActionBar
        buttonSize={40}
        renderMenu={props.renderMenu}
        overflowDataSet={{ testid: 'bar-more' }}
        items={[
          {
            id: 'members',
            variant: 'avatar',
            label: 'People in this space',
            onClick: () => {},
            overflow: 'never',
            priority: 90,
            children: <UsersIcon size={24} />,
          },
          {
            id: 'end',
            label: 'End space',
            icon: XIcon,
            onClick: () => {},
            overflow: 'never',
            priority: 95,
          },
          {
            id: 'share',
            label: 'Share',
            icon: ShareIcon,
            onClick: () => {},
            overflow: 'always',
          },
        ]}
      />
    );
  }

  test.each([1, 43, 44, 60, 95])(
    'a %ipx box shows only the More trigger, and More holds every action',
    (width) => {
      layOutBarsAt(width);
      const renderMenu = mock<(menu: OverflowMenuRenderProps) => JSX.Element>(
        () => null
      );
      renderUi(() => <SpaceLikeBar renderMenu={renderMenu} />, { width: 320 });
      const bar = mustQuery('[data-component="ActionBar"]');
      // Inline controls, More included, must fit the box: one 44px slot.
      expect(bar.querySelectorAll('button')).toHaveLength(1);
      expect(
        screen.queryByRole('button', { name: 'People in this space' })
      ).toBeNull();
      expect(screen.queryByRole('button', { name: 'End space' })).toBeNull();
      fireEvent.click(screen.getByTestId('bar-more'));
      const last = renderMenu.mock.calls.at(-1)?.[0];
      expect(last?.content.rows.map((r) => r.id)).toEqual([
        'members',
        'end',
        'share',
      ]);
    }
  );

  test('the bar asks for its full row but gives it up down to the More trigger', () => {
    layOutBarsAt(60);
    renderUi(() => <SpaceLikeBar renderMenu={() => null} />, { width: 320 });
    const css = cssOf(mustQuery('[data-component="ActionBar"]'));
    // members 44 + end 44 + More 44, 8px apart.
    expect(css).toContain('width:148px');
    expect(css).toContain('max-width:100%');
    expect(css).toContain('min-width:44px');
    expect(css).toContain('flex-shrink:1000');
  });

  test('a box with room for everything shows every action inline', () => {
    layOutBarsAt(148);
    renderUi(() => <SpaceLikeBar renderMenu={() => null} />, { width: 320 });
    const bar = mustQuery('[data-component="ActionBar"]');
    expect(bar.querySelectorAll('button')).toHaveLength(3);
    // A lone overflow action takes the More trigger's place when it fits.
    expect(screen.getByRole('button', { name: 'Share' })).toBeInTheDocument();
    expect(screen.queryByTestId('bar-more')).toBeNull();
  });
});

describe('BottomActionBar', () => {
  test('mixes tab-style actions and contained buttons', () => {
    const hint = mock();
    const next = mock();
    renderUi(() => (
      <BottomActionBar
        items={[
          {
            type: 'action',
            id: 'hint',
            label: 'Hint',
            icon: ShareIcon,
            onClick: hint,
            selected: true,
          },
          {
            type: 'action',
            id: 'off',
            label: 'Off',
            icon: SettingsIcon,
            onClick: () => {},
            disabled: true,
          },
          { type: 'button', id: 'next', title: 'Next', onClick: next },
        ]}
      />
    ));
    const bar = mustQuery('[data-component="BottomActionBar"]');
    expect(cssOf(bar)).toContain('min-height:56px');
    expect(bar.className).not.toMatch(/border-t/);

    const hintBtn = screen.getByRole('button', { name: 'Hint' });
    expect(hintBtn).toHaveAttribute('aria-pressed', 'true');
    expect(hintBtn.className).toMatch(/min-h-11/);
    fireEvent.click(hintBtn);
    expect(hint).toHaveBeenCalledTimes(1);

    expect(screen.getByRole('button', { name: 'Off' })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(next).toHaveBeenCalledTimes(1);
  });
});
