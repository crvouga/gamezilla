import ts from 'typescript';

function importedTests(source: ts.SourceFile): Set<string> {
  const names = new Set<string>();
  for (const statement of source.statements) {
    if (
      !ts.isImportDeclaration(statement) ||
      !ts.isStringLiteral(statement.moduleSpecifier) ||
      statement.moduleSpecifier.text !== '@playwright/test' ||
      statement.importClause?.isTypeOnly
    )
      continue;
    const bindings = statement.importClause?.namedBindings;
    if (!bindings || !ts.isNamedImports(bindings)) continue;
    for (const binding of bindings.elements)
      if (
        !binding.isTypeOnly &&
        (binding.propertyName?.text ?? binding.name.text) === 'test'
      )
        names.add(binding.name.text);
  }
  return names;
}

/** A browser adapter's check must register its own marked, literal example. */
export function playwrightRegressionProof(
  body: string,
  marker: string
): string | null {
  const source = ts.createSourceFile(
    'regression.checks.ts',
    body,
    ts.ScriptTarget.Latest,
    true
  );
  const names = importedTests(source);
  const registered = source.statements.some((statement) => {
    if (
      !ts.isExpressionStatement(statement) ||
      !ts.isCallExpression(statement.expression)
    )
      return false;
    const call = statement.expression;
    if (
      !ts.isIdentifier(call.expression) ||
      !names.has(call.expression.text) ||
      !call.arguments[0] ||
      !ts.isStringLiteral(call.arguments[0])
    )
      return false;
    if (
      !call.arguments
        .slice(1)
        .some(
          (argument) =>
            ts.isArrowFunction(argument) || ts.isFunctionExpression(argument)
        )
    )
      return false;
    return (
      ts.getLeadingCommentRanges(body, statement.getFullStart()) ?? []
    ).some(
      (comment) =>
        body.slice(comment.pos, comment.end).trim() === `// ${marker}`
    );
  });
  return registered
    ? null
    : 'requires a marked, literal Playwright test imported from @playwright/test at module scope';
}
