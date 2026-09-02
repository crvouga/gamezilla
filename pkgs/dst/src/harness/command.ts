import type { Arbitrary } from 'fast-check';

import type { JsonValue } from '../kernel/json';

/** What a Command generator may consult: topology ids, knob values, edges. */
export type CommandGeneratorContext = {
  readonly nodeIds: (role: string) => readonly string[];
  readonly knobs: Readonly<Record<string, unknown>>;
  readonly edges: readonly {
    readonly fromRole: string;
    readonly toRole: string;
  }[];
};

/**
 * One external stimulus applied to the World.
 *
 * - `generate`: Workload generator for this Command's payload.
 * - `precondition(model, payload)`: reference-model guard (optional).
 * - `applyToModel(model, payload)`: advance the reference model (optional).
 * - `apply(world, payload)`: apply to the real World.
 *
 * TODO(dst-audit): `generate` consumes fast-check, not sim Choices (D5, Phase 3.2);
 * per-command postconditions are absent (Phase 4).
 */
// biome-ignore lint/suspicious/noExplicitAny: heterogeneous command payloads and worlds
export type CommandDef<P = any, M = object, W = any> = {
  readonly kind: string;
  readonly generate: (ctx: CommandGeneratorContext) => Arbitrary<P>;
  readonly apply: (world: W, payload: P) => Promise<void>;
  readonly precondition?: (model: M, payload: P) => boolean;
  readonly applyToModel?: (model: M, payload: P) => void;
  readonly weight?: number;
};

// biome-ignore lint/suspicious/noExplicitAny: heterogeneous command payloads and worlds
export type UnboundCommandDef<P = any, M = object, W = any> = Omit<
  CommandDef<P, M, W>,
  'kind'
>;

// biome-ignore lint/suspicious/noExplicitAny: heterogeneous command payloads and worlds
export function command<P = any, M = object, W = any>(
  def: UnboundCommandDef<P, M, W>
): UnboundCommandDef<P, M, W> {
  return def;
}

// biome-ignore lint/suspicious/noExplicitAny: heterogeneous command payloads and worlds
export function bindCommandKind<P = any, M = object, W = any>(
  kind: string,
  def: UnboundCommandDef<P, M, W>
): CommandDef<P, M, W> {
  return { kind, ...def };
}

/** Serialized Command payload as it appears in a Repro. */
export type Command = JsonValue & { readonly kind: string };
