/**
 * Offline-first shape of one aggregate: a device starts connected, one
 * device can lose that connection and get it back, and some invariant says
 * what that changes.
 */

import type { Item, ModelShapeIssue, ParsedModel } from './shape-model';
import {
  byKind,
  closureText,
  indexByName,
  issue,
  mentions,
  reachableFrom,
} from './shape-model';

const DISCONNECT_NAME = /offline|cutOff|loseConnection|disconnect|goOffline/i;
const RECONNECT_NAME =
  /reconnect|connectionReturn|comeBack|backOnline|goOnline/i;
const CONNECTIVITY_NAME = /(^|_)(offline|online|phoneState|phoneOnline)$/i;

function sliceBrace(text: string, openAt: number): string | null {
  let depth = 0;
  for (let i = openAt; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === '{' || ch === '(' || ch === '[') depth += 1;
    else if (ch === '}' || ch === ')' || ch === ']') {
      depth -= 1;
      if (depth === 0) return text.slice(openAt + 1, i);
    }
  }
  return null;
}

function splitCommas(text: string): readonly string[] {
  const parts: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i];
    if (ch === '{' || ch === '(' || ch === '[') depth += 1;
    else if (ch === '}' || ch === ')' || ch === ']') depth -= 1;
    else if (ch === ',' && depth === 0) {
      parts.push(text.slice(start, i));
      start = i + 1;
    }
  }
  parts.push(text.slice(start));
  return parts;
}

