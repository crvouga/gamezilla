import {
  type IdGenerator,
  moduleToString,
  newIdGenerator,
  parsePhase1fromText,
  type QuintOpDef,
} from '@informalsystems/quint';

/**
 * Preserve value arguments as nullary LET bindings instead of duplicating
 * complex records at every reference during Apalache's operator inlining.
 * Renaming the parameter, then binding its original name, preserves shadowing.
 * Operator-valued parameters are left alone; they cannot be cached as values.
 */
export function cacheValueParameters(source: string): string {
  const ids = newIdGenerator();
  const parsed = parsePhase1fromText(ids, source, 'cached-input');
  if (parsed.errors.length > 0)
    throw new Error('Cannot cache parameters of an invalid Quint module.');
  const names = new Set(source.match(/[a-zA-Z_][a-zA-Z0-9_]*/g));
  for (const module of parsed.modules) {
    for (const declaration of module.declarations) {
      if (declaration.kind === 'def') cacheDefinition(declaration, ids, names);
    }
  }
  return parsed.modules.map(moduleToString).join('\n');
}

function cacheDefinition(
  definition: QuintOpDef,
  ids: IdGenerator,
  names: Set<string>
): void {
  if (definition.expr.kind !== 'lambda') return;
  const lambda = definition.expr;
  for (const parameter of [...lambda.params].reverse()) {
    const kind = parameter.typeAnnotation?.kind;
    if (kind === undefined || !['const', 'rec', 'fun', 'list'].includes(kind))
      continue;
    const original = parameter.name;
    let cached = `cached_input_${ids.nextId()}`;
    while (names.has(cached)) cached = `cached_input_${ids.nextId()}`;
    names.add(cached);
    parameter.name = cached;
    lambda.expr = {
      kind: 'let',
      id: ids.nextId(),
      opdef: {
        kind: 'def',
        id: ids.nextId(),
        name: original,
        qualifier: definition.qualifier === 'puredef' ? 'pureval' : 'val',
        expr: { kind: 'name', id: ids.nextId(), name: cached },
      },
      expr: lambda.expr,
    };
  }
}
