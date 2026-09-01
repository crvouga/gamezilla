import type { Arbitrary } from 'fast-check';
import type { JsonValue } from './json';
import type { World } from './world-types';

export type ActionArbContext = {
  readonly roleIds: (role: string) => readonly string[];
  readonly knobs: Readonly<Record<string, JsonValue>>;
  /** Declared network edges from SystemDef (empty when undeclared). */
  readonly edges: readonly {
    readonly fromRole: string;
    readonly toRole: string;
  }[];
};

export type ActionClass = 'library' | 'domain';

/**
 * One chaos or domain op. `kind` must be unique within a system.
 * `class` weights command sampling in assertSample (library vs domain).
 */
export type ActionDef<
  S = unknown,
  A extends JsonValue & { readonly kind: string } = JsonValue & {
    readonly kind: string;
  },
  M = object,
  F = unknown,
> = {
  readonly kind: string;
  readonly class: ActionClass;
  readonly arb: (ctx: ActionArbContext) => Arbitrary<A>;
  readonly dispatch: (world: World<S, F>, action: A) => Promise<void>;
  readonly allows?: (model: M, action: A) => boolean;
  readonly apply?: (model: M, action: A) => void;
};

export function defineAction<
  S = unknown,
  A extends JsonValue & { readonly kind: string } = JsonValue & {
    readonly kind: string;
  },
  M = object,
  F = unknown,
>(def: ActionDef<S, A, M, F>): ActionDef<S, A, M, F> {
  return def;
}

export type SystemAction = JsonValue & { readonly kind: string };

/** Extract the action payload union from a readonly ActionDef list. */
export type ActionPayloadUnion<T> = T extends readonly ActionDef<
  never,
  infer A,
  never,
  never
>[]
  ? A
  : T extends readonly (infer U)[]
    ? U extends ActionDef<never, infer A, never, never>
      ? A
      : never
    : never;
