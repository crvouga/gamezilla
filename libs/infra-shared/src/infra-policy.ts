/**
 * The deletion allow-list in `policy/stateful.rego`: the only resource types
 * an ordinary apply may delete or replace. Every other managed type is
 * "stateful" as far as the map is concerned, because the plan gate refuses to
 * remove it.
 */

export function parseDeletable(rego: string): Set<string> {
  const start = rego.search(/^deletable\s*:=\s*\{/m);
  if (start === -1) return new Set();
  const end = rego.indexOf('\n}', start);
  const body = rego.slice(start, end === -1 ? rego.length : end);
  const types = new Set<string>();
  for (const line of body.split('\n')) {
    const code = line.replace(/#.*$/, '');
    for (const match of code.matchAll(/"([a-z0-9_]+)"/g)) {
      types.add(match[1] as string);
    }
  }
  return types;
}
