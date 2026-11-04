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
  test('the primary row wears the soft accent fill; a quiet one steps its title down', () => {
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
    expect(screen.getByText('History').className).toContain(
      'text-text-secondary'
    );
    expect(screen.getByText('Find').closest('[data-emphasis]')).toBeNull();
  });
});
