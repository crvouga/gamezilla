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
 *
 * Every failure message starts with the environment and the objective file
 * (`[prd] specs/runtime/request-success.openslo.yaml: …`), and every failed
 * objective or firing policy also leaves an `ObjectiveFailure` in the report
 * bucket's `failures/` (`writeFailure`), the numbers and response whoever
 * answers it needs.
 */

import { describe, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { recordEvidence } from '@pkgs/conformance-server-ts/evidence-store';
import type { Obligation } from '@pkgs/conformance-shared-ts/evidence';
import { sha256 } from '@pkgs/conformance-shared-ts/evidence';
import type { ObjectiveResult } from '@pkgs/openslo-shared-ts/check';
import {
  bindingIssues,
  measureSlo,
  objectiveId,
} from '@pkgs/openslo-shared-ts/check';
import type { AlertResult } from '@pkgs/openslo-shared-ts/check-alerts';
import { bundleFor, measureAlerts } from '@pkgs/openslo-shared-ts/check-alerts';
import type { ObjectiveFailure } from '@pkgs/openslo-shared-ts/failure';
import { failureMessage, failureWhere } from '@pkgs/openslo-shared-ts/failure';
import type { Objective, OpenSloDoc, Slo } from '@pkgs/openslo-shared-ts/model';
import { parseOpenSlo } from '@pkgs/openslo-shared-ts/parse';
import type { ObjectivesBinding } from '@pkgs/openslo-shared-ts/registry';
import {
  objectiveSpecStem,
  objectivesBinding,
} from '@pkgs/openslo-shared-ts/registry';
import { writeFailure } from './failures';

export type RunObjectiveOptions = {
  readonly packageName: string;
  /** Absolute path of the `.openslo.yaml` file. */
  readonly specPath: string;
  /** Repo-relative path, as reported (`specs/sync-engine/note-delivery.openslo.yaml`). */
  readonly specUri: string;
  /** The package's report bucket; evidence lands in `evidence/`, failures in `failures/`. */
  readonly reportDir: string;
  /** The environment measured (`prd`): named in every failure message. */
  readonly environment?: string;
};

type RecordObligation = (obligation: Obligation) => void;

/** Where a file's checks report: the evidence, the failures, and where it ran. */
type Reporting = {
  readonly record: RecordObligation;
  readonly fail: (failure: ObjectiveFailure) => void;
  readonly specUri: string;
  readonly environment: string | null;
};

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
    const reporting: Reporting = {
      record,
      fail: (failure) => writeFailure(options.reportDir, failure),
      specUri: options.specUri,
      environment: options.environment ?? null,
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
          `${failureWhere(options.environment, options.specUri)} is not a well-formed objective:\n  ${parsed.issues.join('\n  ')}`
        );
      }
    });
    if (!parsed.ok) return;
    const stem = objectiveSpecStem(options.specPath);
    registerObjectives({ doc: parsed.doc, stem, reporting });
    const binding = lookup(stem);
    if (!(binding instanceof Error)) {
      registerAlerts({ doc: parsed.doc, binding, reporting });
    }
  });
}

function registerObjectives(input: {
  readonly doc: OpenSloDoc;
  readonly stem: string;
  readonly reporting: Reporting;
}): void {
  const { doc, reporting } = input;
  const { record } = reporting;
  const where = failureWhere(reporting.environment, reporting.specUri);
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
    if (issues.length > 0) throw new Error(`${where}: ${detail}`);
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
        const quiet =
          evaluation.noEvidence === true &&
          !(binding instanceof Error) &&
          binding.whenNoEvidence === 'quiet';
        const met = evaluation.met || quiet;
        const detail = `${evaluation.detail}; ${String(evaluation.considered)} considered${quiet ? '; too quiet to judge' : ''}`;
        if (met) {
          record({ id: result.id, layer, status: 'pass', detail });
          return;
        }
        const failure = objectiveFailure({
          reporting,
          slo,
          objective,
          evaluation,
          detail,
          binding,
        });
        const message = failureMessage(failure);
        record({ id: result.id, layer, status: 'fail', detail: message });
        reporting.fail(failure);
        throw new Error(message);
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
  readonly reporting: Reporting;
}): void {
  const { doc, binding, reporting } = input;
  const { record } = reporting;
  if (binding.alerting === undefined) return;
  const layer = binding.layer ?? 'implementation';
  for (const slo of doc.slos) {
    let measured: Promise<readonly AlertResult[]> | undefined;
    const bundle = bundleFor(doc, slo, binding.alerting.tiers?.(slo));
    for (const policy of bundle.policies) {
      const severity =
        bundle.conditions.find((c) => c.name === policy.conditions[0])
          ?.severity ?? 'alert';
      const body = async () => {
        measured ??= measureAlerts({ doc, slo, binding });
        const found = (await measured).find((r) => r.policy === policy.name);
        const quiet =
          found?.noEvidence === true && binding.whenNoEvidence === 'quiet';
        const ok = found?.ok === true || quiet;
        const detail = `${found?.detail ?? 'not evaluated'}${quiet ? '; too quiet to judge' : ''}`;
        const id = `alert:${slo.name}:${policy.name}`;
        if (ok) {
          record({ id, layer, status: 'pass', detail });
          return;
        }
        const failure: ObjectiveFailure = {
          ...sloFields(reporting, slo),
          check: { kind: 'alert', policy: policy.name, severity },
          target: slo.objectives[0]?.target ?? null,
          observed: null,
          considered: null,
          readings: found?.firing?.readings ?? [],
          budgetRemaining: found?.firing?.budgetRemaining ?? null,
          response: found?.firing?.response ?? null,
          detail,
        };
        const message = failureMessage(failure);
        record({ id, layer, status: 'fail', detail: message });
        reporting.fail(failure);
        throw new Error(message);
      };
      const name = `${slo.name} raises no ${severity} alert: ${policy.name}`;
      if (binding.timeoutMs === undefined) test(name, body);
      else test(name, body, binding.timeoutMs);
    }
  }
}

function sloFields(
  reporting: Reporting,
  slo: Slo
): Pick<
  ObjectiveFailure,
  | 'environment'
  | 'specUri'
  | 'slo'
  | 'sloDisplayName'
  | 'sloDescription'
  | 'window'
> {
  return {
    environment: reporting.environment,
    specUri: reporting.specUri,
    slo: slo.name,
    sloDisplayName: slo.displayName,
    sloDescription: slo.description,
    window: slo.timeWindow.duration,
  };
}

/** A missed objective, with the binding's response when it alerts. */
function objectiveFailure(input: {
  readonly reporting: Reporting;
  readonly slo: Slo;
  readonly objective: Objective;
  readonly evaluation: ObjectiveResult['evaluation'];
  readonly detail: string;
  readonly binding: ObjectivesBinding | Error;
}): ObjectiveFailure {
  const { slo, evaluation, binding } = input;
  return {
    ...sloFields(input.reporting, slo),
    check: { kind: 'objective', objective: input.objective.displayName },
    target: evaluation.target,
    observed: evaluation.observed,
    considered: evaluation.considered,
    readings: [],
    budgetRemaining: null,
    response: respondTo(binding, slo),
    detail: input.detail,
  };
}

function respondTo(
  binding: ObjectivesBinding | Error,
  slo: Slo
): ObjectiveFailure['response'] {
  if (binding instanceof Error || binding.alerting === undefined) return null;
  try {
    return binding.alerting.respond({
      slo,
      lookbackWindow: slo.timeWindow.duration,
    });
  } catch {
    return null;
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
