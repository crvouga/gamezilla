import ts from 'typescript';

export type SourceImport = {
  readonly specifier: string;
  readonly typeOnly: boolean;
};

/** Parse module references so quotes, comments and multiline syntax cannot evade boundaries. */
export function sourceImports(text: string): readonly SourceImport[] {
  const file = ts.createSourceFile(
    'source.tsx',
    text,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX
  );
  const imports: SourceImport[] = [];
  function add(node: ts.Node | undefined, typeOnly = false): void {
    if (node !== undefined && ts.isStringLiteralLike(node))
      imports.push({ specifier: node.text, typeOnly });
  }
  function visit(node: ts.Node): void {
    if (ts.isImportDeclaration(node)) {
      const clause = node.importClause;
      const bindings = clause?.namedBindings;
      const typeOnly =
        clause?.isTypeOnly === true ||
        (clause?.name === undefined &&
          bindings !== undefined &&
          ts.isNamedImports(bindings) &&
          bindings.elements.length > 0 &&
          bindings.elements.every((binding) => binding.isTypeOnly));
      add(node.moduleSpecifier, typeOnly);
    } else if (ts.isExportDeclaration(node)) {
      add(node.moduleSpecifier, node.isTypeOnly);
    } else if (
      ts.isCallExpression(node) &&
      (node.expression.kind === ts.SyntaxKind.ImportKeyword ||
        (ts.isIdentifier(node.expression) &&
          node.expression.text === 'require'))
    ) {
      add(node.arguments[0]);
    } else if (
      ts.isImportEqualsDeclaration(node) &&
      ts.isExternalModuleReference(node.moduleReference)
    ) {
      add(node.moduleReference.expression, node.isTypeOnly);
    } else if (
      ts.isImportTypeNode(node) &&
      ts.isLiteralTypeNode(node.argument)
    ) {
      add(node.argument.literal, true);
    }
    ts.forEachChild(node, visit);
  }
  visit(file);
  return imports;
}
