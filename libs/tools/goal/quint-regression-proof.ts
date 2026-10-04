import { posix } from 'node:path';
import { decodeItfTrace } from '@pkgs/quint-shared/itf';
import type { ProofFiles } from './goal-manifest';

type Fields = ReadonlyMap<string, readonly string[]>;
const OPEN = new Map([
  ['(', ')'],
  ['[', ']'],
  ['{', '}'],
]);

/** Inspect literal registrations without evaluating arbitrary proof code. */
function tokensOf(body: string): readonly string[] {
  return [
    ...body.matchAll(
      /\/\/[^\n]*|\/\*[\s\S]*?\*\/|'(?:\\.|[^'\\])*'|"(?:\\.|[^"\\])*"|`(?:\\.|[^`\\])*`|[A-Za-z_$][\w$]*|[^\s]/g
    ),
  ]
    .map((match) => match[0])
    .filter((token) => !token.startsWith('//') && !token.startsWith('/*'));
}

function quoted(token: string | undefined): string | null {
  if (token === undefined || token.includes('\\')) return null;
  return /^(?:'[^']*'|"[^"]*")$/.test(token) ? token.slice(1, -1) : null;
}

function splitFields(
  tokens: readonly string[]
): readonly (readonly string[])[] {
  const result: string[][] = [];
  const current: string[] = [];
  const closers: string[] = [];
  for (const token of tokens) {
    if (token === ',' && closers.length === 0) {
      result.push(current.splice(0));
      continue;
    }
    current.push(token);
    const closer = OPEN.get(token);
    if (closer !== undefined) closers.push(closer);
    else if (token === closers.at(-1)) closers.pop();
  }
  if (current.length > 0) result.push(current);
  return result;
}

function objectFields(tokens: readonly string[]): Fields | null {
  if (tokens[0] !== '{' || tokens.at(-1) !== '}') return null;
  const fields = new Map<string, readonly string[]>();
  for (const field of splitFields(tokens.slice(1, -1))) {
    const name = quoted(field[0]) ?? field[0];
    if (name === undefined || field[1] !== ':' || fields.has(name)) return null;
    fields.set(name, field.slice(2));
  }
  return fields;
}

function callObject(tokens: readonly string[], at: number): Fields | null {
  let opening = at + 1;
  if (tokens[opening] === '<') {
    while (opening < tokens.length && tokens[opening] !== '>') opening++;
    opening++;
  }
  if (tokens[opening] !== '(' || tokens[opening + 1] !== '{') return null;
  let depth = 0;
  for (let end = opening + 1; end < tokens.length; end++) {
    if (tokens[end] === '{') depth++;
    if (tokens[end] === '}' && --depth === 0)
      return objectFields(tokens.slice(opening + 1, end + 1));
  }
  return null;
}

function importedFixture(
  tokens: readonly string[],
  name: string
): string | null {
  for (let at = 0; at < tokens.length; at++) {
    if (
      tokens[at] !== 'import' ||
      tokens[at + 1] !== name ||
      tokens[at + 2] !== 'from'
    )
      continue;
    const path = quoted(tokens[at + 3]);
    if (path !== null && /^\.\.?\/.*\.itf\.json$/.test(path)) return path;
  }
  return null;
}

function registryImported(tokens: readonly string[]): boolean {
  return tokens.some((token, at) => {
    if (token !== 'import' || tokens[at + 1] !== '{') return false;
    const close = tokens.indexOf('}', at + 2);
    if (
      close < 0 ||
      tokens[close + 1] !== 'from' ||
      quoted(tokens[close + 2]) !== '@pkgs/quint/registry'
    )
      return false;
    return splitFields(tokens.slice(at + 2, close)).some(
      (field) => field.length === 1 && field[0] === 'bindQuintModel'
    );
  });
}

function literalRegistration(tokens: readonly string[], bugId: string) {
  for (let at = 0; at < tokens.length; at++) {
    if (tokens[at] !== 'bindQuintModel') continue;
    const binding = callObject(tokens, at);
    const regressions = binding?.get('regressions');
    const actions = objectFields(binding?.get('actions') ?? []);
    if (
      regressions?.[0] !== '[' ||
      regressions.at(-1) !== ']' ||
      actions === null
    )
      continue;
    for (const entry of splitFields(regressions.slice(1, -1))) {
      const fields = objectFields(entry);
      const id = fields?.get('id');
      const itf = fields?.get('itf');
      if (id?.length !== 1 || quoted(id[0]) !== bugId || itf?.length !== 1)
        continue;
      const fixture = importedFixture(tokens, itf[0] ?? '');
      if (fixture !== null) return { fixture, actions };
    }
  }
  return null;
}

/** Canonical pinned histories are example tests registered by the Quint runner. */
export function quintRegressionProof(input: {
  readonly body: string;
  readonly bugId: string;
  readonly path: string;
  readonly files: ProofFiles;
}): string | null {
  if (
    !input.body
      .split('\n')
      .some((line) => line.trim() === `// regression: ${input.bugId}`)
  )
    return 'requires its own // regression: <id> marker';
  const tokens = tokensOf(input.body);
  const registration = registryImported(tokens)
    ? literalRegistration(tokens, input.bugId)
    : null;
  if (registration === null)
    return 'requires a registered literal regression and imported .itf.json fixture';
  const path = posix.normalize(
    posix.join(posix.dirname(input.path), registration.fixture)
  );
  if (!input.files.owns(path))
    return `${path} must belong to the package that owns the regression binding`;
  const body = input.files.read(path);
  if (body === null) return `pinned history not found: ${path}`;
  try {
    const history = decodeItfTrace(JSON.parse(body));
    if (
      history.states.length < 2 ||
      history.states[0]?.action !== 'init' ||
      history.states.slice(1).some((state) => state.action === 'init')
    )
      return `${path} must pin init followed by the failing action history`;
    if (history.states.some((state) => !registration.actions.has(state.action)))
      return `${path} uses an action that the binding does not register`;
    return null;
  } catch (cause) {
    return `${path} is not a readable literal ITF history: ${String(cause)}`;
  }
}
