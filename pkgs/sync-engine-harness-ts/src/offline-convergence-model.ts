/**
 * "Offline == online": a model of people writing on 2–3 devices that drop
 * off the network, restart and come back, while one fault profile's
 * adversary strikes between commands. After the final heal every device
 * must hold what an always-online reference run of the same writes holds,
 * and every write the person was told was saved must be applied or refused.
 */

import type { Run } from '@pkgs/harness-root-shared-ts/run-types';
import fc from 'fast-check';
import type { FaultProfileName } from './fault-profiles';
import { FAULT_PROFILES } from './fault-profiles';
import type { FaultScenario, FaultSweepOutcome } from './fault-sweep';
import { runUnderFaultProfile } from './fault-sweep';
import type { WorkloadStep } from './offline-workload';
import { performWorkloadStep, WORKLOAD_NOTES } from './offline-workload';
import { addClient, online } from './regression-actions';
import { netSet, restart } from './regression-random-faults-actions';
import type { SyncHarness } from './scenario-system';

/** Devices and whose they are: the tablet is alice's second device. */
export const MODEL_DEVICES = [
  { id: 'phone', actorId: 'alice' },
  { id: 'laptop', actorId: 'bob' },
  { id: 'tablet', actorId: 'alice' },
] as const;

/** A write the person made, in the order they made it. */
export type ModelWrite = WorkloadStep & { readonly kind: 'append' | 'refused' };

export type ConvergenceModel = {
  readonly devices: readonly string[];
  /** Devices currently cut off, and whether the app was told. */
  readonly offline: Map<string, 'signal' | 'silent'>;
  readonly writes: ModelWrite[];
};

export type ConvergenceReal = {
  readonly scenario: FaultScenario;
};

type Cmd = fc.AsyncCommand<ConvergenceModel, ConvergenceReal>;

function deviceOf(model: ConvergenceModel, device: number): string {
  return model.devices[device % model.devices.length]!;
}

async function write(
  model: ConvergenceModel,
  real: ConvergenceReal,
  step: ModelWrite
): Promise<void> {
  const { s, chaos, ledger } = real.scenario;
  await chaos();
  const n = model.writes.length;
  model.writes.push(step);
  await performWorkloadStep(s, model.devices, step, { n, ledger });
}

function writeCmd(step: ModelWrite): Cmd {
  return {
    check: () => true,
    run: (m, r) => write(m, r, step),
    toString: () => `write(${JSON.stringify(step)})`,
  };
}

function offlineCmd(device: number, mode: 'signal' | 'silent'): Cmd {
  return {
    check: (m) => !m.offline.has(deviceOf(m, device)),
    async run(m, r) {
      const id = deviceOf(m, device);
      m.offline.set(id, mode);
      await cutOff(r.scenario.s, id, mode);
    },
    toString: () => `offline(${device}, ${mode})`,
  };
}

function onlineCmd(device: number): Cmd {
  return {
    check: (m) => m.offline.has(deviceOf(m, device)),
    async run(m, r) {
      const id = deviceOf(m, device);
      m.offline.delete(id);
      await r.scenario.s.apply(netSet, id, 'all', 'ok');
      await r.scenario.s.apply(online, id, true);
    },
    toString: () => `online(${device})`,
  };
}

function restartCmd(device: number): Cmd {
  return {
    check: () => true,
    async run(m, r) {
      const id = deviceOf(m, device);
      await r.scenario.s.apply(restart, id, { preserveLocalDb: true });
      // A restarted app asks the device again: it is still cut off.
      const mode = m.offline.get(id);
      if (mode !== undefined) await cutOff(r.scenario.s, id, mode);
    },
    toString: () => `restart(${device})`,
  };
}

function waitCmd(ms: number): Cmd {
  return {
    check: () => true,
    async run(_m, r) {
      await r.scenario.chaos();
      await r.scenario.s.advanceTime(ms);
    },
    toString: () => `wait(${ms})`,
  };
}

