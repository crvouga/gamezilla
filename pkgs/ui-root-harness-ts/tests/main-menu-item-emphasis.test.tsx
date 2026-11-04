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
  test('the primary row wears the soft accent fill; a quiet one keeps its title ink and says less', () => {
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
    expect(rowBody('Play with friends').className).toContain('bg-tint-subtle');
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
});
