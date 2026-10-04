import type fc from 'fast-check';

import type { HarnessDomainPack } from './harness-domain-pack';
import type { RestartClientOpts } from './lifecycle';
import type { SyncHarnessBase } from './harness-types';

/** One app mutation from one client — the `domain` pool action's argument. */
export type DomainOp = {
  readonly clientId: string;
  readonly mutation: string;
  readonly args: Record<string, unknown>;
};

/** One out-of-band server write — the `server` pool action's argument. */
export type ServerOp = {
  readonly name: string;
  readonly args: Record<string, unknown>;
};

export function domainOp(
  clientId: string,
  mutation: string,
  args: Record<string, unknown>
): DomainOp {
  return { clientId, mutation, args };
}

export function serverOp(
  name: string,
  args: Record<string, unknown>
): ServerOp {
  return { name, args };
}

export type SyncApp = {
  readonly pack: HarnessDomainPack;
  /** Arbitraries the `domain` pool action draws from (one per mutation shape). */
  readonly domainOpArbs: (ctx: {
    readonly clientIds: readonly string[];
  }) => fc.Arbitrary<DomainOp>[];
  /** Arbitraries the `server` pool action draws from. */
  readonly serverOpArbs?: (ctx: {
    readonly clientIds: readonly string[];
  }) => fc.Arbitrary<ServerOp>[];
  readonly serverOps?: Record<
    string,
    (surface: SyncHarnessBase, args: Record<string, unknown>) => Promise<void>
  >;
  /** App-specific schema restart options for `restartWithSchema` actions. */
  readonly restartOptsForVariant?: (variant: string) => RestartClientOpts;
};
