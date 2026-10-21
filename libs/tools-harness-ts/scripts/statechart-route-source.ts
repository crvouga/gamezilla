import ts from 'typescript';

export type Location = { file: ts.SourceFile; node: ts.Node };
export type RouteSources = ReadonlyMap<string, string>;

export function fail(location: Location, message: string): never {
  const line =
    location.file.getLineAndCharacterOfPosition(
      location.node.getStart(location.file)
    ).line + 1;
  throw new Error(`${location.file.fileName}:${line}: ${message}`);
}

export function parsed(path: string, sources: RouteSources): ts.SourceFile {
  const text = sources.get(path);
  if (text === undefined) throw new Error(`Missing route source: ${path}`);
  const diagnostics =
    ts.transpileModule(text, {
      fileName: path,
      reportDiagnostics: true,
      compilerOptions: { jsx: ts.JsxEmit.Preserve },
    }).diagnostics ?? [];
  if (
    diagnostics.some((issue) => issue.category === ts.DiagnosticCategory.Error)
  )
    throw new Error(`Invalid route source syntax: ${path}`);
  return ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true);
}

export function unwrapped(node: ts.Node): ts.Node {
  if (
    ts.isAsExpression(node) ||
    ts.isSatisfiesExpression(node) ||
    ts.isParenthesizedExpression(node) ||
    ts.isNonNullExpression(node)
  )
    return unwrapped(node.expression);
  return node;
}

function modulePath(
  file: string,
  specifier: string,
  sources: RouteSources
): string {
  const segments = specifier.startsWith('@libs/')
    ? [
        'libs',
        specifier.split('/')[1]!,
        'src',
        ...specifier.split('/').slice(2),
      ]
    : [...file.split('/').slice(0, -1), ...specifier.split('/')];
  const normalized: string[] = [];
  for (const segment of segments) {
    if (segment === '..') normalized.pop();
    else if (segment !== '.') normalized.push(segment);
  }
  const base = normalized.join('/');
  const path = [base, `${base}.ts`, `${base}.tsx`].find((name) =>
    sources.has(name)
  );
  if (!path)
    throw new Error(`Missing route dependency: ${file} → ${specifier}`);
  return path;
}

export function binding(
  file: ts.SourceFile,
  name: string,
  sources: RouteSources,
  trail: string[] = []
): Location {
  const key = `${file.fileName}:${name}`;
  if (trail.includes(key)) throw new Error(`Cyclic route binding: ${key}`);
  for (const statement of file.statements) {
    if (ts.isVariableStatement(statement)) {
      for (const declaration of statement.declarationList.declarations)
        if (
          ts.isIdentifier(declaration.name) &&
          declaration.name.text === name &&
          declaration.initializer
        )
          return { file, node: declaration.initializer };
    }
    if (ts.isFunctionDeclaration(statement) && statement.name?.text === name)
      return { file, node: statement };
    if (
      !ts.isImportDeclaration(statement) ||
      !ts.isStringLiteral(statement.moduleSpecifier)
    )
      continue;
    const imports = statement.importClause?.namedBindings;
    if (!imports || !ts.isNamedImports(imports)) continue;
    const imported = imports.elements.find((entry) => entry.name.text === name);
    if (!imported) continue;
    const path = modulePath(
      file.fileName,
      statement.moduleSpecifier.text,
      sources
    );
    return binding(
      parsed(path, sources),
      imported.propertyName?.text ?? name,
      sources,
      [...trail, key]
    );
  }
  throw new Error(`${key}: Unresolved route binding`);
}

export function resolved(
  location: Location,
  sources: RouteSources,
  trail: string[] = []
): Location {
  const node = unwrapped(location.node);
  if (!ts.isIdentifier(node)) return { ...location, node };
  const key = `${location.file.fileName}:${node.text}`;
  if (trail.includes(key)) fail(location, 'Cyclic route expression');
  return resolved(
    localBinding(location, node.text) ??
      binding(location.file, node.text, sources),
    sources,
    [...trail, key]
  );
}

function localBinding(location: Location, name: string): Location | undefined {
  for (let scope = location.node.parent; scope; scope = scope.parent) {
    if (!ts.isFunctionDeclaration(scope) && !ts.isArrowFunction(scope))
      continue;
    if (!scope.body || !ts.isBlock(scope.body)) continue;
    for (const statement of scope.body.statements) {
      if (!ts.isVariableStatement(statement)) continue;
      for (const declaration of statement.declarationList.declarations)
        if (
          ts.isIdentifier(declaration.name) &&
          declaration.name.text === name &&
          declaration.initializer
        )
          return { file: location.file, node: declaration.initializer };
    }
  }
  return undefined;
}

export function parameterInScope(node: ts.Node, name: string): boolean {
  for (let scope = node.parent; scope; scope = scope.parent) {
    if (!ts.isFunctionDeclaration(scope) && !ts.isArrowFunction(scope))
      continue;
    if (
      scope.parameters.some(
        (parameter) =>
          ts.isIdentifier(parameter.name) && parameter.name.text === name
      )
    )
      return true;
  }
  return false;
}

/** Inspect a factory's single return; importing or executing product code is forbidden. */
export function factoryReturn(
  location: Location,
  sources: RouteSources
): Location {
  const value = resolved(location, sources);
  if (
    !ts.isCallExpression(value.node) ||
    !ts.isIdentifier(value.node.expression)
  )
    fail(value, 'Sub factory call must have a static declaration');
  const factory = binding(value.file, value.node.expression.text, sources);
  if (!ts.isFunctionDeclaration(factory.node) || !factory.node.body)
    fail(factory, 'Sub factory must have a static declaration');
  const returns = factory.node.body.statements.filter(ts.isReturnStatement);
  if (returns.length !== 1 || !returns[0]?.expression)
    fail(factory, 'Sub factory must return one static definition');
  return { ...factory, node: returns[0].expression };
}