function guardConjuncts(body: string): readonly string[] {
  const match = /\ball\s*\{/.exec(body);
  if (match === null || match.index === undefined) return [];
  const openAt = match.index + match[0].length - 1;
  const inner = sliceBrace(body, openAt);
  if (inner === null) return [];
  return splitCommas(inner)
    .map((part) => part.trim())
    .filter((part) => part !== '' && !part.includes("'"));
}

function guardedBy(body: string, varName: string): boolean {
  if (guardConjuncts(body).some((part) => mentions(part, varName))) return true;
  return mentions(body, varName) && /not\s*\(|\.contains\s*\(/.test(body);
}

function isCollection(signature: string): boolean {
  const colon = signature.indexOf(':');
  const type = colon === -1 ? '' : signature.slice(colon + 1);
  return /Set\[|->/.test(type);
}

function hasParameter(signature: string): boolean {
  return /\([^)]+\)/.test(signature);
}

function dropsOneClient(body: string): boolean {
  return /union\s*\(\s*Set\s*\(|\.set\s*\(|\.put\s*\(|\.setBy\s*\(/.test(body);
}

/**
 * Connected at the start. A helper may assign `offline' = newOffline` while
 * `init` itself passes `Set()`; that still starts with nobody cut off.
 */
function startsConnected(
  varName: string,
  initText: string,
  initBody: string
): boolean {
  if (/phoneState$/i.test(varName)) return /\bOnline\b/.test(initText);
  if (/offline/i.test(varName) && !/online/i.test(varName)) {
    if (new RegExp(`\\b${varName}'\\s*=\\s*Set\\s*\\(\\s*\\)`).test(initText)) {
      return true;
    }
    return (
      new RegExp(`\\b${varName}'`).test(initText) &&
      /Set\s*\(\s*\)/.test(initBody)
    );
  }
  return (
    new RegExp(`\\b${varName}'\\s*=\\s*true\\b`).test(initText) ||
    /mapBy\s*\(\s*_\s*=>\s*true\s*\)/.test(initText) ||
    /mapBy\s*\(\s*_\s*=>\s*Online\s*\)/.test(initText)
  );
}

function namedLink(
  actions: readonly Item[],
  reached: ReadonlySet<string>,
  varName: string,
  pattern: RegExp
): Item[] {
  return actions.filter(
    (action) =>
      reached.has(action.name) &&
      pattern.test(action.name) &&
      mentions(action.body, varName)
  );
}

function connectivityCandidates(model: ParsedModel): readonly Item[] {
  return byKind(model, 'var').filter((item) =>
    CONNECTIVITY_NAME.test(item.name)
  );
}

function headerIssue(model: ParsedModel): ModelShapeIssue | null {
  if (/offline|connection|cut off|back online/i.test(model.header)) return null;
  return issue(
    'header-ignores-connection',
    1,
    'the opening comment must say what a person sees when their device has no connection'
  );
}

function linkIssues(
  variable: Item,
  disconnects: readonly Item[],
  reconnects: readonly Item[]
): ModelShapeIssue[] {
  const issues: ModelShapeIssue[] = [];
  const line = variable.line;
  if (disconnects.length === 0) {
    issues.push(
      issue(
        'no-disconnect',
        line,
        `${variable.name} has no action in step that takes a device's connection away`
      )
    );
  } else if (
    !disconnects.some((action) => guardedBy(action.body, variable.name))
  ) {
    issues.push(
      issue(
        'disconnect-unguarded',
        disconnects[0]?.line ?? line,
        'losing a connection must be refused when it is already gone'
      )
    );
  }
  if (reconnects.length === 0) {
    issues.push(
      issue(
        'no-reconnect',
        line,
        `${variable.name} has no action in step that brings a connection back`
      )
    );
  } else if (
    !reconnects.some((action) => guardedBy(action.body, variable.name))
  ) {
    issues.push(
      issue(
        'reconnect-unguarded',
        reconnects[0]?.line ?? line,
        'a connection coming back must be refused when it never left'
      )
    );
  }
  pushPerClient(variable, disconnects, issues);
  return issues;
}

function pushPerClient(
  variable: Item,
  disconnects: readonly Item[],
  issues: ModelShapeIssue[]
): void {
  if (!isCollection(variable.signature) || disconnects.length === 0) return;
  if (!disconnects.some((action) => hasParameter(action.signature))) {
    issues.push(
      issue(
        'connectivity-not-per-client',
        disconnects[0]?.line ?? variable.line,
        'one device must be able to lose its connection while another keeps its'
      )
    );
  }
  if (!disconnects.some((action) => dropsOneClient(action.body))) {
    issues.push(
      issue(
        'disconnect-drops-everyone',
        disconnects[0]?.line ?? variable.line,
        'losing a connection must take one device offline, not every device at once'
      )
    );
  }
}

function startAndCommandIssues(input: {
  readonly variable: Item;
  readonly actions: readonly Item[];
  readonly reached: ReadonlySet<string>;
  readonly callable: ReadonlyMap<string, Item>;
  readonly initText: string;
  readonly initBody: string;
}): ModelShapeIssue[] {
  const { variable, actions, reached, callable, initText, initBody } = input;
  const issues: ModelShapeIssue[] = [];
  if (!startsConnected(variable.name, initText, initBody)) {
    issues.push(
      issue(
        'starts-offline',
        variable.line,
        `${variable.name} must start connected, so a trace can take the connection away`
      )
    );
  }
  const special = new Set(
    actions
      .filter(
        (action) =>
          DISCONNECT_NAME.test(action.name) || RECONNECT_NAME.test(action.name)
      )
      .map((action) => action.name)
  );
  const respects = actions.some((action) => {
    if (!reached.has(action.name) || special.has(action.name)) return false;
    if (action.name === 'init' || action.name === 'step') return false;
    const text = closureText(action.name, callable);
    return (
      mentions(text, variable.name) &&
      /not\s*\(|\.contains\s*\(|\bif\s*\(/.test(text)
    );
  });
  if (!respects) {
    issues.push(
      issue(
        'commands-ignore-connectivity',
        variable.line,
        'some action a person takes must do something different without a connection'
      )
    );
  }
  return issues;
}

function couplingIssues(
  model: ParsedModel,
  variable: Item,
  defs: ReadonlyMap<string, Item>
): ModelShapeIssue[] {
  const invs = byKind(model, 'val').filter((item) =>
    /^inv[A-Z]/.test(item.name)
  );
  const others = byKind(model, 'var').filter(
    (item) => item.name !== variable.name
  );
  const coupled = invs.some((inv) => {
    const text = closureText(inv.name, new Map([...defs, [inv.name, inv]]));
    return (
      mentions(text, variable.name) &&
      text.includes('implies') &&
      others.some((other) => mentions(text, other.name))
    );
  });
  if (coupled) return [];
  return [
    issue(
      'no-coupling-invariant',
      variable.line,
      `${variable.name} needs an invariant that says what stays true while a device has no connection (an implication that also names another variable)`
    ),
  ];
}

function oneVariableIssues(
  model: ParsedModel,
  variable: Item
): readonly ModelShapeIssue[] {
  const actions = byKind(model, 'action');
  const byName = indexByName(actions);
  const reached = new Set<string>([
    ...reachableFrom('init', byName),
    ...reachableFrom('step', byName),
  ]);
  const disconnects = namedLink(
    actions,
    reached,
    variable.name,
    DISCONNECT_NAME
  );
  const reconnects = namedLink(actions, reached, variable.name, RECONNECT_NAME);
  const defs = indexByName(byKind(model, 'def'));
  const callable = new Map<string, Item>([...byName, ...defs]);
  const init = actions.find((item) => item.name === 'init');
  const initText = init === undefined ? '' : closureText(init.name, callable);
  return [
    ...linkIssues(variable, disconnects, reconnects),
    ...startAndCommandIssues({
      variable,
      actions,
      reached,
      callable,
      initText,
      initBody: init?.body ?? '',
    }),
    ...couplingIssues(model, variable, defs),
  ];
}

function fewest(
  groups: readonly (readonly ModelShapeIssue[])[]
): readonly ModelShapeIssue[] {
  return groups.reduce((best, group) =>
    group.length < best.length ? group : best
  );
}

/** What is wrong with how this aggregate treats a lost connection. */
export function offlineShapeIssues(
  model: ParsedModel
): readonly ModelShapeIssue[] {
  const header = headerIssue(model);
  const candidates = connectivityCandidates(model);
  const connectivity =
    candidates.length === 0
      ? [
          issue(
            'no-connectivity',
            1,
            'name who has no connection (offline, online, or phoneState), with actions to lose it and get it back'
          ),
        ]
      : [
          ...fewest(
            candidates.map((variable) => oneVariableIssues(model, variable))
          ),
        ];
  return [...(header === null ? [] : [header]), ...connectivity];
}
