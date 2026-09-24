/** @jsxImportSource solid-js */
/**
 * Mounts every registered explorer example once. This is the test that
 * catches API drift between `<name>.example.tsx` and its component.
 */

import { describe, expect, test } from 'bun:test';
import { componentRegistry, SurfaceStackProvider } from '@pkgs/ui';
import { Dynamic } from 'solid-js/web';
import { renderUi } from './support/render';

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
