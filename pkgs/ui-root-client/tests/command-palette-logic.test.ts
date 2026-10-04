import { describe, expect, test } from 'bun:test';
import {
  buildPaletteRows,
  DEFAULT_CATEGORY,
  groupPaletteRows,
  RECENT_SECTION_TITLE,
  selectableRows,
} from '@pkgs/ui-root-client/command-palette-filter';
import {
  formatShortcutToken,
  shortcutTokens,
} from '@pkgs/ui-root-client/command-palette-kbd';
import {
  findCommandForShortcut,
  matchOpenShortcut,
} from '@pkgs/ui-root-client/command-registry-shortcuts';
import { highlightSegments } from '@pkgs/ui-root-client/highlighted-text';
import type { RegisteredCommand } from '@pkgs/ui-root-client/types';
import {
  commandSearchText,
  isCommandEnabled,
  isCommandVisible,
  normalizeShortcut,
} from '@pkgs/ui-root-client/types';
import {
  clampPaletteSelection,
  nextPaletteSelection,
} from '@pkgs/ui-root-shared/command-palette-keyboard';
import { fuzzyMatch, mergeRanges } from '@pkgs/ui-root-shared/fuzzy-match';
import type { WebKeyboardEventLike } from '@pkgs/ui-root-shared/match';
import { isMacPlatform } from '@pkgs/ui-root-shared/match';

function cmd(
  id: string,
  title: string,
  extra: Partial<RegisteredCommand> = {}
): RegisteredCommand {
  return { id, title, run: () => {}, _version: 0, ...extra };
}

const COMMANDS: RegisteredCommand[] = [
  cmd('new-space', 'New space', { category: 'Spaces', keywords: ['create'] }),
  cmd('join-space', 'Join space', { category: 'Spaces' }),
  cmd('sign-out', 'Sign out', { category: 'Account', shortcut: 'mod+shift+q' }),
  cmd('theme', 'Toggle theme'),
  cmd('hidden', 'Hidden thing', { visible: false }),
];

/** `mod` is Meta on macOS web and Ctrl elsewhere. */
const MOD: Partial<WebKeyboardEventLike> = isMacPlatform()
  ? { metaKey: true }
  : { ctrlKey: true };

function key(
  k: string,
  mods: Partial<WebKeyboardEventLike> = {}
): WebKeyboardEventLike {
  return {
    key: k,
    metaKey: false,
    ctrlKey: false,
    altKey: false,
    shiftKey: false,
    repeat: false,
    preventDefault() {},
    ...mods,
  };
}

describe('fuzzyMatch', () => {
  test('empty query matches everything with zero score', () => {
    expect(fuzzyMatch('', 'anything')).toEqual({ score: 0, ranges: [] });
  });

  test('subsequence match returns inclusive ranges; non-match is null', () => {
    const m = fuzzyMatch('nsp', 'new space');
    expect(m).not.toBeNull();
    expect(m?.ranges).toEqual([
      [0, 0],
      [4, 5],
    ]);
    expect(fuzzyMatch('xyz', 'new space')).toBeNull();
  });

  test('contiguous and word-start matches score higher', () => {
    const contiguous = fuzzyMatch('space', 'new space')?.score ?? 0;
    const scattered = fuzzyMatch('sae', 'new space')?.score ?? 0;
    expect(contiguous).toBeGreaterThan(scattered);
  });

  test('mergeRanges collapses overlapping and adjacent ranges', () => {
    expect(
      mergeRanges([
        [5, 6],
        [0, 1],
        [2, 3],
        [6, 8],
      ])
    ).toEqual([
      [0, 3],
      [5, 8],
    ]);
  });

  test('highlightSegments splits text around merged ranges', () => {
    expect(
      highlightSegments('abcdef', [
        [1, 2],
        [4, 4],
      ])
    ).toEqual([
      { text: 'a', bold: false },
      { text: 'bc', bold: true },
      { text: 'd', bold: false },
      { text: 'e', bold: true },
      { text: 'f', bold: false },
    ]);
    expect(highlightSegments('abc', [])).toEqual([
      { text: 'abc', bold: false },
    ]);
  });
});

describe('command types', () => {
  test('normalizeShortcut accepts strings and objects', () => {
    expect(normalizeShortcut('mod+k')).toEqual({ keys: 'mod+k' });
    expect(normalizeShortcut({ keys: 'mod+k', platforms: ['web'] })).toEqual({
      keys: 'mod+k',
      platforms: ['web'],
    });
    expect(normalizeShortcut(undefined)).toBeUndefined();
  });

  test('commandSearchText joins title / subtitle / category / keywords lowercased', () => {
    expect(
      commandSearchText(
        cmd('a', 'New Space', { category: 'Spaces', keywords: ['Create'] })
      )
    ).toBe('new space spaces create');
  });

  test('enabled / visible defaults and function form', () => {
    expect(isCommandEnabled(cmd('a', 'A'))).toBe(true);
    expect(isCommandEnabled(cmd('a', 'A', { enabled: false }))).toBe(false);
    expect(isCommandEnabled(cmd('a', 'A', { enabled: () => false }))).toBe(
      false
    );
    expect(isCommandVisible(cmd('a', 'A'))).toBe(true);
    expect(isCommandVisible(cmd('a', 'A', { visible: false }))).toBe(false);
  });
});

