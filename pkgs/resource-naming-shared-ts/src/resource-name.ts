/**
 * Deterministic resource names. The same inputs give the same name in every
 * run, on every machine and in every language; nothing is random, so a
 * routine deployment never invents a new identifier.
 *
 * Algorithm (the contract another language reimplements):
 * 1. Join the parts with `-`; lower-case it when the provider folds case.
 * 2. Replace every character the provider refuses with `-`, collapse runs of
 *    `-`, and trim `-` from both ends.
 * 3. A globally unique kind given `uniqueIn` appends `-<h>`, where `<h>` is
 *    `stableHash(uniqueIn)`: one scope (an account id, a namespace) always
 *    gets the same suffix, and two scopes do not collide.
 * 4. A name longer than the provider allows keeps its first
 *    `maxLength - 9` characters, trims a trailing `-`, and appends
 *    `-<stableHash(full name)>`, so two long names that share a prefix stay
 *    distinct.
 * 5. The result is checked against the provider's rule; a name that still
 *    breaks it is an error, never silently changed.
 *
 * `stableHash` is FNV-1a over the UTF-8 bytes, 64-bit, as the first 8
 * lower-case hex digits.
 */
import { PROVIDER_RULES, type ResourceKind } from './provider-rules';

const FNV_OFFSET = 0xcbf29ce484222325n;
const FNV_PRIME = 0x100000001b3n;
const MASK = 0xffffffffffffffffn;

/** FNV-1a 64-bit of the UTF-8 bytes, first 8 hex digits. */
export function stableHash(text: string): string {
  let hash = FNV_OFFSET;
  for (const byte of new TextEncoder().encode(text)) {
    hash ^= BigInt(byte);
    hash = (hash * FNV_PRIME) & MASK;
  }
  return hash.toString(16).padStart(16, '0').slice(0, 8);
}

export type ResourceNameOptions = {
  /** Stable scope for a globally unique kind (an account id, a namespace). */
  readonly uniqueIn?: string | undefined;
};

export function resourceName(
  kind: ResourceKind,
  parts: readonly string[],
  options: ResourceNameOptions = {}
): string {
  const rule = PROVIDER_RULES[kind];
  if (parts.length === 0) throw new Error(`${kind}: a name needs a part`);
  let name = parts.join('-');
  if (rule.lowercase) name = name.toLowerCase();
  name = [...name]
    .map((char) => (rule.allowed.test(char) ? char : '-'))
    .join('')
    .replace(/-{2,}/g, '-');
  name = trimHyphens(name);
  if (rule.globallyUnique && options.uniqueIn !== undefined)
    name = `${name}-${stableHash(options.uniqueIn)}`;
  if (name.length > rule.maxLength) {
    const head = trimHyphens(name.slice(0, rule.maxLength - 9));
    name = `${head}-${stableHash(name)}`;
  }
  const problems = nameViolations(kind, name);
  if (problems.length > 0)
    throw new Error(`${kind} "${name}": ${problems.join('; ')}`);
  return name;
}

/** Why `name` is not a valid `kind` name (empty when it is). */
export function nameViolations(kind: ResourceKind, name: string): string[] {
  const rule = PROVIDER_RULES[kind];
  const out: string[] = [];
  if (name.length < rule.minLength)
    out.push(`shorter than ${String(rule.minLength)}`);
  if (name.length > rule.maxLength)
    out.push(`longer than ${String(rule.maxLength)}`);
  if (name.length > 0 && !rule.allowed.test(name))
    out.push(`has a character ${kind} refuses`);
  if (rule.lowercase && name !== name.toLowerCase())
    out.push('is not lower case');
  const first = name[0];
  const last = name[name.length - 1];
  if (
    first !== undefined &&
    last !== undefined &&
    (!rule.edge.test(first) || !rule.edge.test(last))
  )
    out.push('starts or ends with a character it may not');
  return out;
}

function trimHyphens(name: string): string {
  let start = 0;
  let end = name.length;
  while (start < end && name[start] === '-') start += 1;
  while (end > start && name[end - 1] === '-') end -= 1;
  return name.slice(start, end);
}
