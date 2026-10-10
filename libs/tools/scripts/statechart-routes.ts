import { type MachineConfig, walkStates } from '@crvouga/atlas';
import ts from 'typescript';
import type { AnalysisIssue } from './statechart-composition';

export type ProductRoute = { path: string; source: string };

export const PRODUCT_ROUTE_ROOTS = [
  'libs/app-root-client/src/route-table.ts',
  'libs/runtime-client/src/app-feature-clients.ts',
  'apps/product/src/main.tsx',
  'apps/product/src/console-nav-real.ts',
] as const;

type Location = { file: ts.SourceFile; node: ts.Node };
type RouteSources = ReadonlyMap<string, string>;

function fail(location: Location, message: string): never {
  const line =
    location.file.getLineAndCharacterOfPosition(
      location.node.getStart(location.file)
    ).line + 1;
  throw new Error(`${location.file.fileName}:${line}: ${message}`);
}

function parsed(path: string, sources: RouteSources): ts.SourceFile {
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

function unwrapped(node: ts.Node): ts.Node {
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

function binding(
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

function resolved(
  location: Location,
  sources: RouteSources,
  trail: string[] = []
): Location {
  const node = unwrapped(location.node);
  if (!ts.isIdentifier(node)) return { ...location, node };
  const key = `${location.file.fileName}:${node.text}`;
  if (trail.includes(key)) fail(location, 'Cyclic route expression');
  return resolved(binding(location.file, node.text, sources), sources, [
    ...trail,
    key,
  ]);
}

function namedProperty(
  location: Location,
  name: string
): ts.Expression | undefined {
  if (!ts.isObjectLiteralExpression(location.node))
    fail(location, 'Expected a static route object');
  let value: ts.Expression | undefined;
  for (const property of location.node.properties) {
    if (ts.isSpreadAssignment(property))
      fail(location, 'Route object spreads need explicit static declarations');
    const key = property.name;
    if (!key || (!ts.isIdentifier(key) && !ts.isStringLiteral(key)))
      fail(location, 'Computed route properties are unsupported');
    if (key.text !== name) continue;
    if (!ts.isPropertyAssignment(property) || value)
      fail(location, `Ambiguous route property: ${name}`);
    value = property.initializer;
  }
  return value;
}

function arrayEntries(location: Location, sources: RouteSources): Location[] {
  const value = resolved(location, sources);
  if (!ts.isArrayLiteralExpression(value.node))
    fail(value, 'Expected a static route composition array');
  return value.node.elements.flatMap((node) =>
    ts.isSpreadElement(node)
      ? arrayEntries({ ...value, node: node.expression }, sources)
      : [{ ...value, node }]
  );
}

function routeText(
  location: Location,
  sources: RouteSources,
  parameters: Set<string> = new Set()
): string {
  const value = resolved(location, sources);
  if (
    ts.isStringLiteral(value.node) ||
    ts.isNoSubstitutionTemplateLiteral(value.node)
  )
    return value.node.text;
  if (ts.isTemplateExpression(value.node)) {
    let text = value.node.head.text;
    for (const span of value.node.templateSpans) {
      const expression = unwrapped(span.expression);
      text +=
        ts.isIdentifier(expression) && parameters.has(expression.text)
          ? `:${expression.text}`
          : routeText({ ...value, node: expression }, sources);
      text += span.literal.text;
    }
    return text;
  }
  if (
    ts.isBinaryExpression(value.node) &&
    value.node.operatorToken.kind === ts.SyntaxKind.PlusToken
  )
    return (
      routeText({ ...value, node: value.node.left }, sources) +
      routeText({ ...value, node: value.node.right }, sources)
    );
  fail(value, 'Route path must resolve to a static pattern');
}

function featureObject(location: Location, sources: RouteSources): Location {
  const value = resolved(location, sources);
  if (
    !ts.isCallExpression(value.node) ||
    !ts.isIdentifier(value.node.expression)
  )
    fail(value, 'Unresolved feature-client composition');
  const callName = value.node.expression.text;
  const importedDefinition = value.file.statements.some((statement) => {
    if (
      !ts.isImportDeclaration(statement) ||
      !ts.isStringLiteral(statement.moduleSpecifier) ||
      statement.moduleSpecifier.text !== '@libs/feature-client/client'
    )
      return false;
    const imports = statement.importClause?.namedBindings;
    return (
      imports &&
      ts.isNamedImports(imports) &&
      imports.elements.some(
        (entry) =>
          entry.name.text === callName &&
          (entry.propertyName?.text ?? entry.name.text) ===
            'defineFeatureClient'
      )
    );
  });
  if (importedDefinition) {
    if (value.node.arguments.length !== 1)
      fail(value, 'Feature definition must have one static object');
    return resolved({ ...value, node: value.node.arguments[0]! }, sources);
  }
  const factory = binding(value.file, callName, sources);
  if (!ts.isFunctionDeclaration(factory.node) || !factory.node.body)
    fail(factory, 'Feature factory must have a static declaration');
  const returns = factory.node.body.statements.filter(ts.isReturnStatement);
  if (returns.length !== 1 || !returns[0]!.expression)
    fail(factory, 'Feature factory must return one static definition');
  return featureObject({ ...factory, node: returns[0]!.expression! }, sources);
}

function routesInArray(
  location: Location,
  sources: RouteSources
): ProductRoute[] {
  return arrayEntries(location, sources).map((entry) => {
    const value = resolved(entry, sources);
    const path = namedProperty(value, 'path');
    if (!path) fail(value, 'Route declaration is missing its path');
    return {
      path: routeText({ ...value, node: path }, sources),
      source: value.file.fileName,
    };
  });
}

function predicatePaths(location: Location, sources: RouteSources): string[] {
  if (!ts.isFunctionDeclaration(location.node) || !location.node.body)
    fail(location, 'Public surface predicate must be a static function');
  const parameter = location.node.parameters[0]?.name;
  const returns = location.node.body.statements.filter(ts.isReturnStatement);
  if (
    !parameter ||
    !ts.isIdentifier(parameter) ||
    returns.length !== 1 ||
    !returns[0]!.expression
  )
    fail(location, 'Public surface predicate must declare its path patterns');
  const choices = (expression: ts.Expression): string[] => {
    const node = unwrapped(expression);
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.BarBarToken
    )
      return [...choices(node.left), ...choices(node.right)];
    if (
      ts.isBinaryExpression(node) &&
      node.operatorToken.kind === ts.SyntaxKind.EqualsEqualsEqualsToken &&
      ts.isIdentifier(node.left) &&
      node.left.text === parameter.text
    )
      return [routeText({ ...location, node: node.right }, sources)];
    if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      ts.isIdentifier(node.expression.expression) &&
      node.expression.expression.text === parameter.text &&
      node.expression.name.text === 'startsWith' &&
      node.arguments.length === 1
    ) {
      const prefix = routeText(
        { ...location, node: node.arguments[0]! },
        sources
      );
      if (!prefix.endsWith('/'))
        fail(location, 'Public surface prefix must end at a path boundary');
      return [prefix.slice(0, -1)];
    }
    fail({ ...location, node }, 'Unresolved public surface path condition');
  };
  return [...new Set(choices(returns[0]!.expression!))];
}

function productSurfaceRoutes(sources: RouteSources): ProductRoute[] {
  const file = parsed(PRODUCT_ROUTE_ROOTS[2], sources);
  const surface = binding(file, 'surfaceAt', sources);
  if (!ts.isFunctionDeclaration(surface.node) || !surface.node.body)
    fail(surface, 'Product surface routing is missing');
  const predicates = surface.node.body.statements
    .filter(ts.isIfStatement)
    .map((statement) => {
      if (
        !ts.isCallExpression(statement.expression) ||
        !ts.isIdentifier(statement.expression.expression)
      )
        fail(
          { file, node: statement },
          'Unknown product surface route predicate'
        );
      return statement.expression.expression.text;
    });
  if (predicates.length !== 1 || !predicates.includes('isHarnessPath'))
    fail(
      surface,
      'Product surface routing changed; declare every public surface'
    );
  const harness = parsed(PRODUCT_ROUTE_ROOTS[3], sources);
  return predicatePaths(binding(file, 'isHarnessPath', sources), sources).map(
    (path) => ({ path, source: harness.fileName })
  );
}

/** Resolve declared public routes from injected TypeScript; never import the app. */
export function declaredProductRoutes(sources: RouteSources): ProductRoute[] {
  const shell = parsed(PRODUCT_ROUTE_ROOTS[0], sources);
  const composition = parsed(PRODUCT_ROUTE_ROOTS[1], sources);
  const routes = routesInArray(
    binding(shell, 'SHELL_ROUTE_TABLE', sources),
    sources
  );
  for (const entry of arrayEntries(
    binding(composition, 'APP_FEATURE_CLIENTS', sources),
    sources
  )) {
    const feature = featureObject(entry, sources);
    const contributions = namedProperty(feature, 'routes');
    if (contributions)
      routes.push(
        ...routesInArray({ ...feature, node: contributions }, sources)
      );
  }
  routes.push(
    {
      path: routeText(binding(shell, 'NOT_FOUND_ROUTE_PATH', sources), sources),
      source: shell.fileName,
    },
    ...productSurfaceRoutes(sources)
  );
  const paths = new Set<string>();
  for (const route of routes) {
    if (!route.path.startsWith('/') || /[?#\s]/.test(route.path))
      throw new Error(
        `Invalid public route pattern: ${route.source} → ${route.path}`
      );
    if (paths.has(route.path))
      throw new Error(`Duplicate public route pattern: ${route.path}`);
    paths.add(route.path);
  }
  return routes.sort((left, right) => left.path.localeCompare(right.path));
}

/** Each route needs a state owner; several outcomes may share the same screen. */
export function routeCoverageProblems(
  machine: MachineConfig,
  routes: readonly ProductRoute[]
): AnalysisIssue[] {
  const issues: AnalysisIssue[] = [];
  const declared = new Set(routes.map((route) => route.path));
  const owners = new Set<string>();
  for (const { name, node } of walkStates(machine)) {
    const metadata = node.meta ?? {};
    const single = metadata['route'];
    const multiple = metadata['routes'];
    if (single !== undefined && (typeof single !== 'string' || !single))
      issues.push({
        rule: 'route',
        message: `${name}: route must be a non-empty string`,
      });
    if (
      multiple !== undefined &&
      (!Array.isArray(multiple) ||
        !multiple.length ||
        multiple.some((path) => typeof path !== 'string' || !path))
    )
      issues.push({
        rule: 'route',
        message: `${name}: routes must contain non-empty strings`,
      });
    const paths = [
      ...(typeof single === 'string' ? [single] : []),
      ...(Array.isArray(multiple)
        ? multiple.filter((path): path is string => typeof path === 'string')
        : []),
    ];
    const unique = new Set(paths);
    if (unique.size !== paths.length)
      issues.push({
        rule: 'route',
        message: `${name}: duplicate route metadata`,
      });
    for (const path of unique) {
      if (!declared.has(path))
        issues.push({
          rule: 'route',
          message: `${name}: undeclared public route ${path}`,
        });
      else owners.add(path);
    }
  }
  for (const route of routes)
    if (!owners.has(route.path))
      issues.push({
        rule: 'route',
        message: `${route.path}: no chart state owns the public route from ${route.source}`,
      });
  return issues;
}
