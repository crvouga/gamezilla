/** @jsxImportSource solid-js */
/**
 * Mounts every registered explorer example once. This is the test that
 * catches API drift between `<name>.example.tsx` and its component.
 */

import { describe, expect, test } from 'bun:test';
import { componentRegistry } from '@pkgs/ui-root-client-ts/component-registry';
import { SurfaceStackProvider } from '@pkgs/ui-root-client-ts/surface-stack';
import { Dynamic } from 'solid-js/web';
import { renderUi } from './render';

describe('explorer examples', () => {
  for (const entry of Object.values(componentRegistry)) {
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
