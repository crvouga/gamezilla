// @io-wall-ok — inventory CLI entry root (scripts/**); reads the component sources and writes INVENTORY.md
/**
 * Writes `docs/INVENTORY.md`: what the component
 * package's code says today — registry, tokens, components, props, states,
 * ARIA, keys and literals — read by the TypeScript type checker.
 *
 *   bunx turbo run inventory --filter=@pkgs/ui-codegen-server-ts
 */
import { mkdirSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { buildInventory } from '@pkgs/ui-codegen-server-ts/inventory-build';
import { renderInventory } from '@pkgs/ui-codegen-server-ts/inventory-render';
import ts from 'typescript';

const REPO = path.resolve(import.meta.dir, '..', '..', '..');
const CLIENT = path.join(REPO, 'pkgs', 'ui-root-client-ts');
const SHARED = path.join(REPO, 'pkgs', 'ui-root-shared-ts');
const OUT = path.join(import.meta.dir, '..', 'docs', 'INVENTORY.md');

function openProgram(configFile: string): ts.Program {
  const read = ts.readConfigFile(configFile, (p) => ts.sys.readFile(p));
  if (read.error !== undefined) {
    throw new Error(
      ts.flattenDiagnosticMessageText(read.error.messageText, '\n')
    );
  }
  const parsed = ts.parseJsonConfigFileContent(
    read.config,
    ts.sys,
    path.dirname(configFile)
  );
  return ts.createProgram({
    rootNames: parsed.fileNames,
    options: { ...parsed.options, noEmit: true },
  });
}

function commit(): string {
  const run = Bun.spawnSync(['git', 'rev-parse', '--short', 'HEAD'], {
    cwd: REPO,
  });
  return run.stdout.toString().trim();
}

const read = (file: string): string | null => {
  try {
    return readFileSync(file, 'utf8');
  } catch {
    return null;
  }
};

const inventory = buildInventory(
  openProgram(path.join(CLIENT, 'tsconfig.tc.json')),
  { list: (dir) => readdirSync(dir), read },
  {
    repo: REPO,
    clientSrc: path.join(CLIENT, 'src'),
    sharedSrc: path.join(SHARED, 'src'),
    extraStylesheets: [path.join(CLIENT, 'skin.css')],
    tokenDocument: path.join(SHARED, 'src', 'design-tokens.json'),
    compiledTokens: path.join(CLIENT, 'src', 'tokens.css'),
    commit: commit(),
  }
);

mkdirSync(path.dirname(OUT), { recursive: true });
writeFileSync(OUT, renderInventory(inventory));
console.log(
  `${path.relative(REPO, OUT)}: ${inventory.registry.length} entries, ${inventory.modules.length} modules, ${inventory.tokens.length} tokens, ${inventory.literals.length} literals`
);
