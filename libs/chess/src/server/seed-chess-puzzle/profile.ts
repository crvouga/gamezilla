/**
 * Env-aware seed tuning presets. `auto` picks `managed` when CHECKPOINT is
 * denied (Neon, Supabase, …) and `fast` otherwise.
 */
import type { Cli } from './cli';

export type ResolvedSeedProfile = {
  /** Effective profile after `auto` resolution. */
  profileName: 'fast' | 'managed';
  managedDetected: boolean;
  batchSize: number;
  paceMs: number;
  /** 0 = disabled */
  checkpointEvery: number;
  progressEvery: number;
  deferIndexes: boolean;
  rebuildIndexes: boolean;
};

const FAST_PROFILE = {
  batchSize: 2000,
  paceMs: 0,
  checkpointEvery: 0,
  progressEvery: 50,
  deferIndexes: true,
  rebuildIndexes: false,
} as const;

const MANAGED_PROFILE = {
  batchSize: 1500,
  paceMs: 0,
  checkpointEvery: 0,
  progressEvery: 25,
  deferIndexes: true,
  rebuildIndexes: false,
} as const;

function resolveAutoProfileName(managed: boolean): 'fast' | 'managed' {
  return managed ? 'managed' : 'fast';
}

function pickBaseProfile(
  cli: Cli,
  managed: boolean
): {
  profileName: 'fast' | 'managed';
  base: typeof FAST_PROFILE | typeof MANAGED_PROFILE;
} {
  if (cli.profile === 'fast') {
    return { profileName: 'fast', base: FAST_PROFILE };
  }
  if (cli.profile === 'managed') {
    return { profileName: 'managed', base: MANAGED_PROFILE };
  }
  const profileName = resolveAutoProfileName(managed);
  return {
    profileName,
    base: profileName === 'managed' ? MANAGED_PROFILE : FAST_PROFILE,
  };
}

function wasExplicit(explicit: ReadonlySet<string>, flag: string): boolean {
  return explicit.has(flag);
}

export function resolveSeedProfile(args: {
  cli: Cli;
  managed: boolean;
}): ResolvedSeedProfile {
  const { cli, managed } = args;
  const { profileName, base } = pickBaseProfile(cli, managed);
  const explicit = cli.explicitTuning;

  return {
    profileName,
    managedDetected: managed,
    batchSize: wasExplicit(explicit, '--batch-size')
      ? cli.batchSize
      : base.batchSize,
    paceMs: wasExplicit(explicit, '--pace-ms') ? cli.paceMs : base.paceMs,
    checkpointEvery: wasExplicit(explicit, '--checkpoint-every')
      ? cli.checkpointEvery
      : base.checkpointEvery,
    progressEvery: wasExplicit(explicit, '--progress-every')
      ? cli.progressEvery
      : base.progressEvery,
    deferIndexes:
      wasExplicit(explicit, '--defer-indexes') ||
      wasExplicit(explicit, '--no-defer-indexes')
        ? cli.deferIndexes
        : base.deferIndexes,
    rebuildIndexes: wasExplicit(explicit, '--rebuild-indexes')
      ? cli.rebuildIndexes
      : base.rebuildIndexes,
  };
}

export function formatProfileLabel(
  cli: Cli,
  profile: ResolvedSeedProfile
): string {
  if (cli.profile !== 'auto') return cli.profile;
  return profile.profileName === 'managed' ? 'auto→managed' : 'auto→fast';
}
