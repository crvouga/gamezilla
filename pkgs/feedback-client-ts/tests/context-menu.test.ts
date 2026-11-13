import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import {
  type ContextMenuControl,
  installContextMenu,
} from '@pkgs/feedback-client-ts/context-menu';
import { CONTEXT_MENU } from '@pkgs/feedback-client-ts/copy';
import type { BrowserPort } from '@pkgs/feedback-client-ts/ports';
import type { BugReportSubject } from '@pkgs/feedback-shared-ts/types';
import { settle } from './support';

type Calls = { name: string; value?: string }[];

function fakeBrowser(calls: Calls, clipboard: { text: string | null }) {
  const call =
    (name: string) =>
    (value?: unknown): void => {
      calls.push({
        name,
        ...(typeof value === 'string' ? { value } : {}),
      });
    };
  const port: BrowserPort = {
    writeText: (text) => {
      call('writeText')(text);
      return Promise.resolve(true);
    },
    readText: () => Promise.resolve(clipboard.text),
    edit: (command) => {
      call('edit')(command);
      return true;
    },
    insertText: (text) => {
      call('insertText')(text);
      return true;
    },
    copyImage: (url) => {
      call('copyImage')(url);
      return Promise.resolve(true);
    },
    saveImage: call('saveImage'),
    openInNewTab: call('openInNewTab'),
    search: call('search'),
    follow: () => call('follow')(),
    history: () => ({ back: true, forward: false }),
    back: () => call('back')(),
    forward: () => call('forward')(),
    reload: () => call('reload')(),
    print: () => call('print')(),
    pageUrl: () => 'http://local/play',
  };
  return port;
}

let control: ContextMenuControl;
let calls: Calls;
let clipboard: { text: string | null };
let reported: BugReportSubject[];

beforeEach(() => {
  document.getSelection()?.removeAllRanges();
  document.body.innerHTML = `
    <main data-testid="home" data-screen="home">
      <button data-testid="settings">Settings</button>
      <input data-testid="note" aria-label="Note" />
      <a data-testid="rules" href="/rules">Rules</a>
      <img data-testid="logo" alt="Logo" src="http://local/logo.png" />
      <p data-testid="words">Castling keeps the king safe</p>
      <section data-native-context-menu><p data-testid="own">Own</p></section>
    </main>`;
  calls = [];
  clipboard = { text: 'pasted' };
  reported = [];
  control = installContextMenu({
    document,
    browser: fakeBrowser(calls, clipboard),
    onReport: (subject) => reported.push(subject),
  });
});
afterEach(() => control.dispose());

function el(testid: string): HTMLElement {
  const found = document.querySelector<HTMLElement>(
    `[data-testid="${testid}"]`
  );
  if (!found) throw new Error(testid);
  return found;
}

/** A right-click as a pointer of this kind makes it; whether the page kept it. */
function rightClick(
  testid: string,
  options: { pointerType?: string; shiftKey?: boolean } = {}
): MouseEvent {
  const target = el(testid);
  target.dispatchEvent(
    new PointerEvent('pointerdown', {
      bubbles: true,
      button: 2,
      pointerType: options.pointerType ?? 'mouse',
    })
  );
  const menu = new MouseEvent('contextmenu', {
    bubbles: true,
    cancelable: true,
    button: 2,
    clientX: 40,
    clientY: 50,
    shiftKey: options.shiftKey ?? false,
  });
  target.dispatchEvent(menu);
  return menu;
}

const ids = () =>
  control.state().groups.flatMap((group) => group.items.map((item) => item.id));
const choose = (id: string) => {
  const item = control
    .state()
    .groups.flatMap((group) => group.items)
    .find((each) => each.id === id);
  if (!item) throw new Error(`No ${id} in ${ids().join(', ')}`);
  control.close();
  item.onSelect();
};

