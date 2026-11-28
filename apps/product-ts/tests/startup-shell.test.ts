import { expect, test } from 'bun:test';
import { join } from 'node:path';
import { withDocumentPalette } from '@pkgs/ui-root-shared-ts/document-palette';
import { startupShellIssues } from '@pkgs/ui-root-shared-ts/startup-shell-check';
import { inlineDocumentFragments } from '@pkgs/vite-workspace-resolver-server-ts/inline-document-fragments';

const opening = inlineDocumentFragments(
  {
    'browser-opening.html': join(
      import.meta.dir,
      '../../../libs/app-root-client-ts/src/browser-opening.html'
    ),
    'browser-opening.css': join(
      import.meta.dir,
      '../../../pkgs/ui-root-client-ts/src/browser-opening.css'
    ),
  },
  withDocumentPalette
);

// regression: startup-shell-palette-drift
test('the opening document paints navigation in the product palette', async () => {
  const html = await Bun.file(join(import.meta.dir, '..', 'index.html')).text();
  expect(
    startupShellIssues(opening.transformIndexHtml.handler(html), 'product')
  ).toEqual([]);
});
