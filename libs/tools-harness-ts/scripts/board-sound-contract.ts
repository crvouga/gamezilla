import ts from 'typescript';

function importedNames(file: ts.SourceFile, source: string, exported: string) {
  const names = new Set<string>();
  for (const statement of file.statements) {
    if (
      !ts.isImportDeclaration(statement) ||
      !ts.isStringLiteral(statement.moduleSpecifier) ||
      statement.moduleSpecifier.text !== source
    )
      continue;
    const bindings = statement.importClause?.namedBindings;
    if (bindings !== undefined && ts.isNamespaceImport(bindings)) {
      names.add(`${bindings.name.text}.${exported}`);
      continue;
    }
    if (bindings === undefined || !ts.isNamedImports(bindings)) continue;
    for (const binding of bindings.elements)
      if ((binding.propertyName?.text ?? binding.name.text) === exported)
        names.add(binding.name.text);
  }
  return names;
}

function preferenceNames(file: ts.SourceFile) {
  const factories = importedNames(
    file,
    '@pkgs/sounds-client-ts/solid',
    'useSoundsPreference'
  );
  const names = new Set<string>();
  function visit(node: ts.Node) {
    if (
      ts.isVariableDeclaration(node) &&
      ts.isIdentifier(node.name) &&
      node.initializer !== undefined &&
      ts.isCallExpression(node.initializer) &&
      factories.has(node.initializer.expression.getText(file))
    )
      names.add(node.name.text);
    ts.forEachChild(node, visit);
  }
  visit(file);
  return names;
}

function chosenSound(
  node: ts.Expression | undefined,
  preferences: Set<string>
) {
  if (node === undefined) return false;
  if (node.kind === ts.SyntaxKind.FalseKeyword) return true;
  if (
    !ts.isPrefixUnaryExpression(node) ||
    node.operator !== ts.SyntaxKind.ExclamationToken
  )
    return false;
  const call = node.operand;
  return (
    ts.isCallExpression(call) &&
    call.arguments.length === 0 &&
    ts.isPropertyAccessExpression(call.expression) &&
    call.expression.name.text === 'muted' &&
    ts.isIdentifier(call.expression.expression) &&
    preferences.has(call.expression.expression.text)
  );
}

export function boardSoundIssues(file: ts.SourceFile, path: string) {
  const boards = importedNames(
    file,
    '@pkgs/chess-board-root-client-ts/chess-board',
    'ChessBoard'
  );
  const helpers = importedNames(
    file,
    '@pkgs/chess-board-root-client-ts/chess-board-sounds',
    'createChessBoardSounds'
  );
  const preferences = preferenceNames(file);
  const issues: string[] = [];
  function visit(node: ts.Node) {
    if (
      (ts.isJsxOpeningElement(node) || ts.isJsxSelfClosingElement(node)) &&
      boards.has(node.tagName.getText(file))
    ) {
      const attributes = node.attributes.properties;
      const index = attributes.findIndex(
        (a) => ts.isJsxAttribute(a) && a.name.getText(file) === 'sound'
      );
      const attribute = attributes[index];
      const sound =
        attribute !== undefined &&
        ts.isJsxAttribute(attribute) &&
        attribute.initializer !== undefined &&
        ts.isJsxExpression(attribute.initializer)
          ? attribute.initializer.expression
          : undefined;
      if (
        !chosenSound(sound, preferences) ||
        attributes.slice(index + 1).some(ts.isJsxSpreadAttribute)
      )
        issues.push(
          `${path}: ChessBoard must explicitly follow app sounds or be silent`
        );
    }
    if (
      ts.isCallExpression(node) &&
      helpers.has(node.expression.getText(file))
    ) {
      const accessor = node.arguments[0];
      if (
        accessor === undefined ||
        !ts.isArrowFunction(accessor) ||
        ts.isBlock(accessor.body) ||
        !chosenSound(accessor.body, preferences)
      )
        issues.push(
          `${path}: board sound helper must follow app sounds or be silent`
        );
    }
    ts.forEachChild(node, visit);
  }
  visit(file);
  return issues;
}