async function cutOff(
  s: Run<SyncHarness>,
  id: string,
  mode: 'signal' | 'silent'
): Promise<void> {
  if (mode === 'signal') await s.apply(online, id, false);
  else await s.apply(netSet, id, 'all', 'down');
}

const MAX_WAIT_MS = 30_000;

/** Commands over `devices` devices (indices wrap, so shrinking stays valid). */
export function arbConvergenceCommands(
  devices: number
): fc.Arbitrary<Iterable<Cmd>> {
  const device = fc.nat(devices - 1);
  return fc.commands(
    [
      fc
        .record({ device, note: fc.nat(WORKLOAD_NOTES - 1) })
        .map((w) => writeCmd({ kind: 'append', ...w })),
      device.map((d) => writeCmd({ kind: 'refused', device: d })),
      fc
        .tuple(device, fc.constantFrom('signal' as const, 'silent' as const))
        .map(([d, mode]) => offlineCmd(d, mode)),
      device.map((d) => onlineCmd(d)),
      device.map((d) => restartCmd(d)),
      fc.integer({ min: 1, max: MAX_WAIT_MS }).map((ms) => waitCmd(ms)),
    ],
    { maxCommands: 24 }
  );
}

async function openModelDevices(
  s: Run<SyncHarness>,
  count: number
): Promise<string[]> {
  const devices = MODEL_DEVICES.slice(0, count);
  for (const d of devices) {
    await s.apply(addClient, { id: d.id, actorId: d.actorId });
  }
  return devices.map((d) => d.id);
}

/** Run the commands on a network with `profile`'s faults, then heal. */
export async function runConvergenceModel(args: {
  readonly profile: FaultProfileName;
  readonly seed: number;
  readonly devices: number;
  readonly commands: Iterable<Cmd>;
}): Promise<{ outcome: FaultSweepOutcome; writes: readonly ModelWrite[] }> {
  const writes: ModelWrite[] = [];
  const outcome = await runUnderFaultProfile({
    profile: FAULT_PROFILES[args.profile],
    seed: args.seed,
    body: async (scenario) => {
      const devices = await openModelDevices(scenario.s, args.devices);
      const model: ConvergenceModel = {
        devices,
        offline: new Map(),
        writes,
      };
      await fc.asyncModelRun(
        () => ({ model, real: { scenario } }),
        args.commands
      );
    },
  });
  return { outcome, writes };
}

/** The same writes, in the same order, on a reliable always-online network. */
export async function runOnlineReference(args: {
  readonly seed: number;
  readonly devices: number;
  readonly writes: readonly ModelWrite[];
}): Promise<FaultSweepOutcome> {
  return runUnderFaultProfile({
    profile: FAULT_PROFILES.reliable,
    seed: args.seed,
    body: async ({ s, ledger }) => {
      const devices = await openModelDevices(s, args.devices);
      for (const [n, step] of args.writes.entries()) {
        await performWorkloadStep(s, devices, step, { n, ledger });
      }
    },
  });
}

const PIECE = /<[^>]+>/g;

/**
 * A node's notes as id → sorted pieces. Appends from devices that were
 * offline land in upload order, not typing order, so order is not part of
 * the converged state; which pieces each note holds is.
 */
export function normalizeNotes(
  notes: Readonly<Record<string, string>>
): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const id of Object.keys(notes).sort()) {
    out[id] = [...(notes[id]!.match(PIECE) ?? [])].sort();
  }
  return out;
}

/** Nodes whose converged notes differ from the reference server's. */
export function divergentNodes(
  actual: FaultSweepOutcome,
  reference: FaultSweepOutcome
): string[] {
  const expected = JSON.stringify(normalizeNotes(reference.notes['server']!));
  return Object.entries(actual.notes)
    .filter(([, notes]) => JSON.stringify(normalizeNotes(notes)) !== expected)
    .map(([node]) => node)
    .sort();
}
