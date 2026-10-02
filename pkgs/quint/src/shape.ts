/**
 * Static shape of a Quint aggregate, before any trace is drawn or Apalache
 * runs. The default profile is offline-first: a device with no connection is a state
 * the model has to be able to reach and leave, and losing it has to change
 * what that device's own actions do. The same pass refuses a model that
 * cannot be checked — no invariant, an invariant that is literally `true`,
 * an invariant that names no state, an action `step` never calls, a variable
 * `init` never sets, a variable a person can observe that no invariant mentions.
 *
 * Operator state machines explicitly declare the maintenance profile and
 * retain the structural obligations without app-device connectivity.
 * `events.qnt` is a context's published language (types only), not an
 * aggregate, so it has nothing to check here.
 */

import { assignmentShapeIssues } from './shape-assignment';
import { offlineShapeIssues } from './shape-connectivity';
import {
  byKind,
  closureText,
  formatModelShapeIssue,
  type Item,
  indexByName,
  issue,
  type ModelShapeCode,
  type ModelShapeIssue,
  mentions,
  type ParsedModel,
  parseModel,
  reachableFrom,
} from './shape-model';

export type { ModelShapeCode, ModelShapeIssue };
export { formatModelShapeIssue };

function isTrivialInvariant(body: string): boolean {
  const eq = body.indexOf('=');
  if (eq === -1) return false;
  // The last declaration's body runs to the module's closing brace.
  const rhs = body
    .slice(eq + 1)
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/\}$/, '')
    .trim();
  return rhs === 'true' || rhs === 'false';
}

function structureIssues(model: ParsedModel, base: string): ModelShapeIssue[] {
  const issues: ModelShapeIssue[] = [];
  const stem = base.replace(/\.qnt$/, '').replaceAll('-', '_');
  if (model.module !== stem) {
    issues.push(
      issue(
        'module-name',
        1,
        `module is ${model.module ?? 'missing'}; ${base} requires module ${stem}`
      )
    );
  }
  const actions = byKind(model, 'action');
  const init = actions.find((item) => item.name === 'init');
  const step = actions.find((item) => item.name === 'step');
  if (init === undefined) {
    issues.push(issue('missing-init', 1, 'an aggregate needs action init'));
  }
  if (step === undefined) {
    issues.push(issue('missing-step', 1, 'an aggregate needs action step'));
  } else if (!/\bany\b|\bnondet\b/.test(step.body)) {
    issues.push(
      issue(
        'step-has-no-choice',
        step.line,
        'step must choose among actions to explore their interleavings'
      )
    );
  }
  const namedNext = actions.find((item) => item.name === 'next');
  if (namedNext !== undefined) {
    issues.push(
      issue(
        'action-next',
        namedNext.line,
        'next is a Quint builtin; name the action for what a person does'
      )
    );
  }
  pushInvariantIssues(model, issues);
  pushReachIssues(actions, init, step, issues);
  pushVarIssues(model, actions, init, issues);
  return issues;
}

function pushInvariantIssues(
  model: ParsedModel,
  issues: ModelShapeIssue[]
): void {
  const invs = byKind(model, 'val').filter((item) =>
    /^inv[A-Z]/.test(item.name)
  );
  const defs = indexByName(byKind(model, 'def'));
  const variables = byKind(model, 'var');
  if (invs.length === 0) {
    issues.push(
      issue(
        'no-invariant',
        1,
        'a model with no val inv<Name> is checked against nothing'
      )
    );
  }
  for (const inv of invs) {
    if (isTrivialInvariant(inv.body)) {
      issues.push(
        issue(
          'trivial-invariant',
          inv.line,
          `${inv.name} is literally true or false, so it cannot fail`
        )
      );
    }
    const text = closureText(inv.name, new Map([...defs, [inv.name, inv]]));
    if (variables.some((variable) => mentions(text, variable.name))) continue;
    issues.push(
      issue(
        'invariant-ignores-state',
        inv.line,
        `${inv.name} names no state, so it cannot tell a wrong state from a right one`
      )
    );
  }
}

function pushReachIssues(
  actions: readonly Item[],
  init: { readonly name: string } | undefined,
  step: { readonly name: string } | undefined,
  issues: ModelShapeIssue[]
): void {
  const byName = indexByName(actions);
  const reached = new Set<string>();
  if (init !== undefined) {
    for (const name of reachableFrom('init', byName)) reached.add(name);
  }
  if (step !== undefined) {
    for (const name of reachableFrom('step', byName)) reached.add(name);
  }
  for (const action of actions) {
    if (action.name === 'init' || action.name === 'step') continue;
    if (reached.has(action.name)) continue;
    issues.push(
      issue(
        'unreachable-action',
        action.line,
        `${action.name} is never called from init or step, so nothing checks it`
      )
    );
  }
}

function pushVarIssues(
  model: ParsedModel,
  actions: readonly Item[],
  init: { readonly name: string } | undefined,
  issues: ModelShapeIssue[]
): void {
  const defs = indexByName(byKind(model, 'def'));
  const callable = new Map([...indexByName(actions), ...defs]);
  const initText = init === undefined ? '' : closureText(init.name, callable);
  const invs = byKind(model, 'val').filter((item) =>
    /^inv[A-Z]/.test(item.name)
  );
  const invText = invs
    .map((inv) => closureText(inv.name, new Map([...defs, [inv.name, inv]])))
    .join('\n');
  for (const variable of byKind(model, 'var')) {
    if (!new RegExp(`\\b${variable.name}'`).test(initText)) {
      issues.push(
        issue(
          'var-uninitialized',
          variable.line,
          `${variable.name} is never set in init`
        )
      );
    }
    if (variable.name.startsWith('_') || mentions(invText, variable.name))
      continue;
    issues.push(
      issue(
        'var-unconstrained',
        variable.line,
        `${variable.name} is something a person can observe, and no invariant mentions it`
      )
    );
  }
}

/**
 * What is wrong with an aggregate model, in source order. Empty for a
 * published `events.qnt` and for a model that already meets every rule.
 */
export function modelShapeIssues(
  source: string,
  fileName: string
): readonly ModelShapeIssue[] {
  const base = fileName.split('/').pop() ?? fileName;
  if (base === 'events.qnt') return [];
  const model = parseModel(source);
  // Operator-maintenance models have no app devices. They still satisfy every
  // structural obligation; ordinary product aggregates default to offline-first.
  const profiles = [
    ...model.header.matchAll(/^\/\/ @model-profile: (\S+)\s*$/gm),
  ];
  const profile = profiles[0]?.[1] ?? 'offline-first';
  const profileIssues =
    profiles.length > 1 || !['offline-first', 'maintenance'].includes(profile)
      ? [
          issue(
            'model-profile',
            1,
            'declare at most one profile: offline-first or maintenance'
          ),
        ]
      : [];
  return [
    ...structureIssues(model, base),
    ...profileIssues,
    ...assignmentShapeIssues(model),
    ...(profile === 'maintenance' ? [] : offlineShapeIssues(model)),
  ].sort((a, b) => a.line - b.line || a.code.localeCompare(b.code));
}
