import { dirname, resolve } from 'node:path';
import ts from 'typescript';

/** This package exports concrete declarations only; flatten their type-only imports. */
export function publicDeclarations(entry: string): string {
  const config = ts.readConfigFile('tsconfig.tc.json', ts.sys.readFile);
  const parsed = ts.parseJsonConfigFileContent(config.config, ts.sys, '.');
  const program = ts.createProgram([entry], {
    ...parsed.options,
    noEmit: false,
    declaration: true,
    emitDeclarationOnly: true,
    incremental: false,
  });
  const diagnostics = ts.getPreEmitDiagnostics(program);
  if (diagnostics.length)
    throw new Error(
      ts.formatDiagnosticsWithColorAndContext(diagnostics, {
        getCanonicalFileName: (f) => f,
        getCurrentDirectory: ts.sys.getCurrentDirectory,
        getNewLine: () => '\n',
      })
    );
  const emitted = new Map<string, string>();
  program.emit(undefined, (path, body) => emitted.set(resolve(path), body));
  const source = program.getSourceFile(entry);
  if (!source) throw new Error('Public entrypoint is missing.');
  const selected = new Map<string, Set<string>>();
  for (const statement of source.statements) {
    if (
      !ts.isExportDeclaration(statement) ||
      !statement.moduleSpecifier ||
      !ts.isStringLiteral(statement.moduleSpecifier) ||
      !statement.exportClause ||
      !ts.isNamedExports(statement.exportClause)
    )
      throw new Error('Public declarations require explicit named exports.');
    const path = resolve(
      dirname(entry),
      `${statement.moduleSpecifier.text}.d.ts`
    );
    const names = selected.get(path) ?? new Set<string>();
    statement.exportClause.elements.forEach((element) =>
      names.add(element.name.text)
    );
    selected.set(path, names);
  }
  const printer = ts.createPrinter({ newLine: ts.NewLineKind.LineFeed });
  return [...selected]
    .map(([path, names]) => printDeclarations(path, names, emitted, printer))
    .join('\n');
}

function printDeclarations(
  path: string,
  names: ReadonlySet<string>,
  emitted: ReadonlyMap<string, string>,
  printer: ts.Printer
): string {
  const body = emitted.get(path);
  if (!body) throw new Error(`Declaration emission is missing: ${path}`);
  const source = ts.createSourceFile(path, body, ts.ScriptTarget.Latest, true);
  const statements = source.statements.filter(
    (node) =>
      'name' in node &&
      node.name &&
      ts.isIdentifier(node.name as ts.Node) &&
      names.has((node.name as ts.Identifier).text)
  );
  const transformed = ts.transform(statements, [
    (context) => {
      const visit: ts.Visitor = (node) => {
        if (ts.isImportTypeNode(node) && node.qualifier)
          return ts.factory.createTypeReferenceNode(
            node.qualifier,
            node.typeArguments
          );
        return ts.visitEachChild(node, visit, context);
      };
      return (node) => ts.visitNode(node, visit) as ts.Statement;
    },
  ]);
  try {
    return transformed.transformed
      .map((node) => printer.printNode(ts.EmitHint.Unspecified, node, source))
      .join('\n');
  } finally {
    transformed.dispose();
  }
}
