// @io-wall-ok — reads the objective file and writes evidence into the package's report bucket.
/**
 * Run an OpenSLO objective file under `bun test`: one `describe` per file,
 * one `test` that it is well-formed, one that the binding measures exactly
 * the indicators its SLOs use, and one per objective (`<slo> meets
 * "<displayName>"`) that measures and evaluates it. Each test records its
 * obligation as evidence (`valid`, `bound`, `objective:<slo>:<displayName>`)
 * and fails when the obligation does. The runner-generated stub
 * (`stubs.ts`) imports the package's openslo entry, which registers the
 * bindings, then calls {@link runObjectiveSpec}.
 */

import { describe, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { recordEvidence } from '@pkgs/conformance-server/evidence-store';
import type { Obligation } from '@pkgs/conformance-shared/evidence';
import { sha256 } from '@pkgs/conformance-shared/evidence';
import type { ObjectiveResult } from '@pkgs/openslo-shared/check';
import {
  bindingIssues,
  measureSlo,
  objectiveId,
} from '@pkgs/openslo-shared/check';
import type { AlertResult } from '@pkgs/openslo-shared/check-alerts';
import { bundleFor, measureAlerts } from '@pkgs/openslo-shared/check-alerts';
import type { Objective, OpenSloDoc, Slo } from '@pkgs/openslo-shared/model';
import { parseOpenSlo } from '@pkgs/openslo-shared/parse';
import type { ObjectivesBinding } from '@pkgs/openslo-shared/registry';
import {
  objectiveSpecStem,
  objectivesBinding,
} from '@pkgs/openslo-shared/registry';

export type RunObjectiveOptions = {
  readonly packageName: string;
  /** Absolute path of the `.openslo.yaml` file. */
  readonly specPath: string;
  /** Repo-relative path, as reported (`specs/sync-engine/note-delivery.openslo.yaml`). */
  readonly specUri: string;
  /** The package's report bucket; evidence lands in `evidence/`. */
  readonly reportDir: string;
};

type RecordObligation = (obligation: Obligation) => void;

/** Register the file's tests with `bun test`. Call at module top level. */
export function runObjectiveSpec(options: RunObjectiveOptions): void {
  describe(options.specUri, () => {
    const text = readFileSync(options.specPath, 'utf8');
    const record: RecordObligation = (obligation) => {
      recordEvidence(options.reportDir, {
        specUri: options.specUri,
        kind: 'objectives',
        specSha256: sha256(text),
        packageName: options.packageName,
        obligations: [obligation],
      });
    };
    const parsed = parseOpenSlo(text);
    test('is a well-formed objective', () => {
      const detail = parsed.ok
        ? `${String(parsed.doc.slis.length)} SLIs, ${String(parsed.doc.slos.length)} SLOs`
        : parsed.issues.join('\n');
      record({
        id: 'valid',
        layer: 'specification',
        status: parsed.ok ? 'pass' : 'fail',
        detail,
      });
      if (!parsed.ok) {
        throw new Error(
          `${options.specUri} is not a well-formed objective:\n  ${parsed.issues.join('\n  ')}`
        );
      }
    });
    if (!parsed.ok) return;
    const stem = objectiveSpecStem(options.specPath);
    registerObjectives({ doc: parsed.doc, stem, record });
    const binding = lookup(stem);
    if (!(binding instanceof Error)) {
      registerAlerts({ doc: parsed.doc, binding, record });
    }
  });
}

function registerObjectives(input: {
  readonly doc: OpenSloDoc;
  readonly stem: string;
  readonly record: RecordObligation;
}): void {
  const { doc, record } = input;
  const binding = lookup(input.stem);
  const layer =
    binding instanceof Error
      ? 'implementation'
      : (binding.layer ?? 'implementation');
  test('measures every indicator its objectives use', () => {
    const issues =
      binding instanceof Error
        ? [binding.message]
        : bindingIssues(doc, binding);
    const detail =
      issues.length === 0
        ? 'every indicator used has a measure'
        : issues.join('\n');
    record({
      id: 'bound',
      layer,
      status: issues.length === 0 ? 'pass' : 'fail',
      detail,
    });
    if (issues.length > 0) throw new Error(detail);
  });
  const measured = new Map<string, Promise<readonly ObjectiveResult[]>>();
  const resultsOf = (slo: Slo, found: ObjectivesBinding) => {
    const earlier = measured.get(slo.name);
    if (earlier !== undefined) return earlier;
    const results = measureSlo({ doc, slo, binding: found });
    measured.set(slo.name, results);
    return results;
  };
  for (const slo of doc.slos) {
    for (const objective of slo.objectives) {
      const decide = async (): Promise<ObjectiveResult> => {
        if (binding instanceof Error) return unbound(slo, objective, binding);
        const results = await resultsOf(slo, binding);
        return (
          results.find((r) => r.objective === objective.displayName) ??
          unbound(slo, objective, new Error('not evaluated'))
        );
      };
      const body = async () => {
        const result = await decideOrFail(decide, { slo, objective });
        const { evaluation } = result;
        const detail = `${evaluation.detail}; ${String(evaluation.considered)} considered`;
        record({
          id: result.id,
          layer,
          status: evaluation.met ? 'pass' : 'fail',
          detail,
        });
        if (!evaluation.met) {
          throw new Error(
            `${slo.name} does not meet "${objective.displayName}": ${detail}`
          );
        }
      };
      const name = `${slo.name} meets "${objective.displayName}"`;
      const timeoutMs =
        binding instanceof Error ? undefined : binding.timeoutMs;
      if (timeoutMs === undefined) test(name, body);
      else test(name, body, timeoutMs);
    }
  }
}

function registerAlerts(input: {
  readonly doc: OpenSloDoc;
  readonly binding: ObjectivesBinding;
  readonly record: RecordObligation;
}): void {
  const { doc, binding, record } = input;
  if (binding.alerting === undefined) return;
  const layer = binding.layer ?? 'implementation';
  for (const slo of doc.slos) {
    let measured: Promise<readonly AlertResult[]> | undefined;
    const bundle = bundleFor(doc, slo);
    for (const policy of bundle.policies) {
      const severity =
        bundle.conditions.find((c) => c.name === policy.conditions[0])
          ?.severity ?? 'alert';
      const body = async () => {
        measured ??= measureAlerts({ doc, slo, binding });
        const found = (await measured).find((r) => r.policy === policy.name);
        const detail = found?.detail ?? 'not evaluated';
        record({
          id: `alert:${slo.name}:${policy.name}`,
          layer,
          status: found?.ok === true ? 'pass' : 'fail',
          detail,
        });
        if (found?.ok !== true) throw new Error(detail);
      };
      const name = `${slo.name} raises no ${severity} alert: ${policy.name}`;
      if (binding.timeoutMs === undefined) test(name, body);
      else test(name, body, binding.timeoutMs);
    }
  }
}

function lookup(stem: string): ObjectivesBinding | Error {
  try {
    return objectivesBinding(stem);
  } catch (cause) {
    return cause instanceof Error ? cause : new Error(String(cause));
  }
}

/** A clock or window that throws still yields a failed obligation. */
async function decideOrFail(
  decide: () => Promise<ObjectiveResult>,
  at: { readonly slo: Slo; readonly objective: Objective }
): Promise<ObjectiveResult> {
  try {
    return await decide();
  } catch (cause) {
    return unbound(
      at.slo,
      at.objective,
      cause instanceof Error ? cause : new Error(String(cause))
    );
  }
}

function unbound(
  slo: Slo,
  objective: Objective,
  cause: Error
): ObjectiveResult {
  return {
    id: objectiveId(slo.name, objective.displayName),
    slo: slo.name,
    objective: objective.displayName,
    evaluation: {
      met: false,
      observed: null,
      target: objective.target,
      considered: 0,
      detail: cause.message,
    },
  };
}
