/** Reads canonical CSF metadata; no runtime explorer registry. */

import { posix } from 'node:path';
import ts from 'typescript';
import type { RegistryEntry } from './inventory-types';

export function localModule(specifier: string, file = ''): string | null {
  if (specifier.startsWith('.') && file.startsWith('pkgs/')) {
    const resolved = posix.normalize(
      posix.join(posix.dirname(file), specifier)
    );
    const match = /^pkgs\/([^/]+-client-ts)\/src\/(.+)$/.exec(resolved);
    if (match) {
      const segments = match[2]!.split('/');
      const module =
        segments.at(-1) === 'index' ? segments.at(-2)! : segments.at(-1)!;
      return match[1] === 'ui-root-client-ts'
        ? module
        : `@pkgs/${match[1]}/${module}`;
    }
  }
  const prefix = '@pkgs/ui-root-client-ts/';
  if (specifier.startsWith(prefix)) return specifier.slice(prefix.length);
  const relative = /^\.\.\/\.\.\/([^/]+-client-ts)\/src\/(.+)$/.exec(specifier);
  if (relative)
    return relative[1] === 'ui-root-client-ts'
      ? relative[2]!
      : `@pkgs/${relative[1]}/${relative[2]}`;
  return /^@pkgs\/[^/]+-client-ts\//.test(specifier) ? specifier : null;
}

export function localImports(source: ts.SourceFile): Map<string, string> {
  const out = new Map<string, string>();
  for (const statement of source.statements) {
    if (
      !ts.isImportDeclaration(statement) ||
      !ts.isStringLiteral(statement.moduleSpecifier)
    )
      continue;
    const module = localModule(statement.moduleSpecifier.text, source.fileName);
    const clause = statement.importClause;
    if (!module || !clause || clause.isTypeOnly) continue;
    const bindings = clause.namedBindings;
    if (bindings && ts.isNamedImports(bindings)) {
      for (const element of bindings.elements)
        if (!element.isTypeOnly) out.set(element.name.text, module);
    }
  }
  return out;
}

export function exampleModules(text: string): string[] {
  return [
    ...new Set(
      localImports(
        ts.createSourceFile(
          'story.tsx',
          text,
          ts.ScriptTarget.Latest,
          true,
          ts.ScriptKind.TSX
        )
      ).values()
    ),
  ].sort();
}

function titleOf(source: ts.SourceFile): string | null {
  let title: string | null = null;
  const visit = (node: ts.Node): void => {
    if (
      title === null &&
      ts.isPropertyAssignment(node) &&
      node.name.getText(source) === 'title' &&
      ts.isStringLiteral(node.initializer)
    )
      title = node.initializer.text;
    ts.forEachChild(node, visit);
  };
  visit(source);
  return title;
}

function primaryComponent(source: ts.SourceFile): string | null {
  let component: string | null = null;
  const visit = (node: ts.Node): void => {
    if (
      !component &&
      ts.isPropertyAssignment(node) &&
      node.name.getText(source) === 'component' &&
      ts.isIdentifier(node.initializer)
    )
      component = node.initializer.text;
    ts.forEachChild(node, visit);
  };
  visit(source);
  return component;
}

/** Story files, in stable path order. Imports identify the production modules. */
export function readRegistry(
  stories: readonly { name: string; text: string }[]
): RegistryEntry[] {
  return [...stories]
    .sort((a, b) => (a.name < b.name ? -1 : a.name > b.name ? 1 : 0))
    .map((story, index) => {
      const source = ts.createSourceFile(
        story.name,
        story.text,
        ts.ScriptTarget.Latest,
        true,
        ts.ScriptKind.TSX
      );
      const title = titleOf(source);
      if (!title)
        throw new Error(`${story.name}: CSF metadata needs a literal title`);
      const modules = exampleModules(story.text);
      return {
        order: index + 1,
        id: story.name.replace('.stories.tsx', ''),
        title: title.split('/').at(-1) ?? title,
        category: title.split('/').slice(0, -1).join('/'),
        exampleModule: story.name,
        modules,
        primaryModule:
          localImports(source).get(primaryComponent(source) ?? '') ?? null,
      };
    });
}
