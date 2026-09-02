import type { Arbitrary } from 'fast-check';

import type { JsonValue } from '../kernel/json';

/** What an Action generator may consult: Surface, topology, knobs, edges. */
export type ActionGeneratorContext<S> = {
  readonly surface: S;
  readonly nodeIds: (role: string) => readonly string[];
  readonly knobs: Readonly<Record<string, unknown>>;
  readonly edges: readonly {
    readonly fromRole: string;
    readonly toRole: string;
  }[];
};

export type ActionWeight<S> =
  | number
  | ((surface: S) => number | Promise<number>);

export type UnboundActionDef<P = unknown, S = unknown> = {
  readonly weight?: ActionWeight<S>;
  readonly generate: (ctx: ActionGeneratorContext<S>) => Arbitrary<P>;
  readonly apply: (surface: S, payload: P) => void | Promise<void>;
};

export type ActionDef<P = unknown, S = unknown> = UnboundActionDef<P, S> & {
  readonly kind: string;
};

export type ActionCatalog<S = unknown> = Record<
  string,
  UnboundActionDef<unknown, S>
>;

/** Double-call factory — TS lacks partial type-arg inference for a single call. */
export function actions<S>() {
  return <A extends ActionCatalog<S>>(catalog: A): A => catalog;
}

export function bindActionKind<P, S>(
  kind: string,
  def: UnboundActionDef<P, S>
): ActionDef<P, S> {
  return { kind, ...def };
}

/** Serialized Action payload as it appears in a Repro. */
export type Action = JsonValue & { readonly kind: string };
