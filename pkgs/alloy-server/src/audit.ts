/**
 * Audit snapshots of persisted state against a structure model: is each one
 * a legal world? Every snapshot that can be pinned becomes a predicate
 * appended to the model, and Alloy runs them all in one JVM; a snapshot is
 * legal iff Alloy finds its instance. This is the comparison the
 * `@pkgs/alloy/bun-test` bridge gates on — product packages call it directly
 * to prove a corrupted snapshot is caught.
 */

import { join } from 'node:path';

import { execAlloy, probeSigs } from './alloy-cli';
import type { SigInfo } from '@pkgs/alloy-shared/sigs';
import { stripAlloyComments } from '@pkgs/alloy-shared/sigs';
import { modelProblems, renderSnapshot, snapshotPredicate, snapshotProblems } from '@pkgs/alloy-shared/snapshot';
import type { Snapshot } from '@pkgs/alloy-shared/world';

export type SnapshotVerdict = {
  readonly label: string;
  readonly legal: boolean;
  /** Why it is not legal; empty when it is. */
  readonly problems: readonly string[];
};

export type AuditOptions = {
  /** The `.als` model text. */
  readonly modelSource: string;
  readonly snapshots: readonly Snapshot[];
  /**
   * The model's sigs, as {@link execAlloy} returned them when the model was
   * checked. Without them one more JVM reads them from the model.
   */
  readonly sigs?: readonly SigInfo[];
  /** File stem for Alloy's messages. Default `model`. */
  readonly name?: string;
  /** Keep the generated `.als` and the receipt here. */
  readonly workDir?: string;
};

const ILLEGAL =
  'Alloy finds no legal world equal to this snapshot: it breaks a fact or a field multiplicity of the model';

/** Snapshot commands share the widest integer scope declared by the model. */
function integerScope(source: string): number {
  const scopes = [...stripAlloyComments(source).matchAll(/\b(\d+)\s+Int\b/g)];
  return Math.max(4, ...scopes.map((scope) => Number(scope[1])));
}

export async function auditSnapshots(
  options: AuditOptions
): Promise<readonly SnapshotVerdict[]> {
  const name = options.name ?? 'model';
  const dirs =
    options.workDir === undefined
      ? {}
      : { workDir: options.workDir, probeDir: join(options.workDir, 'probe') };
  const sigs =
    options.sigs ??
    probeSigs({
      source: options.modelSource,
      name,
      ...(dirs.probeDir === undefined ? {} : { workDir: dirs.probeDir }),
    });
  const blocked = modelProblems(sigs);
  if (blocked.length > 0) {
    throw new Error(
      `alloy: snapshots of ${name} cannot be audited:\n  ${blocked.join('\n  ')}`
    );
  }
  const problems = options.snapshots.map((s) => snapshotProblems(s, sigs));
  const predicates = options.snapshots.flatMap((snapshot, i) =>
    (problems[i] ?? []).length === 0
      ? [
          snapshotPredicate(
            snapshot,
            sigs,
            i,
            integerScope(options.modelSource)
          ),
        ]
      : []
  );
  const solved =
    predicates.length === 0
      ? new Map<string, boolean>()
      : new Map(
          execAlloy({
            source: `${options.modelSource}\n\n${predicates.join('\n')}`,
            name: `${name}-snapshots`,
            command: 'snapshot_*',
            ...(dirs.workDir === undefined ? {} : { workDir: dirs.workDir }),
          }).commands.map((command) => [command.name, command.sat])
        );
  return options.snapshots.map((snapshot, i) => {
    const found = problems[i] ?? [];
    if (found.length > 0) {
      return { label: snapshot.label, legal: false, problems: found };
    }
    const sat = solved.get(`snapshot_${String(i)}`);
    const legal = sat === true;
    const why = sat === undefined ? 'Alloy did not run its predicate' : ILLEGAL;
    return { label: snapshot.label, legal, problems: legal ? [] : [why] };
  });
}

/**
 * Every illegal snapshot with its atoms, relations and problems, or `null`
 * when all are legal — the message the bridge fails with.
 */
export function illegalSnapshotReport(
  snapshots: readonly Snapshot[],
  verdicts: readonly SnapshotVerdict[]
): string | null {
  const illegal = verdicts.flatMap((verdict, i) => {
    const snapshot = snapshots[i];
    if (verdict.legal || snapshot === undefined) return [];
    const indent = (text: string) => text.replace(/^/gm, '    ');
    return [
      [
        `snapshot "${verdict.label}" is not a legal world:`,
        ...verdict.problems.map((p) => `  - ${p}`),
        indent(renderSnapshot(snapshot)),
      ].join('\n'),
    ];
  });
  if (illegal.length === 0) return null;
  return `${String(illegal.length)} of ${String(verdicts.length)} snapshots are not legal worlds:\n\n${illegal.join('\n\n')}`;
}
