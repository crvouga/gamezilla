import {
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
  const edits: SourceEdit[] = [];
  for (const module of parsed.modules) {
    for (const declaration of module.declarations) {
      if (declaration.kind === 'def')
        cacheDefinition(declaration, {
          ids,
          names,
          sourceMap: parsed.sourceMap,
          edits,
        });
    }
  }
  for (const edit of edits.sort((a, b) => b.start - a.start)) {
    source = source.slice(0, edit.start) + edit.text + source.slice(edit.end);
  }
  return source;
}

type SourceEdit = {
  readonly start: number;
  readonly end: number;
  readonly text: string;
};
type CacheInput = {
  readonly ids: ReturnType<typeof newIdGenerator>;
  readonly names: Set<string>;
  readonly sourceMap: ReturnType<typeof parsePhase1fromText>['sourceMap'];
  readonly edits: SourceEdit[];
};

function cacheDefinition(definition: QuintOpDef, args: CacheInput): void {
  if (definition.expr.kind !== 'lambda') return;
  const lambda = definition.expr;
  const body = args.sourceMap.get(lambda.expr.id);
  if (body?.end === undefined) return;
  const bindings: string[] = [];
  for (const parameter of lambda.params) {
    if (/^cached_input_\d+$/.test(parameter.name)) continue;
    const kind = parameter.typeAnnotation?.kind;
    if (
      kind === undefined ||
      ![
        'const',
        'rec',
        'fun',
        'list',
        'int',
        'str',
        'bool',
        'set',
        'tup',
        'sum',
      ].includes(kind)
    )
      continue;
    const original = parameter.name;
    const location = args.sourceMap.get(parameter.id);
    if (location === undefined) continue;
    let cached = `cached_input_${args.ids.nextId()}`;
    while (args.names.has(cached)) cached = `cached_input_${args.ids.nextId()}`;
    args.names.add(cached);
    args.edits.push({
      start: location.start.index,
      end: location.start.index + original.length,
      text: cached,
    });
    const qualifier = definition.qualifier === 'puredef' ? 'pure val' : 'val';
    bindings.push(`${qualifier} ${original} = ${cached};`);
  }
  if (bindings.length === 0) return;
  args.edits.push({
    start: body.start.index,
    end: body.start.index,
    text: `{ ${bindings.join(' ')} `,
  });
  args.edits.push({
    start: body.end.index + 1,
    end: body.end.index + 1,
    text: ' }',
  });
}