describe('buildPaletteRows', () => {
  test('empty query lists Recent first, then categories sorted with a default bucket', () => {
    const { rows, selectableCount } = buildPaletteRows(COMMANDS, '', [
      'theme',
      'missing',
      'hidden',
    ]);
    expect(selectableCount).toBe(4);
    const headers = rows.filter((r) => r.kind === 'header').map((r) => r.title);
    // `theme` moved into Recent, so its default bucket has no remaining rows.
    expect(headers).toEqual([RECENT_SECTION_TITLE, 'Account', 'Spaces']);
    const ids = selectableRows(rows).map((r) => r.command.id);
    // Recent `theme` leads; hidden never appears; the rest grouped by category.
    expect(ids).toEqual(['theme', 'sign-out', 'join-space', 'new-space']);
    expect(ids).not.toContain('hidden');
  });

  test('no history means no Recent section; uncategorised commands lead under the default bucket', () => {
    const { rows } = buildPaletteRows(COMMANDS, '', []);
    expect(rows[0]).toMatchObject({ kind: 'header', title: DEFAULT_CATEGORY });
    expect(rows[1]).toMatchObject({ kind: 'item', key: 'theme' });
  });

  test('query fuzzy-filters, ranks within category, and exposes match ranges', () => {
    const { rows, selectableCount } = buildPaletteRows(COMMANDS, 'space', [
      'theme',
    ]);
    const items = selectableRows(rows);
    expect(selectableCount).toBe(2);
    expect(items.map((r) => r.command.id).sort()).toEqual([
      'join-space',
      'new-space',
    ]);
    expect(rows.filter((r) => r.kind === 'header').map((r) => r.title)).toEqual(
      ['Spaces']
    );
    expect(items[0]?.matchRanges.length).toBeGreaterThan(0);
    expect(buildPaletteRows(COMMANDS, 'zzzz', []).rows).toEqual([]);
  });

  test('keywords participate in search', () => {
    const ids = selectableRows(
      buildPaletteRows(COMMANDS, 'create', []).rows
    ).map((r) => r.command.id);
    expect(ids).toEqual(['new-space']);
  });

  test('groupPaletteRows folds rows back into sections', () => {
    const groups = groupPaletteRows(
      buildPaletteRows(COMMANDS, '', ['theme']).rows
    );
    expect(groups.map((g) => [g.title, g.commands.length])).toEqual([
      [RECENT_SECTION_TITLE, 1],
      ['Account', 1],
      ['Spaces', 2],
    ]);
  });
});

describe('palette keyboard math', () => {
  test('nextPaletteSelection wraps arrows / Tab and jumps Home / End', () => {
    const count = 3;
    const nav = (k: string, current: number, shiftKey = false) =>
      nextPaletteSelection({ key: { key: k, shiftKey }, current, count });
    expect(nav('ArrowDown', 2)).toBe(0);
    expect(nav('ArrowUp', 0)).toBe(2);
    expect(nav('Tab', 2)).toBe(0);
    expect(nav('Tab', 0, true)).toBe(2);
    expect(nav('Home', 2)).toBe(0);
    expect(nav('End', 0)).toBe(2);
    expect(nav('Enter', 0)).toBeNull();
    expect(
      nextPaletteSelection({
        key: { key: 'ArrowDown', shiftKey: false },
        current: 0,
        count: 0,
      })
    ).toBeNull();
  });

  test('clampPaletteSelection', () => {
    expect(clampPaletteSelection(5, 3)).toBe(2);
    expect(clampPaletteSelection(-2, 3)).toBe(0);
    expect(clampPaletteSelection(1, 0)).toBe(0);
  });
});

describe('shortcuts', () => {
  test('matchOpenShortcut resolves mod to the platform modifier', () => {
    const specs = ['mod+k', 'mod+shift+p'];
    expect(matchOpenShortcut(key('k', MOD), specs)).toBe(true);
    expect(matchOpenShortcut(key('p', { ...MOD, shiftKey: true }), specs)).toBe(
      true
    );
    expect(matchOpenShortcut(key('k'), specs)).toBe(false);
    expect(matchOpenShortcut(key('k', { ...MOD, repeat: true }), specs)).toBe(
      false
    );
  });

  test('findCommandForShortcut skips disabled, hidden, and non-web bindings', () => {
    const like = key('q', { ...MOD, shiftKey: true });
    expect(findCommandForShortcut(COMMANDS, like)?.id).toBe('sign-out');
    expect(
      findCommandForShortcut(
        [cmd('x', 'X', { shortcut: 'mod+shift+q', enabled: false })],
        like
      )
    ).toBeUndefined();
    expect(
      findCommandForShortcut(
        [
          cmd('x', 'X', {
            shortcut: { keys: 'mod+shift+q', platforms: ['ios'] },
          }),
        ],
        like
      )
    ).toBeUndefined();
    expect(findCommandForShortcut(COMMANDS, key('k', MOD))).toBeUndefined();
  });

  test('shortcutTokens renders human key caps', () => {
    expect(shortcutTokens('shift+k')).toEqual(['⇧', 'K']);
    expect(shortcutTokens('ctrl+escape')).toEqual(['Ctrl', 'Esc']);
    expect(shortcutTokens('')).toEqual([]);
    expect(['⌘', 'Ctrl']).toContain(formatShortcutToken('mod'));
    expect(formatShortcutToken('F5')).toBe('F5');
  });
});
