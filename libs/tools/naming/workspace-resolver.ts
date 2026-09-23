/**
 * Workspace specifier resolution for the naming codemod — pure, no I/O.
 *
 * Maps `@pkgs/x/...` / `@libs/x/...` / `@apps/x/...` specifiers to repo paths
 * (and back) from two sources: the root tsconfig `paths` and each workspace
 * `package.json` (`name` + `exports`). Only what the codemod needs: find the
 * file a specifier points at, and rebuild the specifier for its new path.
 */

export interface AliasRule {
  /** Specifier prefix (`@pkgs/assistant/shared/`) or exact specifier. */
  readonly spec: string;
  /** Repo path prefix the `*` lands in (`pkgs/assistant/src/shared/`), or exact target. */
  readonly target: string;
  /** Suffix appended after `*` on the target side (`.ts`), '' when none. */
  readonly targetSuffix: string;
  readonly exact: boolean;
}

export interface WorkspaceManifest {
  /** Repo-relative package directory (`pkgs/assistant`). */
  readonly dir: string;
  readonly name?: string | undefined;
  readonly exports?: unknown;
}

function stripDotSlash(p: string): string {
  return p.startsWith('./') ? p.slice(2) : p;
}

function joinPath(dir: string, rel: string): string {
  const clean = stripDotSlash(rel);
  if (dir === '' || dir === '.') return clean;
  return clean === '' ? dir : `${dir}/${clean}`;
}

function collectStrings(value: unknown, out: string[]): void {
  if (typeof value === 'string') {
    out.push(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const v of value) collectStrings(v, out);
    return;
  }
  if (value !== null && typeof value === 'object') {
    for (const v of Object.values(value)) collectStrings(v, out);
  }
}

function ruleFor(spec: string, target: string): AliasRule | null {
  const specStar = spec.indexOf('*');
  const targetStar = target.indexOf('*');
  if (specStar === -1 && targetStar === -1) {
    return { spec, target, targetSuffix: '', exact: true };
  }
  if (specStar !== spec.length - 1 || targetStar === -1) return null;
  return {
    spec: spec.slice(0, -1),
    target: target.slice(0, targetStar),
    targetSuffix: target.slice(targetStar + 1),
    exact: false,
  };
}

function pushRules(
  spec: string,
  targets: unknown,
  dir: string,
  out: AliasRule[]
): void {
  const strings: string[] = [];
  collectStrings(targets, strings);
  for (const t of strings) {
    const rule = ruleFor(spec, joinPath(dir, t));
    if (rule !== null) out.push(rule);
  }
}

/** Rules from tsconfig `compilerOptions.paths` (targets relative to the repo root). */
export function rulesFromTsconfigPaths(
  paths: Readonly<Record<string, unknown>>
): AliasRule[] {
  const out: AliasRule[] = [];
  for (const [spec, targets] of Object.entries(paths)) {
    pushRules(spec, targets, '', out);
  }
  return out;
}

/** Rules from workspace manifests (`exports` subpaths, plus a bare `name/*` fallback). */
export function rulesFromManifests(
  manifests: readonly WorkspaceManifest[]
): AliasRule[] {
  const out: AliasRule[] = [];
  for (const m of manifests) {
    if (m.name === undefined) continue;
    const exportsMap =
      typeof m.exports === 'object' &&
      m.exports !== null &&
      !Array.isArray(m.exports)
        ? (m.exports as Record<string, unknown>)
        : typeof m.exports === 'string'
          ? { '.': m.exports }
          : {};
    for (const [key, targets] of Object.entries(exportsMap)) {
      if (!key.startsWith('.')) continue;
      const spec = key === '.' ? m.name : `${m.name}/${stripDotSlash(key)}`;
      pushRules(spec, targets, m.dir, out);
    }
    out.push({
      spec: `${m.name}/`,
      target: `${m.dir}/`,
      targetSuffix: '',
      exact: false,
    });
  }
  return out;
}

export interface AliasHit {
  readonly rule: AliasRule;
  /** Repo path the specifier resolves to (before extension probing). */
  readonly path: string;
}

/** Candidate repo paths for a workspace specifier, most specific rule first. */
export function resolveAlias(
  rules: readonly AliasRule[],
  spec: string
): AliasHit[] {
  const hits: AliasHit[] = [];
  for (const rule of rules) {
    if (rule.exact) {
      if (spec === rule.spec) hits.push({ rule, path: rule.target });
      continue;
    }
    if (!spec.startsWith(rule.spec)) continue;
    const star = spec.slice(rule.spec.length);
    hits.push({ rule, path: `${rule.target}${star}${rule.targetSuffix}` });
  }
  return hits.sort((a, b) => b.rule.spec.length - a.rule.spec.length);
}

/**
 * Rebuild a specifier through the same rule for a moved target.
 * `newTarget` is the rule's target prefix after the plan (directories under a
 * package may be renamed too). Returns null when the new path escapes the rule.
 */
export function specifierFor(
  rule: AliasRule,
  newRuleTarget: string,
  newPath: string
): string | null {
  if (rule.exact) return rule.spec;
  if (!newPath.startsWith(newRuleTarget)) return null;
  const rest = newPath.slice(newRuleTarget.length);
  if (!rest.endsWith(rule.targetSuffix)) return null;
  return `${rule.spec}${rest.slice(0, rest.length - rule.targetSuffix.length)}`;
}
