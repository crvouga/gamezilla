import {
  newIdGenerator,
  parsePhase1fromText,
  type QuintEx,
} from '@informalsystems/quint';

/** Only bare references in a conjunction are immediate consequences. */
function conjuncts(expression: QuintEx): readonly string[] {
  if (expression.kind === 'name') return [expression.name];
  if (
    expression.kind === 'app' &&
    (expression.opcode === 'and' || expression.opcode === 'actionAll')
  )
    return expression.args.flatMap(conjuncts);
  return [];
}

/**
 * Prove a candidate's named conjuncts by conjunction elimination. Apalache
 * still proves the full candidate initially and under every transition;
 * every property not covered structurally retains its solver implication.
 */
export function inductionTargets(input: {
  readonly source: string;
  readonly module: string;
  readonly candidate: string;
  readonly invariants: readonly string[];
}): readonly string[] {
  const parsed = parsePhase1fromText(
    newIdGenerator(),
    input.source,
    'induction'
  );
  if (parsed.errors.length > 0) return input.invariants;
  const module = parsed.modules.find((module) => module.name === input.module);
  const definition = module?.declarations.find(
    (declaration) =>
      declaration.kind === 'def' && declaration.name === input.candidate
  );
  if (definition?.kind !== 'def' || definition.qualifier !== 'val')
    return input.invariants;
  const covered = new Set(conjuncts(definition.expr));
  return input.invariants.filter((name) => !covered.has(name));
}
