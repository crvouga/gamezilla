/**
 * Static references an expression makes: `var.x`, `local.y`,
 * `module.m.out`, `aws_iam_role.r.arn`, `data.t.n.attr`. A reference keeps
 * only the leading run of plain attribute names, which is all an address
 * needs; index keys and iteration variables are not references.
 */

import type { Block, Body, Expr } from './hcl-ast';

export type Ref = { readonly root: string; readonly path: readonly string[] };

type Bound = ReadonlySet<string>;

function unwind(expr: Expr): { root: string; steps: Expr[] } | null {
  const steps: Expr[] = [];
  let cur = expr;
  for (;;) {
    if (cur.kind === 'name') return { root: cur.name, steps: steps.reverse() };
    if (cur.kind === 'attr' || cur.kind === 'index') {
      steps.push(cur);
      cur = cur.target;
      continue;
    }
    return null;
  }
}

function chainRef(root: string, steps: readonly Expr[]): Ref {
  const path: string[] = [];
  for (const step of steps) {
    if (step.kind !== 'attr') break;
    path.push(step.name);
  }
  return { root, path };
}

function childExprs(expr: Expr): readonly Expr[] {
  switch (expr.kind) {
    case 'template':
      return expr.parts.filter((p): p is Expr => typeof p !== 'string');
    case 'attr':
      return [expr.target];
    case 'index':
      return [expr.target, expr.key];
    case 'splat':
      return [
        expr.target,
        ...expr.path.flatMap((a) => (a.kind === 'index' ? [a.key] : [])),
      ];
    case 'call':
      return expr.args;
    case 'unary':
      return [expr.operand];
    case 'binary':
      return [expr.left, expr.right];
    case 'conditional':
      return [expr.test, expr.then, expr.otherwise];
    case 'tuple':
      return expr.items;
    case 'object':
      return expr.entries.flatMap((e) => [e.key, e.value]);
    default:
      return [];
  }
}

function visit(expr: Expr, bound: Bound, out: Ref[]): void {
  const chain = unwind(expr);
  if (chain !== null) {
    if (!bound.has(chain.root)) out.push(chainRef(chain.root, chain.steps));
    for (const step of chain.steps) {
      if (step.kind === 'index') visit(step.key, bound, out);
    }
    return;
  }
  if (expr.kind === 'for') {
    visit(expr.collection, bound, out);
    const inner = new Set(bound);
    inner.add(expr.valueVar);
    if (expr.keyVar !== null) inner.add(expr.keyVar);
    for (const part of [expr.keyExpr, expr.valueExpr, expr.condition]) {
      if (part !== null) visit(part, inner, out);
    }
    return;
  }
  for (const child of childExprs(expr)) visit(child, bound, out);
}

export function exprRefs(expr: Expr): Ref[] {
  const out: Ref[] = [];
  visit(expr, new Set(), out);
  return out;
}

function blockRefs(block: Block, bound: Bound, out: Ref[]): void {
  if (block.type === 'lifecycle') return;
  bodyRefsInto(block.body, bound, out);
}

function bodyRefsInto(body: Body, bound: Bound, out: Ref[]): void {
  for (const expr of body.attributes.values()) visit(expr, bound, out);
  for (const block of body.blocks) blockRefs(block, bound, out);
}

/** Every reference in a block body, `lifecycle` excluded. */
export function bodyRefs(body: Body): Ref[] {
  const out: Ref[] = [];
  bodyRefsInto(body, new Set(['each', 'count', 'self']), out);
  return out;
}

/** `module.a.b.c["k"]` → "module.a.b.c": the address a reference names. */
export function addressOf(expr: Expr): string | null {
  const chain = unwind(expr);
  if (chain === null) return null;
  return [chain.root, ...chainRef(chain.root, chain.steps).path].join('.');
}
