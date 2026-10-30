/**
 * Assembles the inventory of a component package from its sources: the
 * registry, every component module, the token document, the compiled
 * custom properties and every literal. File access is injected; the type
 * checker is opened by the caller over the package's own `tsconfig`.
 */
import { lastSegment, slashPath } from '@pkgs/os-shared-ts/slash-path';
import type ts from 'typescript';
import { readComponents } from './inventory-components';
import { type SourceLanguage, scanLiterals } from './inventory-literals';
import { readKeys, readMarkup } from './inventory-markup';
import { readRegistry } from './inventory-registry';
import { readCssRules } from './inventory-styles';
import { flattenTokens, readCssVars } from './inventory-tokens';
import type {
  CssRuleFact,
  Inventory,
  LiteralFact,
  ModuleFact,
} from './inventory-types';

export type InventoryFiles = {
  /** File names (not paths) directly inside `dir`. */
  readonly list: (dir: string) => readonly string[];
  readonly read: (path: string) => string | null;
};

export type InventorySources = {
  readonly repo: string;
  /** The component package's `src/`. */
  readonly clientSrc: string;
  readonly storySources: readonly string[];
  /** The logic package's `src/` (keyboard maps, token readers). */
  readonly sharedSrc: string;
  /** Extra stylesheets outside `src/` (`skin.css`). */
  readonly extraStylesheets: readonly string[];
  readonly tokenDocument: string;
  readonly compiledTokens: string;
  readonly commit: string;
};

/** Generated files and data the literal scan must not read as source. */
const NOT_SOURCE = new Set([
  'tokens.css',
  'token-names.ts',
  'design-tokens.json',
]);

function isComponentModule(name: string): boolean {
  return (
    /\.tsx?$/.test(name) &&
    !name.endsWith('.d.ts') &&
    !name.includes('.example.') &&
    !name.includes('.stories.') &&
    !NOT_SOURCE.has(name)
  );
}

const stem = (name: string): string => name.replace(/\.(tsx?|css)$/, '');
/** `path` under `repo`, `/`-separated whichever OS built either. */
const relative = (repo: string, path: string): string => {
  const [root, file] = [slashPath(repo), slashPath(path)];
  return file.startsWith(`${root}/`) ? file.slice(root.length + 1) : file;
};

function moduleFact(
  program: ts.Program,
  path: string,
  sources: InventorySources
): ModuleFact | null {
  const file = program.getSourceFile(path);
  if (file === undefined) return null;
  const markup = readMarkup(file);
  const components = readComponents(program, file, {
    ownRoots: ['/pkgs/ui-root-'],
    defaults: markup.defaults,
  });
  if (components.length === 0 && markup.dataComponents.length === 0) {
    return null;
  }
  const sharedKeys = new Set<string>();
  for (const shared of markup.sharedModules) {
    const sharedFile = program.getSourceFile(
      `${sources.sharedSrc}/${shared}.ts`
    );
    if (sharedFile !== undefined) {
      for (const key of readKeys(sharedFile)) sharedKeys.add(key);
    }
  }
  return {
    module:
      stem(lastSegment(path)) === 'index'
        ? path.split('/').at(-2)!
        : stem(lastSegment(path)),
    file: relative(sources.repo, path),
    components,
    markup,
    sharedKeys: [...sharedKeys].sort(),
  };
}

function literalFiles(
  files: InventoryFiles,
  sources: InventorySources
): { path: string; language: SourceLanguage }[] {
  const inDir = (dir: string) =>
    files
      .list(dir)
      .filter((name) => !NOT_SOURCE.has(name) && !name.includes('.example.'))
      .filter((name) => /\.(css|tsx?)$/.test(name) && !name.endsWith('.d.ts'))
      .map((name) => `${dir}/${name}`);
  const paths = [
    ...inDir(sources.clientSrc),
    ...sources.extraStylesheets,
    ...inDir(sources.sharedSrc),
  ];
  return paths.map((path) => ({
    path,
    language: path.endsWith('.css') ? 'css' : 'ts',
  }));
}

function literals(
  files: InventoryFiles,
  sources: InventorySources
): LiteralFact[] {
  return literalFiles(files, sources).flatMap(({ path, language }) => {
    const text = files.read(path);
    if (text === null) return [];
    return scanLiterals(relative(sources.repo, path), text, language);
  });
}

function styles(
  files: InventoryFiles,
  sources: InventorySources
): CssRuleFact[] {
  return literalFiles(files, sources)
    .filter(({ language }) => language === 'css')
    .flatMap(({ path }) => {
      const text = files.read(path);
      return text === null
        ? []
        : readCssRules(relative(sources.repo, path), text);
    });
}

function readJson(files: InventoryFiles, path: string): unknown {
  const text = files.read(path);
  if (text === null) throw new Error(`missing ${path}`);
  return JSON.parse(text);
}

/** The whole inventory. */
export function buildInventory(
  program: ts.Program,
  files: InventoryFiles,
  sources: InventorySources
): Inventory {
  const registry = readRegistry(
    sources.storySources.flatMap((directory) =>
      files
        .list(directory)
        .filter((name) => name.endsWith('.stories.tsx'))
        .map((name) => ({
          name: relative(sources.repo, `${directory}/${name}`),
          text: files.read(`${directory}/${name}`) ?? '',
        }))
    )
  );
  const modules = files
    .list(sources.clientSrc)
    .filter(isComponentModule)
    .sort()
    .flatMap((name) => {
      const fact = moduleFact(program, `${sources.clientSrc}/${name}`, sources);
      return fact === null ? [] : [fact];
    });
  const compiled = files.read(sources.compiledTokens) ?? '';
  return {
    commit: sources.commit,
    registry,
    modules,
    tokens: flattenTokens(readJson(files, sources.tokenDocument)),
    cssVars: readCssVars(compiled),
    literals: literals(files, sources),
    styles: styles(files, sources),
  };
}
