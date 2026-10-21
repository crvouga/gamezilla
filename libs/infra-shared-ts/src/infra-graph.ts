/**
 * Resource-level dependency edges, resolved the way OpenTofu's own graph is:
 * a reference to `var.x` is whatever the caller passed, `local.y` is what it
 * is built from, and `module.m.out` is what `out` is built from. Following
 * those hops ends at real resources, so an edge between two resources
 * survives however many modules and locals lie between them.
 */

import type { Expr } from './hcl-ast';
import type { Ref } from './hcl-refs';
import { bodyRefs, exprRefs } from './hcl-refs';
import type { ResourceEntry, Scope } from './infra-scope';

export type ScopedEntry = {
  readonly scope: Scope;
  readonly entry: ResourceEntry;
};

export type GraphEdge = { readonly from: string; readonly to: string };

export function scopesOf(root: Scope): Scope[] {
  const out: Scope[] = [root];
  for (const child of root.children.values()) out.push(...scopesOf(child));
  return out;
}

export function entriesOf(root: Scope): ScopedEntry[] {
  return scopesOf(root).flatMap((scope) =>
    scope.resources.map((entry) => ({ scope, entry }))
  );
}

class Resolver {
  private readonly memo = new Map<string, ReadonlySet<string>>();

  /** Resource addresses a set of references ultimately points at. */
  resolve(refs: readonly Ref[], scope: Scope): Set<string> {
    const out = new Set<string>();
    for (const ref of refs) {
      for (const id of this.resolveRef(ref, scope)) out.add(id);
    }
    return out;
  }

  private resolveExpr(expr: Expr, scope: Scope): ReadonlySet<string> {
    return this.resolve(exprRefs(expr), scope);
  }

  private cached(
    key: string,
    compute: () => ReadonlySet<string>
  ): ReadonlySet<string> {
    const hit = this.memo.get(key);
    if (hit !== undefined) return hit;
    this.memo.set(key, new Set());
    const value = compute();
    this.memo.set(key, value);
    return value;
  }

  private resolveRef(ref: Ref, scope: Scope): ReadonlySet<string> {
    const [first, second] = ref.path;
    const prefix = scope.path.map((s) => `module.${s}.`).join('');
    switch (ref.root) {
      case 'var':
        return this.fromVariable(first, scope);
      case 'local':
        return this.fromLocal(first, scope);
      case 'module':
        return this.fromModule(first, second, scope);
      case 'data':
        return first !== undefined && second !== undefined
          ? new Set([`${prefix}data.${first}.${second}`])
          : new Set();
      default:
        return first !== undefined && this.owns(scope, ref.root, first)
          ? new Set([`${prefix}${ref.root}.${first}`])
          : new Set();
    }
  }

  private owns(scope: Scope, type: string, name: string): boolean {
    return scope.resources.some(
      (r) => r.mode === 'managed' && r.type === type && r.name === name
    );
  }

  private fromVariable(name: string | undefined, scope: Scope) {
    if (name === undefined || scope.parent === null) return new Set<string>();
    const arg = scope.args.get(name);
    if (arg === undefined) return new Set<string>();
    const parent = scope.parent;
    return this.cached(`${scope.id}|var|${name}`, () =>
      this.resolveExpr(arg, parent)
    );
  }

  private fromLocal(name: string | undefined, scope: Scope) {
    const located =
      name === undefined ? undefined : scope.config.locals.get(name);
    if (located === undefined) return new Set<string>();
    return this.cached(`${scope.id}|local|${name}`, () =>
      this.resolveExpr(located.value, scope)
    );
  }

  private fromModule(
    name: string | undefined,
    output: string | undefined,
    scope: Scope
  ): ReadonlySet<string> {
    const child = name === undefined ? undefined : scope.children.get(name);
    if (child === undefined) return new Set();
    if (output === undefined) {
      return new Set(child.resources.map((r) => r.address));
    }
    const expr = child.config.outputs
      .get(output)
      ?.value.body.attributes.get('value');
    if (expr === undefined) return new Set();
    return this.cached(`${child.id}|output|${output}`, () =>
      this.resolveExpr(expr, child)
    );
  }
}

/** Producer → consumer edges between every resource in a stack. */
export function graphEdges(root: Scope): GraphEdge[] {
  const resolver = new Resolver();
  const edges = new Map<string, GraphEdge>();
  for (const { scope, entry } of entriesOf(root)) {
    const targets = resolver.resolve(bodyRefs(entry.body), scope);
    for (const from of targets) {
      if (from === entry.address) continue;
      edges.set(`${from}->${entry.address}`, { from, to: entry.address });
    }
  }
  return [...edges.values()];
}
