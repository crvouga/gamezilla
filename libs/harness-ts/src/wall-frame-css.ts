// @io-wall-ok — local report asset compiler used by artifact production, never a gate leaf.
import { createHash } from 'node:crypto';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, relative } from 'node:path';
import { compileCssModule } from '@pkgs/bun-test-solid-client-ts/css-module';
import { removeTree } from '@pkgs/fs-server-ts/remove-tree';
import { run } from '@pkgs/os-server-ts/command';
import { slashPath } from '@pkgs/os-shared-ts/slash-path';

/** The package that declares the Tailwind CLI, so the install links it there. */
const TAILWIND_PACKAGE = 'pkgs/tailwind-harness-ts';

/**
 * The Tailwind CLI script `@pkgs/tailwind-harness-ts` declares, read from the
 * installed package's `bin`, for this Bun to run. The repo root links no
 * Tailwind bin (the isolated linker links one only into the packages that
 * declare it), and the `.bin` shim's name differs by OS (`tailwindcss` on
 * POSIX, `tailwindcss.exe` / `.bunx` on Windows), so neither is relied on.
 */
export function tailwindCli(repoRoot: string): string {
  const pkg = join(repoRoot, TAILWIND_PACKAGE, 'node_modules/@tailwindcss/cli');
  const manifest = JSON.parse(
    readFileSync(join(pkg, 'package.json'), 'utf8')
  ) as { readonly bin?: Readonly<Record<string, string>> };
  const bin = manifest.bin?.['tailwindcss'];
  if (bin === undefined)
    throw new Error('@tailwindcss/cli declares no `tailwindcss` bin');
  return join(pkg, bin);
}

function uiCss(repoRoot: string): readonly string[] {
  return [
    join(repoRoot, 'pkgs/ui-root-client-ts/src/tokens.css'),
    join(repoRoot, 'pkgs/ui-root-client-ts/skin.css'),
    join(repoRoot, 'pkgs/ui-root-client-ts/src/hosts.css'),
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
 *
 * The bytes are a function of those files. A content-addressed cache skips
 * the Tailwind CLI on every later report collect in this checkout.
 */
export function compileFrameCss(repoRoot: string): string {
  const inputs = frameCssInputs(repoRoot);
  const cache = join(
    repoRoot,
    '.cache',
    'frame-css',
    `${hashInputs(inputs)}.css`
  );
  if (existsSync(cache)) return readFileSync(cache, 'utf8');
  const css = compileFrameCssUncached(repoRoot, inputs);
  mkdirSync(dirname(cache), { recursive: true });
  writeFileSync(cache, css);
  return css;
}

function frameCssInputs(repoRoot: string): readonly string[] {
  const modules: string[] = [];
  for (const name of readdirSync(join(repoRoot, 'pkgs')).sort()) {
    const src = join(repoRoot, 'pkgs', name, 'src');
    if (existsSync(src)) listModuleCss(src, modules);
  }
  return [
    join(repoRoot, 'pkgs/tailwind-shared-ts/src/tailwind.css'),
    ...uiCss(repoRoot),
    ...modules.sort(),
  ];
}

function hashInputs(paths: readonly string[]): string {
  const hash = createHash('sha256');
  for (const path of paths) {
    hash.update(path);
    hash.update('\0');
    hash.update(readFileSync(path));
    hash.update('\0');
  }
  return hash.digest('hex');
}

function compileFrameCssUncached(
  repoRoot: string,
  inputs: readonly string[]
): string {
  const tmp = mkdtempSync(join(tmpdir(), 'harness-report-css-'));
  try {
    const out = join(tmp, 'tailwind.css');
    run(
      process.execPath,
      [
        tailwindCli(repoRoot),
        '-i',
        join(repoRoot, 'pkgs/tailwind-shared-ts/src/tailwind.css'),
        '-o',
        out,
      ],
      { cwd: join(repoRoot, TAILWIND_PACKAGE) }
    );
    const modules = inputs.filter((path) => path.endsWith('.module.css'));
    return [
      readFileSync(out, 'utf8'),
      // `hosts.css` `@import`s skin. A sheet concatenated after Tailwind
      // drops `@import`, so skin is inlined and those lines are removed.
      ...uiCss(repoRoot).map((p) =>
        readFileSync(p, 'utf8').replace(/@import\s+[^;]+;/g, '')
      ),
      ...modules.map(
        (p) =>
          `/* ${slashPath(relative(repoRoot, p))} */\n${compileCssModule(p, readFileSync(p, 'utf8')).css}`
      ),
    ].join('\n');
  } finally {
    removeTree(tmp, { whenLocked: 'leave' });
  }
}
