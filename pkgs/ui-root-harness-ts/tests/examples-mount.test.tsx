/** @jsxImportSource solid-js */
/**
 * Mounts every Storybook example once. This is the test that
 * catches API drift between `<name>.example.tsx` and its component.
 */

import { describe, expect, test } from 'bun:test';
import { readdirSync } from 'node:fs';
import { slashPath } from '@pkgs/os-shared-ts/slash-path';

const sourceRoot = new URL('../../ui-root-client-ts/src/', import.meta.url);
const fixtures = readdirSync(sourceRoot, { recursive: true })
  .map((file) => slashPath(String(file)))
  .filter((name) => name.endsWith('.example.tsx'))
  .sort();

import { SurfaceStackProvider } from '@pkgs/ui-root-client-ts/surface-stack';
import type { Component } from 'solid-js';
import { Dynamic } from 'solid-js/web';
import { renderUi } from './render';

describe('Storybook fixtures', () => {
  for (const file of fixtures) {
    test(`${file} mounts without throwing`, async () => {
      const { default: Example } = (await import(
        new URL(file, sourceRoot).href
      )) as { default: Component };
      const { unmount } = renderUi(() => (
        <SurfaceStackProvider>
          <Dynamic component={Example} />
        </SurfaceStackProvider>
      ));
      expect(
        document.querySelector('[data-component="ExampleRoot"]'),
        file
      ).not.toBeNull();
      unmount();
    });
  }
});
