import { type MachineConfig, walkStates } from '@crvouga/atlas';
import ts from 'typescript';
import type { AnalysisIssue } from './statechart-composition';
import {
  binding,
  factoryReturn,
  fail,
  type Location,
  parameterInScope,
  parsed,
  type RouteSources,
  resolved,
  unwrapped,
} from './statechart-route-source';

export type ProductRoute = { path: string; source: string };

export const PRODUCT_ROUTE_ROOTS = [
  'libs/app-root-client-ts/src/route-table.ts',
  'libs/runtime-client-ts/src/app-sub-clients.ts',
  'apps/product-ts/src/main.tsx',
  'apps/product-ts/src/console-nav-real.ts',
] as const;

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
    if (value) fail(location, `Ambiguous route property: ${name}`);
    if (ts.isPropertyAssignment(property)) value = property.initializer;
    else if (
      ts.isShorthandPropertyAssignment(property) &&
      !property.objectAssignmentInitializer
    )
      value = property.name;
    else fail(location, `Ambiguous route property: ${name}`);
  }
  return value;
}

function arrayEntries(
  location: Location,
  sources: RouteSources,
  trail: readonly string[] = []
): Location[] {
  const value = resolved(location, sources);
  if (ts.isConditionalExpression(value.node))
    return [value.node.whenTrue, value.node.whenFalse].flatMap((node) =>
      arrayEntries({ ...value, node }, sources, trail)
    );
  if (ts.isCallExpression(value.node)) {
    const key = `${value.file.fileName}:${value.node.getStart(value.file)}`;
    if (trail.includes(key)) fail(value, 'Cyclic route factory');
    const next = [...trail, key];
    if (ts.isPropertyAccessExpression(value.node.expression))
      return mappedEntries(value, sources, next);
    return arrayEntries(factoryReturn(value, sources), sources, next);
  }
  if (!ts.isArrayLiteralExpression(value.node))
    fail(value, 'Expected a static route composition array');
  return value.node.elements.flatMap((node) =>
    ts.isSpreadElement(node)
      ? arrayEntries({ ...value, node: node.expression }, sources, trail)
      : [{ ...value, node }]
  );
}

/** A mapped factory declares a route family, independent of how many games supply its parameters. */
function mappedEntries(
  location: Location,
  sources: RouteSources,
  trail: readonly string[]
): Location[] {
  const node = location.node;
  if (
    !ts.isCallExpression(node) ||
    !ts.isPropertyAccessExpression(node.expression)
  )
    fail(location, 'Expected a mapped route factory');
  const method = node.expression.name.text;
  const receiver = node.expression.expression;
  if (
    (method !== 'map' && method !== 'flatMap') ||
    !ts.isIdentifier(receiver) ||
    !parameterInScope(receiver, receiver.text)
  )
    fail(
      location,
      'Expected a static route composition array or a mapped factory parameter'
    );
  const mapper = node.arguments[0];
  if (node.arguments.length !== 1 || !mapper || !ts.isArrowFunction(mapper))
    fail(location, 'Mapped route factory needs one explicit mapper');
  let body: ts.Node = mapper.body;
  if (ts.isBlock(body)) {
    const returns = body.statements.filter(ts.isReturnStatement);
    if (returns.length !== 1 || !returns[0]?.expression)
      fail(location, 'Mapped route factory must return one declaration');
    body = returns[0].expression;
  }
  const mapped = { ...location, node: body };
  return method === 'map' ? [mapped] : arrayEntries(mapped, sources, trail);
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
        ts.isIdentifier(expression) &&
        (parameters.has(expression.text) ||
          parameterInScope(expression, expression.text))
          ? `:${expression.text}`
          : routeText({ ...value, node: expression }, sources);
      text += span.literal.text;
    }
    return text;
  }
  if (
    ts.isPropertyAccessExpression(value.node) &&
    ts.isIdentifier(value.node.expression) &&
    parameterInScope(value.node, value.node.expression.text)
  ) {
    return `:${value.node.name.text}`;
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

function subObject(location: Location, sources: RouteSources): Location {
  const value = resolved(location, sources);
  if (
    !ts.isCallExpression(value.node) ||
    !ts.isIdentifier(value.node.expression)
  )
    fail(value, 'Unresolved sub-client composition');
  const callName = value.node.expression.text;
  const importedDefinition = value.file.statements.some((statement) => {
    if (
      !ts.isImportDeclaration(statement) ||
      !ts.isStringLiteral(statement.moduleSpecifier) ||
      statement.moduleSpecifier.text !== '@libs/sub-client-ts/client'
    )
      return false;
    const imports = statement.importClause?.namedBindings;
    return (
      imports &&
      ts.isNamedImports(imports) &&
      imports.elements.some(
        (entry) =>
          entry.name.text === callName &&
          (entry.propertyName?.text ?? entry.name.text) === 'defineSubClient'
      )
    );
  });
  if (importedDefinition) {
    if (value.node.arguments.length !== 1)
      fail(value, 'Sub definition must have one static object');
    return resolved({ ...value, node: value.node.arguments[0]! }, sources);
  }
  return subObject(factoryReturn(value, sources), sources);
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
    binding(composition, 'APP_SUB_CLIENTS', sources),
    sources
  )) {
    const subClient = subObject(entry, sources);
    const contributions = namedProperty(subClient, 'routes');
    if (contributions)
      routes.push(
        ...routesInArray({ ...subClient, node: contributions }, sources)
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
