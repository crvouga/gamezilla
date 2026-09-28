/**
 * Behavior evidence: each scenario a run decides is one obligation of its
 * feature, `scenario:<scenario name>`, recorded through
 * `@pkgs/conformance/evidence-store` into the run's report bucket. A harness
 * run proves the `system` layer; a live run against a deployment proves
 * `release`. The bun test stays the gate — evidence is the record of it.
 */

import { type Layer, sha256 } from '@pkgs/conformance/evidence';
import { recordEvidence } from '@pkgs/conformance/evidence-store';

export type ScenarioVerdict = {
  /** The report bucket evidence goes into (`<reportDir>/evidence/`). */
  readonly reportDir: string;
  readonly packageName: string;
  /** Repo-relative feature path (`specs/friends/friend-remove.feature`). */
  readonly featureUri: string;
  /** The feature text the scenario was run from. */
  readonly featureSource: string;
  readonly layer: Layer;
  readonly scenarioName: string;
  readonly status: 'pass' | 'fail';
  readonly detail?: string | undefined;
};

export function scenarioObligationId(scenarioName: string): string {
  return `scenario:${scenarioName}`;
}

/** Record one decided scenario as an obligation of its feature. */
export function recordScenario(verdict: ScenarioVerdict): void {
  recordEvidence(verdict.reportDir, {
    specUri: verdict.featureUri,
    kind: 'behavior',
    specSha256: sha256(verdict.featureSource),
    packageName: verdict.packageName,
    obligations: [
      {
        id: scenarioObligationId(verdict.scenarioName),
        layer: verdict.layer,
        status: verdict.status,
        ...(verdict.detail === undefined ? {} : { detail: verdict.detail }),
      },
    ],
  });
}
