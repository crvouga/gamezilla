// @io-wall-ok — package-owned source conformance gate, with no external I/O.
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { slashPath } from '@pkgs/os-shared-ts/slash-path';
import ts from 'typescript';
import { boardSoundIssues } from './board-sound-contract';

const ROOT = resolve(process.cwd(), 'src');
const PUBLIC_BOARD = new Set([
  '@pkgs/chess-board-root-client-ts/chess-board',
  '@pkgs/chess-board-root-shared-ts/chess-board-types',
  '@pkgs/chess-board-root-client-ts/chess-board-sounds',
]);
function permitted(typeOnly: boolean, name: string) {
  if (
    name === '@pkgs/chess-board-root-shared-ts/chess-board-types' ||
    name === '@pkgs/chess-board-core-shared-ts/types'
  )
    return typeOnly;
  return PUBLIC_BOARD.has(name);
}

function boardImport(path: string, name: string) {
  if (name.startsWith('@pkgs/chess-board')) return true;
  return slashPath(resolve(dirname(resolve(ROOT, path)), name)).includes(
    '/pkgs/chess-board'
  );
}

function importedModule(node: ts.Node) {
  if (
    ts.isImportTypeNode(node) &&
    ts.isLiteralTypeNode(node.argument) &&
    ts.isStringLiteral(node.argument.literal)
  )
    return { name: node.argument.literal.text, typeOnly: true };
  if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier))
    return {
      name: node.moduleSpecifier.text,
      typeOnly: node.importClause?.isTypeOnly === true,
    };
  if (
    ts.isExportDeclaration(node) &&
    node.moduleSpecifier !== undefined &&
    ts.isStringLiteral(node.moduleSpecifier)
  )
    return { name: node.moduleSpecifier.text, typeOnly: node.isTypeOnly };
  if (
    ts.isCallExpression(node) &&
    node.expression.kind === ts.SyntaxKind.ImportKeyword
  ) {
    const argument = node.arguments[0];
    if (argument !== undefined && ts.isStringLiteral(argument))
      return { name: argument.text, typeOnly: false };
  }
  return undefined;
}

function inspect(path: string) {
  const file = ts.createSourceFile(
    path,
    readFileSync(resolve(ROOT, path), 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );
  const issues = boardSoundIssues(file, path);
  function visit(node: ts.Node): void {
    const imported = importedModule(node);
    if (
      imported !== undefined &&
      boardImport(path, imported.name) &&
      !permitted(imported.typeOnly, imported.name)
    )
      issues.push(`${path}: undocumented board import ${imported.name}`);
    ts.forEachChild(node, visit);
  }
  visit(file);
  return issues;
}

const paths = Array.from(
  new Bun.Glob('**/*.{ts,tsx}').scanSync({ cwd: ROOT }),
  slashPath
).sort();
const issues = paths.flatMap(inspect);
if (issues.length > 0) {
  console.error(issues.join('\n'));
  process.exitCode = 1;
} else {
  console.log(
    `ok: ${paths.length} Chess sources use the public board contract`
  );
}