describe('opening the menu', () => {
  test('a right-click with a mouse opens it at the pointer instead of the browser menu', () => {
    const event = rightClick('settings');
    expect(event.defaultPrevented).toBe(true);
    expect(control.state()).toMatchObject({ open: true, at: { x: 40, y: 50 } });
  });

  test.each(['touch', 'pen'])('a %s long press keeps what it did', (kind) => {
    const event = rightClick('settings', { pointerType: kind });
    expect(event.defaultPrevented).toBe(false);
    expect(control.state().open).toBe(false);
  });

  test('Shift+right-click gives the browser its own menu', () => {
    expect(rightClick('settings', { shiftKey: true }).defaultPrevented).toBe(
      false
    );
    expect(control.state().open).toBe(false);
  });

  test('a second right-click while it is open closes it for the browser menu', () => {
    rightClick('settings');
    const second = rightClick('settings');
    expect(second.defaultPrevented).toBe(false);
    expect(control.state().open).toBe(false);
  });

  test('a page that handled the right-click itself keeps it', () => {
    el('settings').addEventListener('contextmenu', (event) =>
      event.preventDefault()
    );
    rightClick('settings');
    expect(control.state().open).toBe(false);
  });

  test('inside data-native-context-menu the browser keeps its menu', () => {
    expect(rightClick('own').defaultPrevented).toBe(false);
    expect(control.state().open).toBe(false);
  });

  test.each([
    ['the ContextMenu key', { key: 'ContextMenu' }],
    ['Shift+F10', { key: 'F10', shiftKey: true }],
  ])(
    '%s opens it at the focused thing and swallows the browser menu',
    (_name, init) => {
      el('settings').focus();
      const key = new KeyboardEvent('keydown', {
        ...init,
        bubbles: true,
        cancelable: true,
      });
      el('settings').dispatchEvent(key);
      expect(key.defaultPrevented).toBe(true);
      expect(control.state().open).toBe(true);
      // Some browsers still raise their own for the key: it never shows over ours.
      const menu = new MouseEvent('contextmenu', {
        bubbles: true,
        cancelable: true,
      });
      el('settings').dispatchEvent(menu);
      expect(menu.defaultPrevented).toBe(true);
      expect(control.state().open).toBe(true);
    }
  );
});

describe('what it offers', () => {
  test('on the page: going back and forward, reload, the page link, print, and reporting', () => {
    rightClick('settings');
    expect(ids()).toEqual([
      'back',
      'forward',
      'reload',
      'copy-page-link',
      'print',
      'report-bug',
    ]);
    const forward = control.state().groups[0]?.items[1];
    expect(forward?.disabled).toBe(true);
    expect(control.state().groups.at(-1)?.items[0]).toMatchObject({
      label: CONTEXT_MENU.reportBug,
      shortcut: 'mod+shift+b',
    });
  });

  test('on a link: open, open in a new tab, copy its address', async () => {
    rightClick('rules');
    expect(ids()).toEqual([
      'open-link',
      'open-link-in-new-tab',
      'copy-link',
      'report-bug',
    ]);
    choose('copy-link');
    await settle();
    expect(calls.at(-1)).toEqual({
      name: 'writeText',
      value: new URL('/rules', location.href).href,
    });
  });

  test('on a picture: open in a new tab, copy, save', () => {
    rightClick('logo');
    expect(ids()).toEqual([
      'open-image-in-new-tab',
      'copy-image',
      'save-image',
      'report-bug',
    ]);
    choose('save-image');
    expect(calls.at(-1)).toEqual({
      name: 'saveImage',
      value: 'http://local/logo.png',
    });
  });

  test('on selected words: copy, search the web for them, select all', () => {
    const words = el('words').firstChild as Text;
    document.getSelection()?.setBaseAndExtent(words, 0, words, 8);
    rightClick('words');
    expect(ids()).toEqual(['copy', 'search', 'select-all', 'report-bug']);
    expect(control.state().groups[0]?.items[1]?.label).toBe(
      'Search the web for “Castling”'
    );
    choose('search');
    expect(calls.at(-1)).toEqual({ name: 'search', value: 'Castling' });
  });

  test('in a field: undo, redo, cut, copy, paste, select all', () => {
    rightClick('note');
    expect(ids()).toEqual([
      'undo',
      'redo',
      'cut',
      'copy',
      'paste',
      'select-all',
      'report-bug',
    ]);
    // Nothing selected: nothing to cut or copy.
    const field = control.state().groups[1]?.items ?? [];
    expect(field.map((item) => item.disabled === true)).toEqual([
      true,
      true,
      false,
      false,
    ]);
  });

  test('paste types what was copied into the field', async () => {
    rightClick('note');
    choose('paste');
    await settle();
    expect(calls.at(-1)).toEqual({ name: 'insertText', value: 'pasted' });
  });

  test('paste the browser does not allow says so plainly', async () => {
    clipboard.text = null;
    rightClick('note');
    choose('paste');
    await settle();
    expect(control.state()).toMatchObject({
      open: true,
      notice: CONTEXT_MENU.pasteRefused,
    });
    control.close();
    expect(control.state().notice).toBeUndefined();
  });
});

describe('reporting a bug about this', () => {
  test('names the thing the way the app does, with where it was', () => {
    rightClick('settings');
    choose('report-bug');
    expect(reported).toEqual([
      expect.objectContaining({
        testIds: ['settings', 'home'],
        screen: 'home',
        name: 'Settings',
        role: 'button',
        pointer: { x: 40, y: 50 },
        selectedText: null,
      }),
    ]);
  });

  test('a field is named by its label, never by what was typed in it', () => {
    (el('note') as HTMLInputElement).value = 'a secret plan';
    rightClick('note');
    choose('report-bug');
    expect(JSON.stringify(reported)).not.toContain('a secret plan');
    expect(reported[0]?.name).toBe('Note');
  });
});
