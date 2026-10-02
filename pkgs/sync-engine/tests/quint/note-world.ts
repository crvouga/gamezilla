/**
 * The world a `specs/sync-engine/note-replication.qnt` trace runs in: one `exampleSystem` run
 * per trace, observed on its virtual clock so asynchronous convergence gets
 * the time a person would give it.
 */

import type { Run } from '@pkgs/harness';
import { setQuintWorld } from '@pkgs/quint/registry';
import { exampleSystem, type SyncHarness } from '@pkgs/sync-engine/harness';

export type NoteWorld = {
  readonly s: Run<SyncHarness>;
  /** Mutation ids whose confirmation was dropped, by person. */
  readonly owed: Map<string, string>;
  /** People with a second window of the app open on their device. */
  readonly windows: Set<string>;
  /** Recovery traces keep each device's connection and first acceptance independent. */
  readonly recovery: {
    readonly offline: Set<string>;
    readonly accepted: Set<string>;
  };
};

/** How long the product may take to reach the model's state after a step. */
const SETTLE_MS = 15_000;
const SETTLE_STEP_MS = 100;

export function useNoteWorld(): void {
  setQuintWorld<NoteWorld>({
    create: async (ctx) => ({
      s: await exampleSystem.run({
        seed: ctx.trace,
        args: { clientCount: 0 },
      }),
      owed: new Map(),
      windows: new Set(),
      recovery: { offline: new Set(), accepted: new Set() },
    }),
    dispose: (w) => w.s[Symbol.asyncDispose](),
    record: (w, meta, fn) =>
      w.s.record({ kind: 'quint', title: meta.title, detail: meta.detail }, fn),
    settle: async (w, matches) => {
      try {
        await w.s.until(() => matches(), {
          maxMs: SETTLE_MS,
          stepMs: SETTLE_STEP_MS,
        });
      } catch {
        // Still apart: the bridge reads once more and reports the difference.
      }
    },
  });
}
