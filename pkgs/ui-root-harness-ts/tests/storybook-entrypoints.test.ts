import { expect, test } from 'bun:test';
import {
  isStorybookSource,
  previewAnnotations,
} from '../storybook/entrypoints';

// regression: registered-storybook-preview-classified-as-production
test('registered product-shell preview may compose its Storybook fixture', () => {
  expect(isStorybookSource('apps/product-ts/src/storybook-preview.ts')).toBe(
    true
  );
  for (const path of previewAnnotations)
    expect(isStorybookSource(path)).toBe(true);
});

test('unregistered app entrypoints and preview lookalikes remain production', () => {
  for (const path of [
    'apps/product-ts/src/main.ts',
    'apps/client-ts/src/storybook-preview.ts',
    'libs/game-session-client-ts/src/storybook-preview.ts',
  ])
    expect(isStorybookSource(path)).toBe(false);
});
