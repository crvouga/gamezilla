// @io-wall-ok — reads the spec file and writes evidence into the report bucket.
/**
 * Run a DMN spec under `bun test`: one `describe` per spec file with a test
 * per obligation —
 *
 * - `is well-formed`: the file parses (evidence `valid`);
 * - `<decision> answers every case (complete)` and
 *   `<decision> never answers twice (consistent)`: the table over its
 *   declared domain (`complete:<id>`, `consistent:<id>`);
 * - `is bound to the implementation`: the package's binding names decisions
 *   the file has and at least one layer (`bound`);
 * - `<decision>: the <layer> agrees`: every generated case the layer
 *   governs, compared on what it observes (`agree:<id>:<layer>`).
 *
 * Each test records its obligation in the report bucket before it passes or
 * fails: evidence is the record, the test is the gate. The runner-generated
 * stub (`.cache/spec/<name>.dmn.test.ts`) imports the package's decisions
 * entry (which registers the bindings) and calls {@link runDecisionSpec}.
 */

import { describe, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { basename } from 'node:path';
import { recordEvidence } from '@pkgs/conformance-server/evidence-store';
import type { Obligation } from '@pkgs/conformance-shared/evidence';
import { sha256 } from '@pkgs/conformance-shared/evidence';
import type { Overlap } from '@pkgs/dmn-shared/analyze';
import { gaps, overlaps } from '@pkgs/dmn-shared/analyze';
import { generateCases } from '@pkgs/dmn-shared/cases';
import {
  bindingProblems,
  compareLayer,
  formatMismatches,
} from '@pkgs/dmn-shared/compare';
import type { DmnDecision, DmnDefinitions } from '@pkgs/dmn-shared/model';
import { findDecision, parseDmn } from '@pkgs/dmn-shared/model';
import type { DecisionBinding } from '@pkgs/dmn-shared/registry';
import { decisionBinding } from '@pkgs/dmn-shared/registry';

export type RunDecisionSpecOptions = {
  readonly packageName: string;
  /** Absolute path of the `.dmn` file. */
  readonly specPath: string;
  /** Repo-relative path, as reported (`specs/billing/access.dmn`). */
  readonly specUri: string;
  /** The package's report bucket; evidence lands in `evidence/`. */
  readonly reportDir: string;
};

type Settle = (obligation: Obligation) => void;

const SHOWN = 20;

/** Register the spec's tests with `bun test`. Call at module top level. */
export function runDecisionSpec(options: RunDecisionSpecOptions): void {
  const text = readFileSync(options.specPath, 'utf8');
  const settle = settler(options, sha256(text));
  const parsed = parseDmn(text);
  describe(options.specUri, () => {
    test('is well-formed', () => {
      settle(
        parsed.ok
          ? {
              id: 'valid',
              layer: 'specification',
              status: 'pass',
              detail: `decisions: ${parsed.definitions.decisions.map((d) => d.id).join(', ')}`,
            }
          : {
              id: 'valid',
              layer: 'specification',
              status: 'fail',
              detail: parsed.issues.join('\n'),
            }
      );
    });
    if (!parsed.ok) return;
    for (const decision of parsed.definitions.decisions) {
      registerTableTests(decision, settle);
    }
    registerLayerTests({
      definitions: parsed.definitions,
      spec: basename(options.specPath, '.dmn'),
      settle,
    });
  });
}

function settler(options: RunDecisionSpecOptions, specSha256: string): Settle {
  return (obligation) => {
    recordEvidence(options.reportDir, {
      specUri: options.specUri,
      kind: 'decisions',
      specSha256,
      packageName: options.packageName,
      obligations: [obligation],
    });
    if (obligation.status === 'fail') {
      throw new Error(`${obligation.id}: ${obligation.detail ?? 'failed'}`);
    }
  };
}

function registerTableTests(decision: DmnDecision, settle: Settle): void {
  test(`${decision.id} answers every case (complete)`, () => {
    const found = gaps(decision);
    const listed = found
      .slice(0, SHOWN)
      .map((g) => `- ${renderRegion(g.region)}`);
    settle({
      id: `complete:${decision.id}`,
      layer: 'specification',
      status: found.length === 0 ? 'pass' : 'fail',
      detail:
        found.length === 0
          ? 'every input combination has an answer'
          : `no rule answers ${String(found.length)} input regions:\n${listed.join('\n')}`,
    });
  });
  test(`${decision.id} never answers twice (consistent)`, () => {
    const found = overlaps(decision);
    settle({
      id: `consistent:${decision.id}`,
      layer: 'specification',
      status: found.length === 0 ? 'pass' : 'fail',
      detail:
        found.length === 0
          ? consistentDetail(decision)
          : `${String(found.length)} input regions are answered more than once (hit policy ${decision.hitPolicy}):\n${renderOverlaps(found)}`,
    });
  });
}

function consistentDetail(decision: DmnDecision): string {
  return decision.hitPolicy === 'FIRST' || decision.hitPolicy === 'PRIORITY'
    ? `hit policy ${decision.hitPolicy} resolves overlapping rules`
    : 'no input combination is answered twice';
}

function renderOverlaps(found: readonly Overlap[]): string {
  return found
    .slice(0, SHOWN)
    .map((o) => `- ${renderRegion(o.region)}: rules ${o.rules.join(', ')}`)
    .join('\n');
}

function renderRegion(region: Readonly<Record<string, string>>): string {
  return Object.entries(region)
    .map(([name, label]) => `${name}=${label}`)
    .join(', ');
}

function registerLayerTests(input: {
  definitions: DmnDefinitions;
  spec: string;
  settle: Settle;
}): void {
  const { definitions, spec, settle } = input;
  let binding: DecisionBinding<unknown>;
  try {
    binding = decisionBinding(spec);
  } catch (cause) {
    test('is bound to the implementation', () => {
      settle({
        id: 'bound',
        layer: 'implementation',
        status: 'fail',
        detail: (cause as Error).message,
      });
    });
    return;
  }
  const problems = bindingProblems(definitions, binding);
  const ids = binding.decisions ?? definitions.decisions.map((d) => d.id);
  test('is bound to the implementation', () => {
    settle({
      id: 'bound',
      layer: 'implementation',
      status: problems.length === 0 ? 'pass' : 'fail',
      detail:
        problems.length === 0
          ? `${String(Object.keys(binding.layers).length)} layers over ${ids.join(', ')}`
          : problems.join('\n'),
    });
  });
  if (problems.length > 0) return;
  for (const id of ids) {
    const decision = findDecision(definitions, id);
    if (decision === undefined) continue;
    for (const layerName of Object.keys(binding.layers)) {
      registerLayerTest({ binding, decision, layerName, settle });
    }
  }
}

function registerLayerTest(input: {
  binding: DecisionBinding<unknown>;
  decision: DmnDecision;
  layerName: string;
  settle: Settle;
}): void {
  const { binding, decision, layerName, settle } = input;
  const layer = binding.layers[layerName];
  if (layer === undefined) return;
  const id = `agree:${decision.id}:${layerName}`;
  const body = async () => {
    const cases = generateCases(decision);
    const world = binding.open === undefined ? undefined : await binding.open();
    let result: Awaited<ReturnType<typeof compareLayer>>;
    try {
      result = await compareLayer({ decision, cases, layer, world });
    } finally {
      await binding.close?.(world);
    }
    const { checked, mismatches } = result;
    if (checked === 0) {
      settle({
        id,
        layer: 'implementation',
        status: 'fail',
        detail: `the ${layerName} governs none of the ${String(cases.length)} cases — a layer that checks nothing proves nothing`,
      });
      return;
    }
    settle(
      mismatches.length === 0
        ? {
            id,
            layer: 'implementation',
            status: 'pass',
            detail: `${String(checked)} cases`,
          }
        : {
            id,
            layer: 'implementation',
            status: 'fail',
            detail: `${String(mismatches.length)} of ${String(checked)} cases disagree with the spec:\n${formatMismatches(mismatches, SHOWN)}`,
          }
    );
  };
  const name = `${decision.id}: the ${layerName} agrees`;
  if (binding.timeoutMs === undefined) test(name, body);
  else test(name, body, binding.timeoutMs);
}
