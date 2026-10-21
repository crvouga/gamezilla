/**
 * Reads the explorer registry (`component-registry.ts` and its
 * `registry-entries-*.ts` modules) into entries, in display order, without
 * running it: the order, ids, titles and categories are what the source
 * literally says.
 */
import ts from 'typescript';
import type { RegistryEntry } from './inventory-types';

/** Reads a module of the component package by name (`button.example`). */
export type ReadModule = (module: string) => string | null;

/** Names a module exports (`button` → `['Button', 'ButtonProps']`). */
export type ModuleExports = (module: string) => readonly string[];

const REGISTRY = 'component-registry';
const PACKAGE_PREFIX = '@pkgs/ui-root-client-ts/';

function parse(module: string, text: string): ts.SourceFile {
  return ts.createSourceFile(`${module}.ts`, text, ts.ScriptTarget.Latest);
}

/** `./button.example` or `@pkgs/ui-root-client-ts/button` → `button.example`. */
export function localModule(specifier: string): string | null {
  if (specifier.startsWith('./')) return specifier.slice(2);
  if (specifier.startsWith(PACKAGE_PREFIX)) {
    return specifier.slice(PACKAGE_PREFIX.length);
  }
  return null;
}

/** Every local import of a file: imported binding name → module. */
export function localImports(source: ts.SourceFile): Map<string, string> {
  const out = new Map<string, string>();
  for (const statement of source.statements) {
    if (!ts.isImportDeclaration(statement)) continue;
    if (!ts.isStringLiteral(statement.moduleSpecifier)) continue;
    const module = localModule(statement.moduleSpecifier.text);
    const clause = statement.importClause;
    if (module === null || clause === undefined || clause.isTypeOnly) continue;
    if (clause.name !== undefined) out.set(clause.name.text, module);
    const bindings = clause.namedBindings;
    if (bindings !== undefined && ts.isNamedImports(bindings)) {
      for (const element of bindings.elements) {
        if (!element.isTypeOnly) out.set(element.name.text, module);
      }
    }
  }
  return out;
}

/** `const LAYOUT = 'Layout'` declarations of a file. */
function stringConstants(source: ts.SourceFile): Map<string, string> {
  const out = new Map<string, string>();
  for (const statement of source.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    for (const declaration of statement.declarationList.declarations) {
      const init = declaration.initializer;
      if (ts.isIdentifier(declaration.name) && init !== undefined) {
        if (ts.isStringLiteral(init)) out.set(declaration.name.text, init.text);
      }
    }
  }
  return out;
}

/** The registry modules in the order `ENTRIES` spreads them. */
function entryModuleOrder(read: ReadModule): string[] {
  const text = read(REGISTRY);
  if (text === null) throw new Error(`missing ${REGISTRY}.ts`);
  const source = parse(REGISTRY, text);
  const imports = localImports(source);
  const order: string[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isSpreadElement(node) && ts.isIdentifier(node.expression)) {
      const module = imports.get(node.expression.text);
      if (module !== undefined) order.push(module);
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return order;
}

type RawEntry = Omit<RegistryEntry, 'order' | 'modules' | 'primaryModule'>;

function argumentText(
  node: ts.Expression | undefined,
  constants: Map<string, string>
): string | null {
  if (node === undefined) return null;
  if (ts.isStringLiteral(node)) return node.text;
  if (ts.isIdentifier(node)) return constants.get(node.text) ?? null;
  return null;
}

/** The `entry(id, title, category, Example)` calls of one module. */
export function rawEntries(module: string, text: string): RawEntry[] {
  const source = parse(module, text);
  const constants = stringConstants(source);
  const imports = localImports(source);
  const out: RawEntry[] = [];
  const visit = (node: ts.Node): void => {
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === 'entry'
    ) {
      const [id, title, category, example] = node.arguments;
      const exampleModule =
        example !== undefined && ts.isIdentifier(example)
          ? imports.get(example.text)
          : undefined;
      const fields = [id, title, category].map((a) =>
        argumentText(a, constants)
      );
      const [idText, titleText, categoryText] = fields;
      if (
        idText == null ||
        titleText == null ||
        categoryText == null ||
        exampleModule === undefined
      ) {
        throw new Error(`${module}: unreadable entry(${node.getText(source)})`);
      }
      out.push({
        id: idText,
        title: titleText,
        category: categoryText,
        exampleModule,
      });
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return out;
}

/** Component modules an example imports (examples and helpers excluded). */
export function exampleModules(text: string): string[] {
  const modules = new Set(localImports(parse('example', text)).values());
  return [...modules].filter((m) => !m.endsWith('.example')).sort();
}

function primaryModule(
  raw: RawEntry,
  modules: readonly string[],
  exportsOf: ModuleExports
): string | null {
  if (modules.includes(raw.id) || exportsOf(raw.id).length > 0) return raw.id;
  const kebab = raw.title.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
  if (exportsOf(kebab).includes(raw.title)) return kebab;
  const byTitle = modules.find((m) => exportsOf(m).includes(raw.title));
  return byTitle ?? null;
}

/** Every registry entry, in the explorer's display order. */
export function readRegistry(
  read: ReadModule,
  exportsOf: ModuleExports
): RegistryEntry[] {
  const raws = entryModuleOrder(read).flatMap((module) => {
    const text = read(module);
    if (text === null) throw new Error(`missing ${module}.ts`);
    return rawEntries(module, text);
  });
  return raws.map((raw, index) => {
    const example = read(raw.exampleModule);
    const modules = example === null ? [] : exampleModules(example);
    return {
      ...raw,
      order: index + 1,
      modules,
      primaryModule: primaryModule(raw, modules, exportsOf),
    };
  });
}
