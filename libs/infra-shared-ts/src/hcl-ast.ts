/** The syntax tree `hcl-parse` produces and `hcl-eval` / `hcl-refs` read. */

export type Expr =
  | {
      readonly kind: 'literal';
      readonly value: string | number | boolean | null;
    }
  | { readonly kind: 'template'; readonly parts: readonly (string | Expr)[] }
  | { readonly kind: 'name'; readonly name: string }
  | { readonly kind: 'attr'; readonly target: Expr; readonly name: string }
  | { readonly kind: 'index'; readonly target: Expr; readonly key: Expr }
  | {
      readonly kind: 'splat';
      readonly target: Expr;
      readonly path: readonly Accessor[];
    }
  | {
      readonly kind: 'call';
      readonly name: string;
      readonly args: readonly Expr[];
    }
  | {
      readonly kind: 'unary';
      readonly op: '!' | '-';
      readonly operand: Expr;
    }
  | {
      readonly kind: 'binary';
      readonly op: string;
      readonly left: Expr;
      readonly right: Expr;
    }
  | {
      readonly kind: 'conditional';
      readonly test: Expr;
      readonly then: Expr;
      readonly otherwise: Expr;
    }
  | { readonly kind: 'tuple'; readonly items: readonly Expr[] }
  | {
      readonly kind: 'object';
      readonly entries: readonly { readonly key: Expr; readonly value: Expr }[];
    }
  | {
      readonly kind: 'for';
      readonly keyVar: string | null;
      readonly valueVar: string;
      readonly collection: Expr;
      readonly keyExpr: Expr | null;
      readonly valueExpr: Expr;
      readonly condition: Expr | null;
      readonly asObject: boolean;
    };

export type Accessor =
  | { readonly kind: 'attr'; readonly name: string }
  | { readonly kind: 'index'; readonly key: Expr };

export type Block = {
  readonly type: string;
  readonly labels: readonly string[];
  readonly body: Body;
  readonly line: number;
};

export type Body = {
  readonly attributes: ReadonlyMap<string, Expr>;
  readonly blocks: readonly Block[];
};

export const EMPTY_BODY: Body = { attributes: new Map(), blocks: [] };

/** A quoted string with no interpolation, e.g. a block label or `source`. */
export function literalString(expr: Expr | undefined): string | null {
  if (expr === undefined) return null;
  if (expr.kind === 'literal' && typeof expr.value === 'string') {
    return expr.value;
  }
  if (expr.kind === 'template') {
    return expr.parts.every((p) => typeof p === 'string')
      ? expr.parts.join('')
      : null;
  }
  return null;
}
