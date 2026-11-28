import { expect, test } from 'bun:test';
import { join } from 'node:path';
import { startupShellIssues } from '@pkgs/ui-root-shared-ts/startup-shell-check';

import { inlineHtmlFragment } from '@pkgs/vite-workspace-resolver-server-ts/inline-html-fragment';

const opening = inlineHtmlFragment(
  '<!-- browser-opening -->',
  join(
    import.meta.dir,
    '../../../libs/app-root-client-ts/src/browser-opening.html'
  )
);

// regression: startup-shell-palette-drift
test('the opening document paints navigation in the product palette', async () => {
  const html = await Bun.file(join(import.meta.dir, '..', 'index.html')).text();
  expect(
    startupShellIssues(opening.transformIndexHtml.handler(html), 'product')
  ).toEqual([]);
});
