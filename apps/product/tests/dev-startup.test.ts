import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const repoRoot = join(import.meta.dirname, '../../..');

function source(path: string): string {
  return readFileSync(join(repoRoot, path), 'utf8');
}

describe('development client startup', () => {
  test('paints immediately while Vite prepares the client graph', () => {
    // regression: dev-cold-load-white-screen
    for (const app of ['client', 'product']) {
      const html = source(`apps/${app}/index.html`);
      expect(html).toContain('class="startup-shell"');
      expect(html).toContain('background: #0D1C17');
      expect(html).toContain('prefers-reduced-motion: reduce');
    }
  });

  test('eagerly loads surfaces and uses individual Lucide icons', () => {
    const main = source('apps/product/src/main.tsx');
    const icons = source('pkgs/ui-root-client/src/icons.ts');

    expect(main).not.toMatch(/from ['"]\.\/root-app['"]/);
    expect(main).not.toMatch(/from ['"]\.\/wall-console-env['"]/);
    expect(main).toContain("from './harness-boot'");
    expect(icons).not.toMatch(/from ['"]lucide-solid['"]/);
    expect(icons).toContain("from 'lucide-solid/icons/activity'");
  });

  test("uses the browser Buffer package instead of Vite's Node stub", () => {
    // regression: browser-buffer-builtin-externalized
    const polyfill = source('pkgs/polyfill-shared/src/buffer.ts');

    expect(polyfill).toContain("from 'buffer/index.js'");
    expect(polyfill).not.toMatch(/from ['"]buffer['"]/);
  });

  test('prewarms the expensive first-load transforms', () => {
    for (const app of ['client', 'product']) {
      const config = source(`apps/${app}/vite.config.mts`);
      expect(config).toContain('warmup:');
      expect(config).toContain("'../../pkgs/tailwind-shared/src/tailwind.css'");
      expect(config).toContain("'../../pkgs/ui-root-client/src/hosts.css'");
    }
  });
});
