// @io-wall-ok — reads the spec file and leaves Alloy's inputs and receipts in the report bucket.
/**
 * Run a structure spec (`specs/<context>/<stem>.als`) under `bun test`: one
 * `describe` per spec, one `test` that model-checks every command within its
 * scope, and one `test` per bound adapter requiring every snapshot it reads
 * back to be a legal world of the model. Each test records its obligations
 * as evidence (`kind: 'structure'`) and fails when one fails. The generated
 * stub (`.cache/spec/<name>.als.test.ts`) imports the package's structure
 * entry (which registers the bindings) and calls {@link runStructureSpec}.
 */

import { describe, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { basename, join } from 'node:path';
import { type Obligation, sha256 } from '@pkgs/conformance/evidence';
import { recordEvidence } from '@pkgs/conformance/evidence-store';

import { type ExecAlloyResult, execAlloy } from './alloy-cli';
import { auditSnapshots, illegalSnapshotReport } from './audit';
import { commandVerdict } from './receipt';
import { type StructureBinding, structureBinding } from './registry';
import type { Snapshot } from './snapshot';

export type RunStructureOptions = {
  readonly packageName: string;
  /** Absolute path of the `.als` model. */
  readonly specPath: string;
  /** Repo-relative path, as reported (`specs/spaces/spaces.als`). */
  readonly specUri: string;
  /** The package's report bucket; Alloy's files land in `alloy/<stem>/`. */
  readonly reportDir: string;
};

/** Each test starts a JVM (about a second) and may wait on a product store. */
export const STRUCTURE_TEST_TIMEOUT_MS = 180_000;

type Recorder = (obligations: readonly Obligation[]) => void;

function modelCheckFailures(checked: ExecAlloyResult): string[] {
  return checked.commands.flatMap((command) => {
    const verdict = commandVerdict(command);
    if (verdict.pass) return [];
    const instance = command.instance === null ? '' : `\n${command.instance}`;
    return [`${verdict.detail}${instance.replace(/\n/g, '\n    ')}`];
  });
}

function checkModel(
  checked: () => ExecAlloyResult,
  record: Recorder
): () => void {
  return () => {
    let result: ExecAlloyResult;
    try {
      result = checked();
    } catch (cause) {
      const detail = cause instanceof Error ? cause.message : String(cause);
      record([
        { id: 'commands', layer: 'specification', status: 'fail', detail },
      ]);
      throw cause;
    }
    if (result.commands.length === 0) {
      const detail = 'the model declares no check or run command';
      record([
        { id: 'commands', layer: 'specification', status: 'fail', detail },
      ]);
      throw new Error(detail);
    }
    record(
      result.commands.map((command) => {
        const verdict = commandVerdict(command);
        return {
          id: `command:${command.name}`,
          layer: 'specification',
          status: verdict.pass ? 'pass' : 'fail',
          detail: verdict.detail,
        };
      })
    );
    const failures = modelCheckFailures(result);
    if (failures.length > 0) {
      throw new Error(
        `${String(failures.length)} commands fail:\n  ${failures.join('\n  ')}`
      );
    }
  };
}

function auditAdapter(input: {
  readonly stem: string;
  readonly adapter: string;
  readonly load: () => Promise<readonly Snapshot[]>;
  readonly source: string;
  readonly checked: () => ExecAlloyResult;
  readonly workDir: string;
  readonly record: Recorder;
}): () => Promise<void> {
  const id = `snapshots:${input.adapter}`;
  const fail = (detail: string) => {
    input.record([{ id, layer: 'implementation', status: 'fail', detail }]);
    return new Error(detail);
  };
  return async () => {
    let report: string | null;
    let count: number;
    try {
      const snapshots = await input.load();
      count = snapshots.length;
      if (count === 0) {
        throw new Error(
          `${input.adapter} gave no snapshots — nothing was audited, so there is no evidence`
        );
      }
      const verdicts = await auditSnapshots({
        modelSource: input.source,
        snapshots,
        sigs: input.checked().sigs,
        name: input.stem,
        workDir: input.workDir,
      });
      report = illegalSnapshotReport(snapshots, verdicts);
    } catch (cause) {
      throw fail(cause instanceof Error ? cause.message : String(cause));
    }
    if (report !== null) throw fail(report);
    input.record([
      {
        id,
        layer: 'implementation',
        status: 'pass',
        detail: `${String(count)} snapshots`,
      },
    ]);
  };
}

function registerAdapters(input: {
  readonly options: RunStructureOptions;
  readonly stem: string;
  readonly source: string;
  readonly checked: () => ExecAlloyResult;
  readonly record: Recorder;
}): void {
  let binding: StructureBinding;
  try {
    binding = structureBinding(input.stem);
    if (Object.keys(binding.snapshots).length === 0) {
      throw new Error(
        `alloy: the binding of ${input.stem} names no snapshot adapter`
      );
    }
  } catch (cause) {
    test('binds its snapshot adapters', () => {
      const detail = cause instanceof Error ? cause.message : String(cause);
      input.record([
        { id: 'snapshots', layer: 'implementation', status: 'fail', detail },
      ]);
      throw cause;
    });
    return;
  }
  for (const [adapter, load] of Object.entries(binding.snapshots).sort(
    ([a], [b]) => (a < b ? -1 : 1)
  )) {
    test(
      `every ${adapter} snapshot is a legal world`,
      auditAdapter({
        stem: input.stem,
        adapter,
        load,
        source: input.source,
        checked: input.checked,
        workDir: join(
          input.options.reportDir,
          'alloy',
          input.stem,
          adapter.replace(/\W+/g, '-')
        ),
        record: input.record,
      }),
      STRUCTURE_TEST_TIMEOUT_MS
    );
  }
}

/** Register the spec's model check and snapshot audits. Call at module top level. */
export function runStructureSpec(options: RunStructureOptions): void {
  const stem = basename(options.specPath, '.als');
  describe(options.specUri, () => {
    const source = readFileSync(options.specPath, 'utf8');
    const record: Recorder = (obligations) =>
      recordEvidence(options.reportDir, {
        specUri: options.specUri,
        kind: 'structure',
        specSha256: sha256(source),
        packageName: options.packageName,
        obligations,
      });
    let result:
      | { readonly value: ExecAlloyResult }
      | { readonly error: unknown }
      | null = null;
    const checked = (): ExecAlloyResult => {
      if (result === null) {
        try {
          result = {
            value: execAlloy({
              source,
              name: stem,
              workDir: join(options.reportDir, 'alloy', stem, 'model'),
            }),
          };
        } catch (error) {
          result = { error };
        }
      }
      if ('error' in result) throw result.error;
      return result.value;
    };
    test(
      'every declared command has its expected verdict',
      checkModel(checked, record),
      STRUCTURE_TEST_TIMEOUT_MS
    );
    registerAdapters({ options, stem, source, checked, record });
  });
}
