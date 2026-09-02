import type { Arbitrary } from 'fast-check';

import type { JsonValue } from './json';

export type ActionArbContext = {
  readonly ids: (role: string) => readonly string[];
  readonly knobs: Readonly<Record<string, unknown>>;
  readonly edges: readonly {
    readonly fromRole: string;
    readonly toRole: string;
  }[];
};

// biome-ignore lint/suspicious/noExplicitAny: heterogeneous action payloads and worlds
export type ActionDef<P = any, M = object, W = any> = {
  readonly kind: string;
  readonly arb: (ctx: ActionArbContext) => Arbitrary<P>;
  readonly dispatch: (world: W, action: P) => Promise<void>;
  readonly allows?: (model: M, action: P) => boolean;
  readonly apply?: (model: M, action: P) => void;
  readonly weight?: number;
};

// biome-ignore lint/suspicious/noExplicitAny: heterogeneous action payloads and worlds
export type UnboundActionDef<P = any, M = object, W = any> = Omit<
  ActionDef<P, M, W>,
  'kind'
>;

// biome-ignore lint/suspicious/noExplicitAny: heterogeneous action payloads and worlds
export function action<P = any, M = object, W = any>(
  def: UnboundActionDef<P, M, W>
): UnboundActionDef<P, M, W> {
  return def;
}

// biome-ignore lint/suspicious/noExplicitAny: heterogeneous action payloads and worlds
export function bindActionKind<P = any, M = object, W = any>(
  kind: string,
  def: UnboundActionDef<P, M, W>
): ActionDef<P, M, W> {
  return { kind, ...def };
}

export type SystemAction = JsonValue & { readonly kind: string };
