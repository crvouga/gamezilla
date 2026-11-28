import { expect, test } from 'bun:test';
import { join } from 'node:path';
import { withDocumentPalette } from '@pkgs/ui-root-shared-ts/document-palette';
import { startupShellIssues } from '@pkgs/ui-root-shared-ts/startup-shell-check';
import { inlineDocumentFragments } from '@pkgs/vite-workspace-resolver-server-ts/inline-document-fragments';

const opening = inlineDocumentFragments(
  { 'opening.css': join(import.meta.dir, '../src/opening.css') },
  withDocumentPalette
);

// regression: startup-shell-palette-drift
test('the boot screen paints design tokens and the activity indicator', async () => {
  const html = await Bun.file(join(import.meta.dir, '..', 'index.html')).text();
  expect(
    startupShellIssues(opening.transformIndexHtml.handler(html), 'harness')
  ).toEqual([]);
});
