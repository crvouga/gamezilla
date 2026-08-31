import type { Arbitrary } from 'fast-check';
import type { JsonValue } from './json';
import type { DstWorld } from './world-types';

export type LibraryArbContext = {
  readonly roleIds: (role: string) => readonly string[];
  readonly knobs: Readonly<Record<string, JsonValue>>;
};

export type LibraryDef<S = unknown> = {
  readonly kind: string;
  readonly arb: (ctx: LibraryArbContext) => Arbitrary<JsonValue>;
  readonly dispatch: (world: DstWorld<S>, action: JsonValue) => Promise<void>;
  /** When set, used instead of `action.kind === kind` for routing. */
  readonly match?: (action: JsonValue & { readonly kind?: string }) => boolean;
  readonly allows?: (model: object, action: JsonValue) => boolean;
  readonly apply?: (model: object, action: JsonValue) => void;
};

export function defineLibrary<S = unknown>(def: LibraryDef<S>): LibraryDef<S> {
  return def;
}
