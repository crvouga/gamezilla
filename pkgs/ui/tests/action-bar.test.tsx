/** @jsxImportSource solid-js */
import {
  ACTION_BAR_FEEDBACK_RESET_MS,
  ActionBar,
  ActionBarLabeledControl,
} from '@pkgs/ui/components/action-bar';
import { BottomActionBar } from '@pkgs/ui/components/bottom-action-bar';
import { PlusIcon, SettingsIcon, ShareIcon } from '@pkgs/ui/components/icons';
import type { OverflowMenuRenderProps } from '@pkgs/ui/components/overflow-menu-button';
import { fireEvent, screen } from '@solidjs/testing-library';
import type { JSX } from 'solid-js';
import { describe, expect, test, vi } from 'vitest';
import { cssOf, mustQuery, renderUi } from './support/render';

describe('ActionBar', () => {
  test('renders inline icon buttons with ≥44px targets and fires clicks', () => {
    const share = vi.fn();
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
    const renderMenu = vi.fn<(menu: OverflowMenuRenderProps) => JSX.Element>(
      () => null
    );
    const onOpenMenu = vi.fn();
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
    const onText = vi.fn();
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
    const onClick = vi.fn();
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
    const onClick = vi.fn();
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

describe('BottomActionBar', () => {
  test('mixes tab-style actions and contained buttons', () => {
    const hint = vi.fn();
    const next = vi.fn();
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
    expect(hintBtn.className).toMatch(/min-h-\[44px\]/);
    fireEvent.click(hintBtn);
    expect(hint).toHaveBeenCalledTimes(1);

    expect(screen.getByRole('button', { name: 'Off' })).toBeDisabled();

    fireEvent.click(screen.getByRole('button', { name: 'Next' }));
    expect(next).toHaveBeenCalledTimes(1);
  });
});
