import { describe, expect, test } from 'bun:test';
import type {
  EvidenceRecord,
  Obligation,
} from '@pkgs/conformance-shared/evidence';
import type { ReportInput, ReportSpec } from '../conformance/evaluate';
import { evaluateLines } from '../conformance/evaluate';
import { EVIDENCE_MAP } from '../conformance/evidence-map';
import type { LineId } from '../conformance/lines';
import {
  decideVerdict,
  renderVerdict,
  specRevision,
} from '../conformance/verdict';

const FEATURE: ReportSpec = {
  path: 'specs/spaces/space-create.feature',
  context: 'spaces',
  kind: 'behavior',
  sha256: 'feature-now',
  bound: true,
  harness: true,
  live: false,
  accessibility: false,
  scenarios: ['A guest creates a space', 'A member creates a space'],
  temporalProperties: [],
};

const DECISIONS: ReportSpec = {
  path: 'specs/spaces/hosting-limit.dmn',
  context: 'spaces',
  kind: 'decisions',
  sha256: 'dmn-now',
  bound: true,
  harness: true,
  live: false,
  accessibility: false,
  scenarios: [],
  temporalProperties: [],
};

function record(
  spec: ReportSpec,
  obligations: readonly Obligation[],
  sha = spec.sha256
): EvidenceRecord {
  return {
    specUri: spec.path,
    kind: spec.kind,
    specSha256: sha,
    packageName: '@libs/spaces',
    obligations,
  };
}

const pass = (id: string, layer: Obligation['layer']): Obligation => ({
  id,
  layer,
  status: 'pass',
});

function input(overrides: Partial<ReportInput>): ReportInput {
  return {
    specs: [FEATURE, DECISIONS],
    records: [],
    malformed: [],
    closure: [],
    capabilities: [
      {
        id: 'host another open space',
        decision: 'hosting-limit',
        specUri: DECISIONS.path,
      },
    ],
    gateTasks: ['tc'],
    gates: new Map([['tc', { status: 'pass', detail: 'cached' }]]),
    ...overrides,
  };
}

function line(report: ReportInput, id: LineId) {
  const found = evaluateLines(report).find((l) => l.id === id);
  if (found === undefined) throw new Error(`no line ${id}`);
  return found;
}

