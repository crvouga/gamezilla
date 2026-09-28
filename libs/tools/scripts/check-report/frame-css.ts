// @io-wall-ok — compiles the product stylesheet for scenario UI frames.
/**
 * Stylesheet for the scenario report's iframe `srcdoc` frames
 * (`HARNESS_FRAMES=1`), matching the product mount (tokens + hosts +
 * Tailwind) plus every `pkgs/` CSS module: bun's harness Babel plugin exports
 * unhashed local class names, so the raw module CSS applies.
 */
import {
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { run } from '@pkgs/os';

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

export function compileFrameCss(repoRoot: string): string {
  const tailwindDir = join(repoRoot, 'pkgs/tailwind');
  const uiCss = [
    join(repoRoot, 'pkgs/ui/src/theme/tokens.css'),
    join(repoRoot, 'pkgs/ui/src/components/hosts.css'),
  ];
  const tmp = mkdtempSync(join(tmpdir(), 'check-report-css-'));
  try {
    const out = join(tmp, 'tailwind.css');
    run(
      'bunx',
      [
        '--no-install',
        '@tailwindcss/cli',
        '-i',
        join(tailwindDir, 'src/tailwind.css'),
        '-o',
        out,
      ],
      { cwd: tailwindDir }
    );
    const modules: string[] = [];
    for (const name of readdirSync(join(repoRoot, 'pkgs')).sort()) {
      const src = join(repoRoot, 'pkgs', name, 'src');
      if (existsSync(src)) listModuleCss(src, modules);
    }
    return [
      readFileSync(out, 'utf8'),
      ...uiCss.map((p) => readFileSync(p, 'utf8')),
      ...modules.map(
        (p) =>
          `/* ${p.slice(repoRoot.length + 1)} */\n${readFileSync(p, 'utf8')}`
      ),
    ].join('\n');
  } finally {
    rmSync(tmp, { recursive: true, force: true });
  }
}
