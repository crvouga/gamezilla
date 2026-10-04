// @io-wall-ok — package-owned source conformance gate, with no external I/O.
import { readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import ts from 'typescript';
import { boardSoundIssues } from './board-sound-contract';

const ROOT = resolve(import.meta.dirname, '../../chess-puzzle-client/src');
const PUBLIC_BOARD = new Set([
  '@pkgs/chess-board/chess-board',
  '@pkgs/chess-board/chess-board-types',
  '@pkgs/chess-board/chess-board-sounds',
  '@pkgs/chess-board/bench/chess-board-bench-page',
]);
const HARNESS_CORE = new Set([
  '@pkgs/chess-board-core-shared/flows',
  '@pkgs/chess-board-core-shared/probe',
]);

function permitted(path: string, typeOnly: boolean, name: string) {
  if (
    name === '@pkgs/chess-board/chess-board-types' ||
    name === '@pkgs/chess-board-core-shared/types'
  )
    return typeOnly;
  if (PUBLIC_BOARD.has(name)) return true;
  return path.startsWith('harness/') && HARNESS_CORE.has(name);
}

function boardImport(path: string, name: string) {
  if (name.startsWith('@pkgs/chess-board')) return true;
  return resolve(dirname(resolve(ROOT, path)), name)
    .replaceAll('\\', '/')
    .includes('/pkgs/chess-board');
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
      !permitted(path, imported.typeOnly, imported.name)
    )
      issues.push(`${path}: undocumented board import ${imported.name}`);
    ts.forEachChild(node, visit);
  }
  visit(file);
  return issues;
}

const paths = [...new Bun.Glob('**/*.{ts,tsx}').scanSync({ cwd: ROOT })].sort();
const issues = paths.flatMap(inspect);
if (issues.length > 0) {
  console.error(issues.join('\n'));
  process.exitCode = 1;
} else {
  console.log(
    `ok: ${paths.length} Chess sources use the public board contract`
  );
}