describe('evaluateLines', () => {
  test('semantic decisions require conformance without a server permission agreement', () => {
    // regression: conformance-semantic-decision-server
    const semantic: ReportSpec = {
      ...DECISIONS,
      path: 'specs/chess/assistant-observation.dmn',
      context: 'chess',
    };
    const checked = input({
      specs: [DECISIONS, semantic],
      records: [
        record(DECISIONS, [
          pass('agree:hosting-limit:server', 'implementation'),
        ]),
        record(semantic, [
          pass(
            'agree:assistant-observation:semantic observation',
            'implementation'
          ),
        ]),
      ],
    });
    expect(line(checked, 'permission-enforcement')).toMatchObject({
      status: 'pass',
      total: 1,
    });
    expect(line(checked, 'decision-conformance')).toMatchObject({
      status: 'pass',
      total: 2,
    });
    expect(
      line(
        { ...checked, records: checked.records.slice(0, 1) },
        'decision-conformance'
      ).status
    ).toBe('fail');
    expect(
      line(
        { ...checked, records: checked.records.slice(1) },
        'permission-enforcement'
      ).status
    ).toBe('fail');
  });
  test('pure campaign evidence is required without claiming implementation conformance', () => {
    // regression: conformance-campaign-coverage
    const model: ReportSpec = {
      ...FEATURE,
      path: 'specs/system/access-sync.qnt',
      context: 'system',
      kind: 'dynamics',
      harness: false,
      scenarios: [],
    };
    const missing = input({ specs: [model], records: [] });
    expect(line(missing, 'model-checking').status).toBe('fail');
    expect(line(missing, 'trace-conformance').total).toBe(0);
    const checked = input({
      specs: [model],
      records: [record(model, [pass('campaign-symbolic', 'specification')])],
    });
    expect(line(checked, 'model-checking').status).toBe('pass');
    expect(line(checked, 'conformance-checks').status).toBe('pass');
  });
  test('a safety verdict cannot stand in for a declared progress obligation', () => {
    // regression: quint-temporal-obligations-unchecked
    const model: ReportSpec = {
      ...FEATURE,
      path: 'specs/sync-engine/note-recovery.qnt',
      kind: 'dynamics',
      scenarios: [],
      temporalProperties: ['liveEditsFinish', 'liveDevicesAgree'],
    };
    const safety = record(model, [pass('verify', 'specification')]);
    expect(
      line(input({ specs: [model], records: [safety] }), 'model-checking')
        .status
    ).toBe('fail');
    const oneProperty = record(model, [
      pass('temporal:liveEditsFinish', 'specification'),
    ]);
    expect(
      line(
        input({ specs: [model], records: [safety, oneProperty] }),
        'model-checking'
      ).status
    ).toBe('fail');
    const allProperties = record(model, [
      pass('temporal:liveDevicesAgree', 'specification'),
    ]);
    expect(
      line(
        input({
          specs: [model],
          records: [safety, oneProperty, allProperties],
        }),
        'model-checking'
      ).status
    ).toBe('pass');
  });
  test('missing evidence fails', () => {
    expect(line(input({}), 'acceptance')).toMatchObject({
      status: 'fail',
      passed: 0,
      total: 1,
      problems: [
        `${FEATURE.path}: missing evidence — no suite recorded a verdict for it`,
      ],
    });
  });

  test('evidence from another text of the spec is stale and fails', () => {
    const records = [
      record(
        FEATURE,
        [pass('scenario:A guest creates a space', 'system')],
        'feature-before'
      ),
    ];
    expect(line(input({ records }), 'acceptance').problems).toEqual([
      `${FEATURE.path}: stale evidence — recorded from another text of the spec; run its suite again`,
    ]);
  });

  test('a scenario of the current text with no verdict was not run', () => {
    const records = [
      record(FEATURE, [pass('scenario:A guest creates a space', 'system')]),
    ];
    expect(line(input({ records }), 'acceptance').problems).toEqual([
      `${FEATURE.path}: not run — scenario "A member creates a space" has no system verdict`,
    ]);
  });

  test('a scenario run per game is decided by its per-game verdicts, and a failing game is named', () => {
    const records = [
      record(FEATURE, [
        pass('scenario:A guest creates a space [chess]', 'system'),
        {
          id: 'scenario:A guest creates a space [connect-four]',
          layer: 'system',
          status: 'fail',
          detail: 'no board',
        },
        pass('scenario:A member creates a space', 'system'),
      ]),
    ];
    expect(line(input({ records }), 'acceptance').problems).toEqual([
      `${FEATURE.path}: scenario:A guest creates a space [connect-four] failed — no board`,
    ]);
  });

  test('every scenario passing passes, and fresh records from several buckets merge', () => {
    const records = [
      record(FEATURE, [pass('scenario:A guest creates a space', 'system')]),
      record(FEATURE, [pass('scenario:A member creates a space', 'system')]),
      record(
        FEATURE,
        [{ id: 'scenario:gone', layer: 'system', status: 'fail' }],
        'feature-before'
      ),
    ];
    expect(line(input({ records }), 'acceptance')).toMatchObject({
      status: 'pass',
      passed: 1,
      total: 1,
    });
  });

  test('when buckets disagree on an obligation, the failure wins', () => {
    const records = [
      record(FEATURE, [
        pass('scenario:A guest creates a space', 'system'),
        pass('scenario:A member creates a space', 'system'),
      ]),
      record(FEATURE, [
        {
          id: 'scenario:A guest creates a space',
          layer: 'system',
          status: 'fail',
          detail: 'refused\nmore',
        },
      ]),
    ];
    expect(line(input({ records }), 'acceptance').problems).toEqual([
      `${FEATURE.path}: scenario:A guest creates a space failed — refused`,
    ]);
  });

  test('permission enforcement needs a server agreement for each decision table and capability', () => {
    const application = [
      pass('valid', 'specification'),
      pass('complete:hosting-limit', 'specification'),
      pass('consistent:hosting-limit', 'specification'),
      pass('agree:hosting-limit:application decision', 'implementation'),
    ];
    const without = input({ records: [record(DECISIONS, application)] });
    expect(line(without, 'permission-enforcement').status).toBe('fail');
    expect(line(without, 'permission-coverage').problems).toEqual([
      'capability "host another open space": no server enforcement of "hosting-limit" was checked',
    ]);
    expect(line(without, 'capabilities').status).toBe('pass');
    const withServer = input({
      records: [
        record(DECISIONS, [
          ...application,
          pass('agree:hosting-limit:server enforcement', 'implementation'),
        ]),
      ],
    });
    expect(line(withServer, 'permission-enforcement').status).toBe('pass');
    expect(line(withServer, 'permission-coverage').status).toBe('pass');
  });

  test('a line with nothing to check fails as missing automation', () => {
    expect(line(input({}), 'model-checking')).toMatchObject({
      status: 'fail',
      total: 0,
      problems: ['missing automation — nothing feeds this line'],
    });
  });

  test('a release gate without a cached pass fails, and malformed evidence fails the checks line', () => {
    const report = input({
      gateTasks: ['tc', 'lint'],
      malformed: ['/r/evidence/x.json'],
    });
    expect(line(report, 'release-gates').problems).toEqual([
      'lint: not run — no verdict for these inputs',
    ]);
    expect(line(report, 'conformance-checks').problems[0]).toBe(
      '/r/evidence/x.json: malformed evidence'
    );
  });

  test('the manifest line is the closed-world gate', () => {
    expect(
      line(input({ closure: ['specs/x/: not a context'] }), 'manifest')
    ).toMatchObject({
      status: 'fail',
      passed: 0,
      total: 1,
    });
  });
});

