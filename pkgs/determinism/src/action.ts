import type { Arbitrary } from 'fast-check';
import type { JsonValue } from './json';
import type { World } from './world-types';

export type ActionArbContext = {
  readonly roleIds: (role: string) => readonly string[];
  readonly knobs: Readonly<Record<string, JsonValue>>;
};

export type ActionClass = 'library' | 'domain';

/**
 * One chaos or domain op. `kind` must be unique within a system.
 * Library vs domain is a tag for sampling weight / docs — dispatch is identical.
 */
export type ActionDef<
  S = unknown,
  A extends JsonValue & { readonly kind: string } = JsonValue & {
    readonly kind: string;
  },
  M = object,
> = {
  readonly kind: string;
  readonly class: ActionClass;
  readonly arb: (ctx: ActionArbContext) => Arbitrary<A>;
  readonly dispatch: (world: World<S>, action: A) => Promise<void>;
  readonly allows?: (model: M, action: A) => boolean;
  readonly apply?: (model: M, action: A) => void;
};

export function defineAction<
  S = unknown,
  A extends JsonValue & { readonly kind: string } = JsonValue & {
    readonly kind: string;
  },
  M = object,
>(def: ActionDef<S, A, M>): ActionDef<S, A, M> {
  return def;
}

export type SystemAction = JsonValue & { readonly kind: string };
