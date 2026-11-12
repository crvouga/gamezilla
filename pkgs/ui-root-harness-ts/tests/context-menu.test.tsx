/** @jsxImportSource solid-js */

import { describe, expect, mock, test } from 'bun:test';
import { auditTree, formatFailure } from '@pkgs/a11y-shared-ts/audit';
import {
  CONTEXT_MENU_WIDTH,
  ContextMenu,
  type ContextMenuGroup,
} from '@pkgs/ui-root-client-ts/context-menu';
import {
  BugIcon,
  ClipboardPasteIcon,
  CopyIcon,
} from '@pkgs/ui-root-client-ts/icons';
import { SurfaceStackProvider } from '@pkgs/ui-root-client-ts/surface-stack';
import { fireEvent, screen } from '@solidjs/testing-library';
import userEvent from '@testing-library/user-event';
import { createSignal, type JSX } from 'solid-js';
import { cssOf, mustQuery, renderUi } from './render';

function groups(spy: {
  copy: () => void;
  paste: () => void;
  report: () => void;
}): ContextMenuGroup[] {
  return [
    {
      id: 'field',
      items: [
        { id: 'copy', label: 'Copy', icon: CopyIcon, onSelect: spy.copy },
        {
          id: 'paste',
          label: 'Paste',
          icon: ClipboardPasteIcon,
          disabled: true,
          onSelect: spy.paste,
        },
      ],
    },
    { id: 'empty', items: [] },
    {
      id: 'report',
      items: [
        {
          id: 'report-bug',
          label: 'Report a bug about this',
          icon: BugIcon,
          shortcut: 'mod+shift+b',
          onSelect: spy.report,
        },
      ],
    },
  ];
}

function Harness(props: {
  at?: { x: number; y: number };
  notice?: string;
  onSelect?: { copy: () => void; paste: () => void; report: () => void };
  onFocusAtSelect?: (focused: Element | null) => void;
}): JSX.Element {
  const [open, setOpen] = createSignal(false);
  const spy = () =>
    props.onSelect ?? {
      copy: () => props.onFocusAtSelect?.(document.activeElement),
      paste: () => undefined,
      report: () => undefined,
    };
  return (
    <SurfaceStackProvider>
      <input aria-label="Note" data-testid="field" />
      <button type="button" data-testid="open" onClick={() => setOpen(true)}>
        {'Open'}
      </button>
      <ContextMenu
        open={open()}
        at={props.at ?? { x: 100, y: 200 }}
        groups={groups(spy())}
        label="Actions"
        notice={props.notice}
        onClose={() => setOpen(false)}
      />
    </SurfaceStackProvider>
  );
}

function openFrom(testid: string): void {
  const opener = screen.getByTestId('open');
  screen.getByTestId(testid).focus();
  // Opening by the keyboard keeps focus where it was until the menu takes it.
  fireEvent.click(opener);
}

describe('ContextMenu', () => {
  test('opens at the point as one role=menu, a divider only between non-empty groups', () => {
    renderUi(() => <Harness />);
    openFrom('field');
    const menu = screen.getByRole('menu', { name: 'Actions' });
    expect(menu.closest('[data-component="ContextMenu"]')).not.toBeNull();
    expect(
      screen.getAllByRole('menuitem').map((el) => el.dataset['testid'])
    ).toEqual([
      'context-menu-copy',
      'context-menu-paste',
      'context-menu-report-bug',
    ]);
    expect(screen.getAllByRole('separator')).toHaveLength(1);
    const css = cssOf(mustQuery('[data-component="FloatingMenuPanel"]'));
    // Below the point by the 6px gap, starting at it.
    expect(css).toContain('top:206px');
    expect(css).toContain('left:100px');
    expect(css).toContain(`width:${CONTEXT_MENU_WIDTH}px`);
  });

  test('shows the shortcut as key caps and a disabled item cannot be chosen', () => {
    const paste = mock(() => undefined);
    renderUi(() => (
      <Harness
        onSelect={{ copy: () => undefined, paste, report: () => undefined }}
      />
    ));
    openFrom('field');
    const report = screen.getByTestId('context-menu-report-bug');
    expect(
      report.querySelector('[data-component="CommandPaletteKbd"]')
    ).not.toBeNull();
    const pasteItem = screen.getByTestId('context-menu-paste');
    expect(pasteItem).toBeDisabled();
    fireEvent.click(pasteItem);
    expect(paste).not.toHaveBeenCalled();
  });

  test('focus moves to the first item, and an item runs once focus is back where it was', async () => {
    const seen: { focusedAtSelect: Element | null } = { focusedAtSelect: null };
    renderUi(() => (
      <Harness
        onFocusAtSelect={(focused) => {
          seen.focusedAtSelect = focused;
        }}
      />
    ));
    openFrom('field');
    const copy = screen.getByTestId('context-menu-copy');
    expect(document.activeElement).toBe(copy);
    await userEvent.keyboard('{Enter}');
    expect(screen.queryByRole('menu')).toBeNull();
    expect(seen.focusedAtSelect).toBe(screen.getByTestId('field'));
    expect(document.activeElement).toBe(screen.getByTestId('field'));
  });

  test('arrow keys move between enabled items and Escape closes, returning focus', async () => {
    renderUi(() => <Harness />);
    openFrom('field');
    await userEvent.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(
      screen.getByTestId('context-menu-report-bug')
    );
    await userEvent.keyboard('{ArrowUp}');
    expect(document.activeElement).toBe(
      screen.getByTestId('context-menu-copy')
    );
    await userEvent.keyboard('{Escape}');
    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(screen.getByTestId('field'));
  });

  test('a notice shows under the items and is said aloud', () => {
    renderUi(() => <Harness notice="Press Ctrl+V instead." />);
    openFrom('field');
    expect(screen.getByRole('status').textContent).toBe(
      'Press Ctrl+V instead.'
    );
    expect(mustQuery('[data-component="FloatingMenuNotice"]').textContent).toBe(
      'Press Ctrl+V instead.'
    );
  });

  test('near the bottom right it stays inside the window', () => {
    renderUi(() => <Harness at={{ x: 1020, y: 760 }} />, {
      width: 1024,
      height: 768,
    });
    openFrom('field');
    const css = cssOf(mustQuery('[data-component="FloatingMenuPanel"]'));
    const left = Number(/left:(-?[\d.]+)px/.exec(css)?.[1]);
    const top = Number(/top:(-?[\d.]+)px/.exec(css)?.[1]);
    expect(left + CONTEXT_MENU_WIDTH).toBeLessThanOrEqual(1024);
    expect(top).toBeLessThan(760);
  });

  test('passes the accessibility audit while open', () => {
    renderUi(() => <Harness notice="Press Ctrl+V instead." />);
    openFrom('field');
    const failures = auditTree(mustQuery('[data-component="ContextMenu"]'));
    expect(failures.map(formatFailure)).toEqual([]);
  });
});
