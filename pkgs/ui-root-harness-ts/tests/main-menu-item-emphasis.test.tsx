/** @jsxImportSource solid-js */

import { describe, expect, test } from 'bun:test';
import { MainMenuItemRow } from '@pkgs/ui-root-client-ts/main-menu-item-row';
import { screen } from '@solidjs/testing-library';
import { renderUi } from './render';

function rowBody(title: string): HTMLElement {
  const body = screen.getByText(title).closest('[data-emphasis]');
  if (!(body instanceof HTMLElement)) throw new Error(`${title} has no body`);
  return body;
}

describe('MainMenuItemRow emphasis', () => {
  test('the primary row leads with a tinted chevron, never a fill; a quiet one keeps its title ink and says less', () => {
    renderUi(() => (
      <>
        <MainMenuItemRow
          item={{
            key: 'play',
            title: 'Play with friends',
            emphasis: 'primary',
            onClick: () => undefined,
          }}
        />
        <MainMenuItemRow
          item={{
            key: 'history',
            title: 'History',
            caption: 'Review your games',
            emphasis: 'quiet',
            onClick: () => undefined,
          }}
        />
        <MainMenuItemRow
          item={{ key: 'find', title: 'Find', onClick: () => undefined }}
        />
      </>
    ));
    // regression: menu-primary-row-reads-selected
    // A fill on the main way in read as a row already chosen.
    expect(rowBody('Play with friends').className).not.toContain(
      'bg-tint-subtle'
    );
    expect(screen.getByText('Play with friends').className).not.toContain(
      'text-on-primary-soft'
    );
    expect(rowBody('Play with friends').dataset['emphasis']).toBe('primary');
    expect(rowBody('History').className).not.toContain('bg-tint-subtle');
    // regression: quiet-menu-row-reads-disabled
    // A quiet row is not a disabled one: its title keeps the ordinary ink.
    expect(screen.getByText('History').className).not.toContain(
      'text-text-secondary'
    );
    expect(rowBody('History').className).not.toContain('opacity-disabled');
    expect(screen.getByText('Review your games').className).toContain(
      'line-clamp-1'
    );
    expect(screen.getByText('Find').closest('[data-emphasis]')).toBeNull();
  });

  // regression: menu-row-tag-tiny-and-detached — the row's tag was a 10px
  // grey chip on a line of its own under the title, reading as a disabled
  // chip; the main way in's "Recommended" looked like any other fact.
  test("a row's tag follows its title at a readable size; the main way in's is in the accent", () => {
    renderUi(() => (
      <>
        <MainMenuItemRow
          item={{
            key: 'play',
            title: 'Play with friends',
            meta: 'Recommended',
            emphasis: 'primary',
            onClick: () => undefined,
          }}
        />
        <MainMenuItemRow
          item={{
            key: 'chess',
            title: 'Chess',
            meta: '2 players',
            onClick: () => undefined,
          }}
        />
      </>
    ));
    for (const [title, tag, intent] of [
      ['Play with friends', 'Recommended', 'brand'],
      ['Chess', '2 players', 'neutral'],
    ] as const) {
      const badge = screen.getByText(tag).closest('[data-component="Badge"]');
      expect(badge?.getAttribute('data-size')).toBe('md');
      expect(badge?.getAttribute('data-intent')).toBe(intent);
      expect(badge?.parentElement?.contains(screen.getByText(title))).toBe(
        true
      );
    }
  });
});
