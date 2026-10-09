import {
  newIdGenerator,
  parsePhase1fromText,
  type QuintEx,
  type QuintLambdaParameter,
  type QuintOpDef,
} from '@informalsystems/quint';
import { cacheRecordFields, type SourceEdit } from './cache-record-fields';

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
          source,
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

type CacheInput = {
  readonly ids: ReturnType<typeof newIdGenerator>;
  readonly names: Set<string>;
  readonly source: string;
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
    if (valueReferences(lambda.expr, parameter.name) < 2) continue;
    if (!valueParameter(lambda.expr, parameter)) continue;
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
    const annotation =
      location.end === undefined
        ? ''
        : args.source.slice(
            location.start.index + original.length,
            location.end.index + 1
          );
    bindings.push(`${qualifier} ${original}${annotation} = ${cached};`);
    bindings.push(
      ...cacheRecordFields({
        body: lambda.expr,
        parameter: original,
        source: args.source,
        sourceMap: args.sourceMap,
        qualifier,
        freshName: () => freshFieldName(args),
        edits: args.edits,
      })
    );
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

function freshFieldName(args: CacheInput): string {
  let name = `cached_field_${args.ids.nextId()}`;
  while (args.names.has(name)) name = `cached_field_${args.ids.nextId()}`;
  args.names.add(name);
  return name;
}

function valueParameter(
  body: QuintEx,
  parameter: QuintLambdaParameter
): boolean {
  const kind = parameter.typeAnnotation?.kind;
  return kind === undefined
    ? readsRecordField(body, parameter.name)
    : [
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
      ].includes(kind);
}

/** A field read proves an unannotated parameter is a record, never an operator. */
function readsRecordField(expression: QuintEx, name: string): boolean {
  if (expression.kind === 'app')
    return (
      (expression.opcode === 'field' &&
        expression.args[0]?.kind === 'name' &&
        expression.args[0].name === name) ||
      expression.args.some((argument) => readsRecordField(argument, name))
    );
  if (expression.kind === 'lambda')
    return (
      !expression.params.some((parameter) => parameter.name === name) &&
      readsRecordField(expression.expr, name)
    );
  if (expression.kind === 'let')
    return (
      readsRecordField(expression.opdef.expr, name) ||
      (expression.opdef.name !== name &&
        readsRecordField(expression.expr, name))
    );
  return false;
}

function valueReferences(expression: QuintEx, name: string): number {
  if (expression.kind === 'name') return expression.name === name ? 1 : 0;
  if (expression.kind === 'app')
    return expression.args.reduce(
      (count, argument) => count + valueReferences(argument, name),
      0
    );
  if (expression.kind === 'lambda')
    return valueReferences(expression.expr, name);
  if (expression.kind === 'let')
    return (
      valueReferences(expression.opdef.expr, name) +
      valueReferences(expression.expr, name)
    );
  return 0;
}
