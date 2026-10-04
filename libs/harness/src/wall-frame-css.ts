// @io-wall-ok — local report asset compiler used by artifact production, never a gate leaf.
import {
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { compileCssModule } from '@pkgs/bun-test-solid-client/css-module';
import { run } from '@pkgs/os-server/command';

function uiCss(repoRoot: string): readonly string[] {
  return [
    join(repoRoot, 'pkgs/ui-client/src/tokens.css'),
    join(repoRoot, 'pkgs/ui-client/skin.css'),
    join(repoRoot, 'pkgs/ui-client/src/hosts.css'),
  ];
}

function listModuleCss(dir: string, out: string[]): void {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== 'node_modules') listModuleCss(path, out);
    } else if (entry.name.endsWith('.module.css')) {
      out.push(path);
    }
  }
}

/**
 * Stylesheet the phone snapshots share: Tailwind, tokens, skin, hosts, and
 * every `pkgs/` CSS module, compiled with the DOM preload's isolated names.
 * `hosts.css` `@import`s skin,
 * which a sheet concatenated after Tailwind drops, so skin is inlined above.
 */
export function compileFrameCss(repoRoot: string): string {
  const tmp = mkdtempSync(join(tmpdir(), 'harness-report-css-'));
  try {
    const out = join(tmp, 'tailwind.css');
    run(
      'bunx',
      [
        '--no-install',
        '@tailwindcss/cli',
        '-i',
        join(repoRoot, 'pkgs/tailwind-shared/src/tailwind.css'),
        '-o',
        out,
      ],
      { cwd: join(repoRoot, 'pkgs/tailwind-harness') }
    );
    const modules: string[] = [];
    for (const name of readdirSync(join(repoRoot, 'pkgs')).sort()) {
      const src = join(repoRoot, 'pkgs', name, 'src');
      if (existsSync(src)) listModuleCss(src, modules);
    }
    return [
      readFileSync(out, 'utf8'),
      // `hosts.css` `@import`s skin. A sheet concatenated after Tailwind
      // drops `@import`, so skin is inlined and those lines are removed.
      ...uiCss(repoRoot).map((p) =>
        readFileSync(p, 'utf8').replace(/@import\s+[^;]+;/g, '')
      ),
      ...modules.map(
        (p) =>
          `/* ${p.slice(repoRoot.length + 1)} */\n${compileCssModule(p, readFileSync(p, 'utf8')).css}`
      ),
    ].join('\n');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}
