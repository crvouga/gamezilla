/**
 * Shared parse of a Quint aggregate for the shape checks. Names stay on
 * their source lines; comments and strings are blanked first.
 */

import { quintNames } from './names';

export type ModelShapeCode =
  | 'model-profile'
  | 'module-name'
  | 'missing-init'
  | 'missing-step'
  | 'step-has-no-choice'
  | 'no-invariant'
  | 'trivial-invariant'
  | 'invariant-ignores-state'
  | 'action-next'
  | 'compound-assignment'
  | 'unreachable-action'
  | 'var-uninitialized'
  | 'var-unconstrained'
  | 'header-ignores-connection'
  | 'no-connectivity'
  | 'no-disconnect'
  | 'no-reconnect'
  | 'disconnect-unguarded'
  | 'reconnect-unguarded'
  | 'disconnect-drops-everyone'
  | 'connectivity-not-per-client'
  | 'starts-offline'
  | 'commands-ignore-connectivity'
  | 'no-coupling-invariant';

export type ModelShapeIssue = {
  readonly code: ModelShapeCode;
  readonly line: number;
  readonly detail: string;
};

export type Item = {
  readonly name: string;
  readonly kind: string;
  readonly line: number;
  readonly signature: string;
  readonly body: string;
};

export type ParsedModel = {
  readonly module: string | null;
  readonly header: string;
  readonly items: readonly Item[];
};

export function issue(
  code: ModelShapeCode,
  line: number,
  detail: string
): ModelShapeIssue {
  return { code, line, detail };
}

export function formatModelShapeIssue(
  fileName: string,
  found: ModelShapeIssue
): string {
  return `${fileName}:${String(found.line)}: ${found.detail} [${found.code}]`;
}

/** Comments and strings blanked, line breaks kept, so names stay on their lines. */
function blankNoise(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '))
    .replace(/\/\/[^\n]*/g, (m) => ' '.repeat(m.length))
    .replace(/"(?:[^"\\\n]|\\.)*"/g, (m) => `"${' '.repeat(m.length - 2)}"`);
}

function identifiers(text: string): readonly string[] {
  return [...text.matchAll(/\b[A-Za-z_]\w*\b/g)].map((match) => match[0] ?? '');
}

export function mentions(text: string, name: string): boolean {
  return new RegExp(`\\b${name}\\b`).test(text);
}

export function parseModel(source: string): ParsedModel {
  const clean = blankNoise(source);
  const names = quintNames(clean);
  const lines = clean.split('\n');
  const tops = names.declarations.filter((d) => d.kind !== 'variant');
  const items = tops.map((declared, index) => {
    const next = tops[index + 1];
    const from = declared.line - 1;
    const to = next === undefined ? lines.length : next.line - 1;
    const body = lines.slice(from, to).join('\n');
    return {
      name: declared.name,
      kind: declared.kind,
      line: declared.line,
      signature: lines[from] ?? '',
      body,
    };
  });
  const moduleAt = source.search(/^module\s/m);
  return {
    module: names.module,
    header: moduleAt === -1 ? source : source.slice(0, moduleAt),
    items,
  };
}

export function byKind(model: ParsedModel, kind: string): readonly Item[] {
  return model.items.filter((item) => item.kind === kind);
}

export function indexByName(items: readonly Item[]): Map<string, Item> {
  return new Map(items.map((item) => [item.name, item]));
}

export function reachableFrom(
  root: string,
  byName: ReadonlyMap<string, Item>
): Set<string> {
  const seen = new Set<string>();
  const stack = [root];
  while (stack.length > 0) {
    const name = stack.pop();
    if (name === undefined || seen.has(name)) continue;
    seen.add(name);
    const item = byName.get(name);
    if (item === undefined) continue;
    for (const id of identifiers(item.body)) {
      if (byName.has(id) && !seen.has(id)) stack.push(id);
    }
  }
  return seen;
}

export function closureText(
  root: string,
  byName: ReadonlyMap<string, Item>
): string {
  let text = '';
  for (const name of reachableFrom(root, byName)) {
    text += `\n${byName.get(name)?.body ?? ''}`;
  }
  return text;
}
