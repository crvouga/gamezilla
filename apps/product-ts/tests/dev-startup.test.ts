import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
import { COLOR_PALETTE } from '@pkgs/ui-root-shared-ts/color-palette';

const repoRoot = join(import.meta.dirname, '../../..');

function source(path: string): string {
  return readFileSync(join(repoRoot, path), 'utf8');
}

type BootTheme = {
  readonly stored: string | null;
  readonly systemDark: boolean;
  readonly pathname: string;
};

/** Runs an app's inline `index.html` theme script against a fake page. */
function bootTheme(app: string, page: BootTheme): string | undefined {
  const script = /<script>([\s\S]*?)<\/script>/.exec(
    source(`apps/${app}/index.html`)
  )?.[1];
  if (script === undefined) throw new Error(`apps/${app} has no theme script`);
  const attributes = new Map<string, string>();
  runInNewContext(script, {
    localStorage: { getItem: () => page.stored },
    matchMedia: () => ({ matches: page.systemDark }),
    document: {
      documentElement: {
        setAttribute: (name: string, value: string) =>
          attributes.set(name, value),
      },
    },
    location: { pathname: page.pathname },
  });
  return attributes.get('data-theme');
}

function storedScheme(value: string): string {
  return JSON.stringify({ 'ui.prefs/value': value });
}

describe('boot theme', () => {
  // regression: boot-theme-flash
  test('opens in the stored theme, whatever the system prefers', () => {
    for (const app of ['client-ts', 'product-ts']) {
      expect(
        bootTheme(app, {
          stored: storedScheme('light'),
          systemDark: true,
          pathname: '/',
        })
      ).toBe('light');
      expect(
        bootTheme(app, {
          stored: storedScheme('dark'),
          systemDark: false,
          pathname: '/space/1',
        })
      ).toBe('dark');
    }
  });

  test('follows the system with no usable stored theme', () => {
    for (const app of ['client-ts', 'product-ts']) {
      for (const stored of [null, storedScheme('system'), '{not json']) {
        expect(
          bootTheme(app, { stored, systemDark: false, pathname: '/' })
        ).toBe('light');
        expect(
          bootTheme(app, { stored, systemDark: true, pathname: '/' })
        ).toBe('dark');
      }
    }
  });

  test('the harness console follows the system', () => {
    expect(
      bootTheme('product-ts', {
        stored: storedScheme('dark'),
        systemDark: false,
        pathname: '/harness',
      })
    ).toBe('light');
  });

  test('reads the row the theme preference writes and paints both schemes', () => {
    const preference = source(
      'pkgs/ui-root-client-ts/src/theme-preference/index.tsx'
    );
    expect(preference).toContain("asKeyword('ui.prefs/color-scheme')");
    expect(preference).toContain("asKeyword('ui.prefs/value')");
    for (const app of ['client-ts', 'product-ts']) {
      const html = source(`apps/${app}/index.html`);
      expect(html).toContain('html[data-theme="light"]');
      expect(html).toContain('color-scheme: light');
    }
  });
});

describe('development client startup', () => {
  test('paints immediately while Vite prepares the client graph', () => {
    // regression: dev-cold-load-white-screen
    for (const app of ['client-ts', 'product-ts']) {
      const html = source(`apps/${app}/index.html`);
      expect(html).toContain('class="startup-shell"');
      expect(html).not.toContain('startup-shell-caption');
      expect(html).toContain(
        `background: var(--ui-color-background, ${COLOR_PALETTE.dark.background});`
      );
      expect(html).toContain(
        `background: var(--ui-color-background, ${COLOR_PALETTE.light.background});`
      );
      expect(html).toContain('prefers-reduced-motion: reduce');
    }
  });

  test('keeps the harness and the Lucide barrel off the app boot graph', () => {
    const main = source('apps/product-ts/src/main.tsx');
    const icons = source('pkgs/ui-root-client-ts/src/icons.ts');

    expect(main).not.toMatch(/from ['"]\.\/root-app['"]/);
    expect(main).not.toMatch(/from ['"]\.\/wall-console-env['"]/);
    expect(main).not.toMatch(/from ['"]\.\/harness-boot['"]/);
    expect(main).toContain("import('./harness-boot')");
    expect(icons).not.toMatch(/from ['"]lucide-solid['"]/);
    expect(icons).toContain("from 'lucide-solid/icons/activity'");
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
    for (const app of ['client-ts', 'product-ts']) {
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
    for (const app of ['client-ts', 'product-ts']) {
      const config = source(`apps/${app}/vite.config.mts`);
      expect(config).toContain('watch: workspaceWatchOptions()');
    }
    expect(source('apps/product-ts/vite.config.mts')).toContain(
      'hmr: false, watch: null'
    );
  });
});
