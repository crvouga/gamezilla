import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { COLOR_PALETTE } from '@pkgs/ui-root-shared-ts/color-palette';
import { withDocumentPalette } from '@pkgs/ui-root-shared-ts/document-palette';

const repoRoot = join(import.meta.dirname, '../../..');

function source(path: string): string {
  return readFileSync(join(repoRoot, path), 'utf8');
}

describe('development client startup', () => {
  // regression: boot-theme-flash
  test('declares the dark appearance before startup independently of stored and OS preferences', () => {
    for (const app of ['product-client-ts', 'product-ts', 'harness-ts']) {
      const html = source(`apps/${app}/index.html`);
      expect(html).toContain('<meta name="color-scheme" content="dark"');
      expect(html).not.toMatch(/prefers-color-scheme|ui\.prefs\/color-scheme/);
    }
  });
  test('paints immediately while Vite prepares the client graph', () => {
    // regression: dev-cold-load-white-screen
    for (const app of ['product-client-ts', 'product-ts']) {
      const html = source(`apps/${app}/index.html`).replace(
        '/* include browser-opening.css */',
        withDocumentPalette(
          source('pkgs/ui-root-client-ts/src/browser-opening.css')
        )
      );
      expect(html).toContain('<!-- include browser-opening.html -->');
      expect(html).not.toContain('startup-shell-caption');
      expect(html).toContain(
        `--ui-color-background:${COLOR_PALETTE.background}`
      );
      expect(html).not.toContain('animation:');
    }
  });

  test('keeps the harness and the Lucide barrel off the app boot graph', () => {
    const main = source('apps/product-ts/src/main.tsx');
    const icons = source('pkgs/ui-root-client-ts/src/icons.ts');

    expect(main).not.toMatch(/['"][^'"\n]*harness[^'"\n]*['"]/);
    expect(icons).not.toMatch(/from ['"]lucide['"]/);
  });

  test('keeps all-dialect and incubating barrels off the boot path', () => {
    const classify = source('pkgs/sync-engine-shared-ts/src/classify.ts');
    const attributes = source(
      'pkgs/observability-root-shared-ts/src/attributes.ts'
    );

    expect(classify).toContain("from 'node-sql-parser/build/postgresql'");
    expect(classify).not.toMatch(/from ['"]node-sql-parser['"]/);
    expect(attributes).not.toContain('semantic-conventions/incubating');
  });

  test("uses the browser Buffer package instead of Vite's Node stub", () => {
    // regression: browser-buffer-builtin-externalized
    const polyfill = source('pkgs/polyfill-shared-ts/src/buffer.ts');

    expect(polyfill).toContain("from 'buffer/index.js'");
    expect(polyfill).not.toMatch(/from ['"]buffer['"]/);
  });

  test('prewarms the expensive first-load transforms', () => {
    for (const app of ['product-client-ts', 'product-ts']) {
      const config = source(`apps/${app}/vite.config.mts`);
      expect(config).toContain('warmup:');
      expect(config).toContain(
        "'../../pkgs/tailwind-shared-ts/src/tailwind.css'"
      );
      expect(config).toContain("'../../pkgs/ui-root-client-ts/src/hosts.css'");
    }
  });

  // regression: dev-fsevents-starves-client
  test('both web hosts use the workspace watcher policy', () => {
    for (const app of ['product-client-ts', 'product-ts']) {
      const config = source(`apps/${app}/vite.config.mts`);
      expect(config).toContain('watch: workspaceWatchOptions()');
    }
    expect(source('apps/product-ts/vite.config.mts')).toContain(
      'hmr: false, watch: null'
    );
  });
});
