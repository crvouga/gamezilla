// @io-wall-ok — reads the model's text and writes its evidence file into the report bucket.
/**
 * Machine evidence for one Quint model run (`@pkgs/conformance/evidence`):
 * each obligation the run decides, recorded into the package's report bucket
 * as soon as its test decides it. The test stays the gate — a failed
 * obligation fails its test too; the evidence is the record.
 *
 *   id               layer            decided by
 *   shape            specification    static shape (`./shape`), before any trace
 *   typecheck        specification    `quint typecheck`
 *   verify           specification    Apalache, every invariant up to the bound
 *                                     (recorded by the package's `check:models`)
 *   temporal:<name>  specification    TLC, complete finite graph and cycles
 *   simulate         specification    every invariant held while drawing traces;
 *                                     no invariant is a failure
 *   trace:<n>        implementation   the product agreed with trace n
 *   bound-actions    completeness     the traces took every bound action
 *   determinism      implementation   a trace replayed twice ends the same
 */

import { readFileSync } from 'node:fs';

import {
  type Layer,
  type Obligation,
  sha256,
} from '@pkgs/conformance/evidence';
import { recordEvidence } from '@pkgs/conformance/evidence-store';

export type ModelEvidenceInput = {
  readonly packageName: string;
  /** Absolute path of the `.qnt` model. */
  readonly specPath: string;
  /** Repo-relative path, as reported. */
  readonly specUri: string;
  readonly reportDir: string;
};

/** Record one decided obligation of the model. */
export type RecordObligation = (obligation: Obligation) => void;

export function modelEvidence(input: ModelEvidenceInput): RecordObligation {
  const specSha256 = sha256(readFileSync(input.specPath, 'utf8'));
  return (obligation) =>
    recordEvidence(input.reportDir, {
      specUri: input.specUri,
      kind: 'dynamics',
      specSha256,
      packageName: input.packageName,
      obligations: [obligation],
    });
}

/** At most this much of a failure goes into the evidence file. */
const DETAIL_CHARS = 2000;

export function failureDetail(cause: unknown): string {
  const text = cause instanceof Error ? cause.message : String(cause);
  return text.length <= DETAIL_CHARS ? text : `${text.slice(0, DETAIL_CHARS)}…`;
}

/**
 * Run `body` as obligation `id`: record `pass` (with the detail `body`
 * returns) or `fail` (with why), then rethrow a failure so the test fails.
 */
export async function decide(input: {
  readonly record: RecordObligation;
  readonly id: string;
  readonly layer: Layer;
  readonly body: () => Promise<string | undefined> | string | undefined;
}): Promise<void> {
  const { record, id, layer } = input;
  let detail: string | undefined;
  try {
    detail = await input.body();
  } catch (cause) {
    record({ id, layer, status: 'fail', detail: failureDetail(cause) });
    throw cause;
  }
  record(
    detail === undefined
      ? { id, layer, status: 'pass' }
      : { id, layer, status: 'pass', detail }
  );
}
