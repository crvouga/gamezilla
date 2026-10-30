import ts from 'typescript';
import { imports, source } from './storybook-source';

function object(
  node: ts.Expression | undefined
): ts.ObjectLiteralExpression | undefined {
  if (!node) return undefined;
  if (ts.isObjectLiteralExpression(node)) return node;
  if (
    ts.isSatisfiesExpression(node) ||
    ts.isAsExpression(node) ||
    ts.isParenthesizedExpression(node)
  )
    return object(node.expression);
  return undefined;
}

/** CSF metadata must name the actual imported production component. */
export function storyContract(path: string): {
  component: { name: string; module: string } | undefined;
  exports: string[];
} {
  const ast = source(path);
  const defaultExport = ast.statements.find(ts.isExportAssignment);
  let expression = defaultExport?.expression;
  if (expression && ts.isIdentifier(expression)) {
    const name = expression.text;
    expression = ast.statements
      .filter(ts.isVariableStatement)
      .flatMap((node) => [...node.declarationList.declarations])
      .find(
        (node) => ts.isIdentifier(node.name) && node.name.text === name
      )?.initializer;
  }
  const component = object(expression)?.properties.find(
    (node) =>
      ts.isPropertyAssignment(node) && node.name.getText(ast) === 'component'
  );
  const binding =
    component && ts.isPropertyAssignment(component)
      ? component.initializer.getText(ast)
      : undefined;
  const declarations = ast.statements.filter(ts.isImportDeclaration);
  let production: { name: string; module: string } | undefined;
  for (const declaration of declarations) {
    const bindings = declaration.importClause?.namedBindings;
    if (!bindings || !ts.isNamedImports(bindings)) continue;
    const item = bindings.elements.find((entry) => entry.name.text === binding);
    if (!item || !ts.isStringLiteral(declaration.moduleSpecifier)) continue;
    const module = declaration.moduleSpecifier.text;
    production = imports(ast).find(
      (entry) =>
        entry.module === module &&
        entry.name === (item.propertyName?.text ?? item.name.text)
    );
  }
  const exports = ast.statements
    .filter(ts.isVariableStatement)
    .filter((node) =>
      node.modifiers?.some(
        (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword
      )
    )
    .flatMap((node) =>
      node.declarationList.declarations.map((declaration) =>
        declaration.name.getText(ast)
      )
    );
  return { component: production, exports };
}
