// @io-wall-ok — static source inventory adapter
import { readdirSync, readFileSync } from 'node:fs';
import { join, posix } from 'node:path';
import { slashPath } from '@pkgs/os-shared-ts/slash-path';
import ts from 'typescript';

export function source(path: string): ts.SourceFile {
  return ts.createSourceFile(
    path,
    readFileSync(path, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );
}

export function files(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true })
    .flatMap((entry) => {
      if (entry.name.startsWith('.') || entry.name === 'node_modules')
        return [];
      const path = slashPath(join(dir, entry.name));
      return entry.isDirectory() ? files(path) : [path];
    })
    .sort();
}

export function imports(
  file: ts.SourceFile
): { name: string; module: string }[] {
  return file.statements.flatMap((node) => {
    if (
      !ts.isImportDeclaration(node) ||
      !ts.isStringLiteral(node.moduleSpecifier)
    )
      return [];
    const module = node.moduleSpecifier.text;
    // Preview dependencies are forbidden in production even when erased or imported for side effects.
    if (
      /storybook|\.(stories|example)(?:\.[cm]?tsx?)?$|\/fixtures\//.test(module)
    )
      return [{ name: '*', module }];
    if (node.importClause?.isTypeOnly) return [];
    const bindings = node.importClause?.namedBindings;
    if (!node.importClause || (bindings && ts.isNamespaceImport(bindings)))
      return [{ name: '*', module }];
    const named =
      bindings && ts.isNamedImports(bindings)
        ? bindings.elements
            .filter((e) => !e.isTypeOnly)
            .map((e) => ({ name: e.propertyName?.text ?? e.name.text, module }))
        : [];
    return node.importClause?.name
      ? [{ name: 'default', module }, ...named]
      : named;
  });
}

function rendersJsx(node: ts.Node): boolean {
  if (
    ts.isJsxElement(node) ||
    ts.isJsxSelfClosingElement(node) ||
    ts.isJsxFragment(node)
  )
    return true;
  return (
    ts.forEachChild(node, (child) => {
      if (ts.isFunctionLike(child)) return false;
      return rendersJsx(child);
    }) ?? false
  );
}

export function components(file: ts.SourceFile): string[] {
  const found: string[] = [];
  for (const node of file.statements) {
    if (
      !ts.canHaveModifiers(node) ||
      !ts
        .getModifiers(node)
        ?.some((m) => m.kind === ts.SyntaxKind.ExportKeyword)
    )
      continue;
    if (
      ts.isFunctionDeclaration(node) &&
      node.name &&
      node.body &&
      /^[A-Z]/.test(node.name.text) &&
      (node.type?.getText(file).includes('JSX.Element') ||
        rendersJsx(node.body))
    )
      found.push(node.name.text);
    if (!ts.isVariableStatement(node)) continue;
    for (const declaration of node.declarationList.declarations) {
      const value = declaration.initializer;
      if (
        !ts.isIdentifier(declaration.name) ||
        !/^[A-Z]/.test(declaration.name.text) ||
        !value
      )
        continue;
      if (
        (ts.isArrowFunction(value) || ts.isFunctionExpression(value)) &&
        (value.type?.getText(file).includes('JSX.Element') ||
          rendersJsx(value.body))
      )
        found.push(declaration.name.text);
    }
  }
  return found;
}
/** The production component tiers named by the existing design-vocabulary policy. */
export function componentModule(path: string): string | null {
  if (/\.(stories|example)\.tsx$/.test(path) || path.includes('/storybook/'))
    return null;
  const match = /^pkgs\/([^/]+-client-ts)\/src\/(.+?)(?:\.[cm]?tsx?)?$/.exec(
    path
  );
  if (
    !match ||
    match[1] === 'feedback-client-ts' ||
    match[1] === 'harness-console-client-ts'
  )
    return null;
  const segments = match[2]!.split('/');
  const module =
    segments.length === 2 &&
    (segments[0] === segments[1] || segments[1] === 'index')
      ? segments[0]
      : match[2];
  return `@pkgs/${match[1]}/${module}`;
}

export function resolveComponentImport(
  path: string,
  specifier: string
): string {
  if (!specifier.startsWith('.')) return specifier;
  return (
    componentModule(
      posix.normalize(posix.join(posix.dirname(path), specifier))
    ) ?? specifier
  );
}