describe('decideVerdict', () => {
  const lines = evaluateLines(input({}));
  const allPass = lines.map((l) => ({
    ...l,
    status: 'pass' as const,
    problems: [],
  }));

  test('product conformance ignores release lines; readiness needs them and every requirement', () => {
    const releaseFails = allPass.map((l) =>
      l.id === 'synthetics' ? { ...l, status: 'fail' as const } : l
    );
    const verdict = decideVerdict({
      edition: 'current',
      lines: releaseFails,
      require: ['production-safe synthetics', 'completeness'],
      readiness: EVIDENCE_MAP['production readiness'],
    });
    expect(verdict.productConformance).toBe('pass');
    expect(verdict.productionReadiness).toBe('fail');
    expect(verdict.requirements.map((r) => [r.id, r.status])).toEqual([
      ['production-safe synthetics', 'fail'],
      ['completeness', 'pass'],
    ]);
  });

  test('a requirement nothing maps fails, and so does a manifest that did not parse', () => {
    expect(
      decideVerdict({
        edition: 'current',
        lines: allPass,
        require: ['security'],
        readiness: {},
      }).requirements[0]
    ).toMatchObject({
      status: 'fail',
      problems: ['missing automation — no report line decides it'],
    });
    expect(
      decideVerdict({
        edition: 'current',
        lines: allPass,
        require: null,
        readiness: {},
      }).productionReadiness
    ).toBe('fail');
    expect(
      decideVerdict({
        edition: 'current',
        lines: allPass,
        require: [],
        readiness: {},
      }).productionReadiness
    ).toBe('pass');
  });

  test('renders the pipeline sections and both verdicts', () => {
    const text = renderVerdict(
      decideVerdict({
        edition: 'current',
        lines,
        require: ['completeness'],
        readiness: EVIDENCE_MAP['production readiness'],
      })
    );
    for (const heading of [
      '1. SPECIFICATION',
      '2. IMPLEMENTATION',
      '3. SYSTEM',
      '4. RELEASE / LIVE',
      '5. COMPLETENESS',
    ]) {
      expect(text).toContain(heading);
    }
    expect(text).toContain('PRODUCT CONFORMANCE: FAIL');
    expect(text.endsWith('PRODUCTION READINESS: FAIL')).toBe(true);
  });
});

describe('specRevision', () => {
  const hash = (text: string) => `h(${text})`;

  test('depends on every path and text, not on their order', () => {
    const a = { path: 'specs/a.feature', sha256: '1' };
    const b = { path: 'specs/b.feature', sha256: '2' };
    expect(specRevision([a, b], hash)).toBe(specRevision([b, a], hash));
    expect(specRevision([a, b], hash)).not.toBe(
      specRevision([a, { ...b, sha256: '3' }], hash)
    );
  });
});
