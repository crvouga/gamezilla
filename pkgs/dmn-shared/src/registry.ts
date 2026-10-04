/**
 * How a package binds a DMN spec to its implementation: one binding per spec
 * file, naming the implementation layers that must agree with the spec
 * (strategy § 5 — "application decision", "server enforcement", "client
 * gating", …). Each layer answers a generated case the way the product
 * would; the runner compares that answer with the spec's.
 *
 * Module-global, like `@pkgs/quint/registry`: the package's
 * `tests/decisions/<stem>.binding.ts` modules call {@link bindDecisions} and
 * `tests/decisions/index.ts` imports them all.
 */

import type { DecisionInput, DecisionOutput } from './evaluate';

export type DecisionContext<World> = {
  /** The decision the case belongs to. */
  readonly decisionId: string;
  /** The generated case (`tier=guest/plays today=20`). */
  readonly caseId: string;
  /** What the binding's `open` returned, once per layer run. */
  readonly world: World;
};

export type DecisionLayer<World = undefined> = {
  /** Outputs this layer can see (default: every output of the decision). */
  readonly observes?: readonly string[];
  /** The inputs this layer governs (default: all). */
  readonly applies?: (input: DecisionInput) => boolean;
  /** The implementation's answer for one case. */
  readonly decide: (
    input: DecisionInput,
    context: DecisionContext<World>
  ) => Promise<DecisionOutput> | DecisionOutput;
};

export type DecisionBinding<World = undefined> = {
  /** The spec this binds: its `.dmn` file's stem (`access`). */
  readonly spec: string;
  /** Decision ids to check (default: every decision in the file). */
  readonly decisions?: readonly string[];
  /** Layer name → how that layer answers. At least one. */
  readonly layers: Readonly<Record<string, DecisionLayer<World>>>;
  /** Build what the layers run in (a harness), once per layer run. */
  readonly open?: () => Promise<World> | World;
  readonly close?: (world: World) => Promise<void> | void;
  /** Per-layer test timeout. Default: the runner's. */
  readonly timeoutMs?: number;
};

type Registry = { readonly bindings: Map<string, DecisionBinding<unknown>> };

const REGISTRY_KEY = Symbol.for('dmn.registry');

function registry(): Registry {
  const host = globalThis as { [REGISTRY_KEY]?: Registry };
  host[REGISTRY_KEY] ??= { bindings: new Map() };
  return host[REGISTRY_KEY];
}

export function bindDecisions<World = undefined>(
  binding: DecisionBinding<World>
): void {
  const bindings = registry().bindings;
  if (bindings.has(binding.spec)) {
    throw new Error(`dmn: spec ${binding.spec} is bound twice`);
  }
  bindings.set(binding.spec, binding as DecisionBinding<unknown>);
}

export function decisionBinding(spec: string): DecisionBinding<unknown> {
  const binding = registry().bindings.get(spec);
  if (binding === undefined) {
    throw new Error(
      `dmn: spec ${spec}.dmn has no binding — add tests/decisions/${spec}.binding.ts calling bindDecisions({ spec: '${spec}', layers: { … } }) and import it from tests/decisions/index.ts`
    );
  }
  return binding;
}
