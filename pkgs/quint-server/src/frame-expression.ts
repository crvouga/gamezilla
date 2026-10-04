import {
  getSignatures,
  type QuintEx,
  type QuintModule,
} from '@informalsystems/quint';

type Scope = ReadonlyMap<string, QuintEx>;
type Expansion = {
  definitions: Scope;
  builtins: ReadonlyMap<string, unknown>;
  visits: number;
  bound: number;
  reserved: ReadonlySet<string>;
  generated: Set<string>;
  draws: boolean;
};

/** Expand local definitions and record projections; unknown syntax stays with the solver. */
export function frameExpression(module: QuintModule) {
  const state: Expansion = {
    definitions: new Map(
      module.declarations.flatMap((declaration) =>
        declaration.kind === 'def' ? [[declaration.name, declaration.expr]] : []
      )
    ),
    builtins: getSignatures(),
    visits: 0,
    bound: 0,
    reserved: new Set(
      module.declarations.map((item) =>
        item.kind === 'import' ||
        item.kind === 'export' ||
        item.kind === 'instance'
          ? ''
          : item.name
      )
    ),
    generated: new Set(),
    draws: false,
  };
  return (expression: QuintEx, draws = false) => {
    state.draws = draws;
    return expand(expression, new Map(), state);
  };
}

function expand(expression: QuintEx, scope: Scope, state: Expansion): QuintEx {
  if (++state.visits > 500_000) throw new Error('frame expansion limit');
  if (expression.kind === 'name') {
    const local = scope.get(expression.name);
    if (local !== undefined) return local;
    const definition = state.definitions.get(expression.name);
    if (definition !== undefined) return expand(definition, new Map(), state);
    if (
      !state.reserved.has(expression.name) &&
      !state.generated.has(expression.name) &&
      !state.builtins.has(expression.name)
    )
      throw new Error('unknown frame name');
    return expression;
  }
  if (expression.kind === 'let') {
    if (expression.opdef.qualifier === 'nondet' && !state.draws)
      throw new Error('nondeterministic candidate');
    const next = new Map(scope);
    next.set(
      expression.opdef.name,
      expression.opdef.qualifier === 'nondet'
        ? boundName(expression.opdef.id, state)
        : expand(expression.opdef.expr, scope, state)
    );
    return expand(expression.expr, next, state);
  }
  if (expression.kind === 'lambda')
    return expandLambda(expression, scope, state);
  if (expression.kind !== 'app') return expression;
  return expandApplication(expression, scope, state);
}

function boundName(id: bigint, state: Expansion): QuintEx & { kind: 'name' } {
  let name: string;
  do {
    name = `__frame_bound_${String(state.bound++)}`;
  } while (state.reserved.has(name));
  state.generated.add(name);
  return { kind: 'name', name, id };
}

function expandLambda(
  expression: QuintEx & { kind: 'lambda' },
  scope: Scope,
  state: Expansion
): QuintEx {
  const next = new Map(scope);
  const params = expression.params.map((param) => {
    const bound = boundName(param.id, state);
    next.set(param.name, bound);
    return { ...param, name: bound.name };
  });
  return { ...expression, params, expr: expand(expression.expr, next, state) };
}

function expandApplication(
  expression: QuintEx & { kind: 'app' },
  scope: Scope,
  state: Expansion
): QuintEx {
  const args = expression.args.map((argument) =>
    expand(argument, scope, state)
  );
  const definition = state.definitions.get(expression.opcode);
  const call =
    scope.get(expression.opcode) ??
    (definition === undefined
      ? undefined
      : expand(definition, new Map(), state));
  if (call !== undefined) {
    if (call.kind !== 'lambda' || call.params.length !== args.length)
      throw new Error('unrecognized frame call');
    const parameters = new Map(
      call.params.map((param, index) => [param.name, args[index]!])
    );
    return expand(call.expr, parameters, state);
  }
  if (expression.opcode === 'field' && args[1]?.kind === 'str') {
    const value = recordField(args[0], args[1].value);
    if (value !== undefined) return value;
  }
  if (!state.builtins.has(expression.opcode))
    throw new Error('unknown frame operator');
  return { ...expression, args };
}

function recordField(
  record: QuintEx | undefined,
  key: string
): QuintEx | undefined {
  if (record?.kind !== 'app') return undefined;
  if (record.opcode === 'Rec') {
    for (let index = 0; index < record.args.length; index += 2) {
      const field = record.args[index];
      if (field?.kind === 'str' && field.value === key)
        return record.args[index + 1];
    }
  }
  if (record.opcode === 'with')
    return record.args[1]?.kind === 'str' && record.args[1].value === key
      ? record.args[2]
      : recordField(record.args[0], key);
  return undefined;
}
