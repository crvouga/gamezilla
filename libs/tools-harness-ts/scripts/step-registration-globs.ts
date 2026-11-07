import ts from 'typescript';

/** Literal sibling discovery used by registration entries, without executing them. */
export function stepRegistrationGlobs(source: string): readonly string[] {
  const file = ts.createSourceFile(
    'entry.ts',
    source,
    ts.ScriptTarget.Latest,
    true
  );
  const globs: string[] = [];
  function visit(node: ts.Node): void {
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression)
    ) {
      const scan = node.expression;
      const constructor = scan.expression;
      if (
        scan.name.text === 'scanSync' &&
        node.arguments.length === 1 &&
        node.arguments[0]?.getText(file) === 'import.meta.dir' &&
        ts.isNewExpression(constructor) &&
        constructor.expression.getText(file) === 'Bun.Glob'
      ) {
        const pattern = constructor.arguments?.[0];
        if (pattern !== undefined && ts.isStringLiteral(pattern))
          globs.push(pattern.text);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(file);
  return globs;
}
