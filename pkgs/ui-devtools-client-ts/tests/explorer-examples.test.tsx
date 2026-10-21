/** @jsxImportSource solid-js */
/**
 * Mounts every devtools explorer example once — catches API drift between
 * `<name>.example.tsx` and its component.
 */

import { describe, expect, test } from 'bun:test';
import { UI_DEVTOOLS_EXPLORER_ENTRIES } from '@pkgs/ui-devtools-client-ts/explorer-entries';
import { SurfaceStackProvider } from '@pkgs/ui-root-client-ts/surface-stack';
import { Dynamic } from 'solid-js/web';
import { renderUi } from './render';

describe('devtools explorer examples', () => {
  for (const entry of UI_DEVTOOLS_EXPLORER_ENTRIES) {
    test(`${entry.id} mounts without throwing`, () => {
      const { unmount } = renderUi(() => (
        <SurfaceStackProvider>
          <Dynamic component={entry.Example} />
        </SurfaceStackProvider>
      ));
      expect(
        document.querySelector('[data-component="ExampleRoot"]'),
        entry.id
      ).not.toBeNull();
      unmount();
    });
  }
});
