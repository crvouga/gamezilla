import { describe, expect, test } from 'bun:test';
import { type ClosureWorld, closureProblems } from '@pkgs/conformance/closure';
import { assertProperty, fc } from '@pkgs/property';

import { closedWorld, type WorldShape } from './fixtures/world';

const SHAPE: WorldShape = {
  contexts: ['spaces', 'chess'],
  decisions: [['create a space', 'join a space'], null],
  environments: ['offline'],
  gates: ['lint'],
};

function withManifest(
  world: ClosureWorld,
  edit: (manifest: ClosureWorld['manifest']) => ClosureWorld['manifest']
): ClosureWorld {
  return { ...world, manifest: edit(world.manifest) };
}

describe('closureProblems', () => {
  test('a closed world has none', () => {
    expect(closureProblems(closedWorld(SHAPE))).toEqual([]);
  });

  test('contexts are exactly the spec directories', () => {
    const world = closedWorld(SHAPE);
    expect(
      closureProblems({
        ...world,
        specDirectories: ['spaces', 'chess', 'billing'],
      })
    ).toEqual([
      "specs/billing/: not a context in the manifest's product.contexts — declare it",
    ]);
    expect(
      closureProblems({ ...world, specDirectories: ['spaces'] })
    ).toContain('product.contexts "chess": there is no specs/chess/');
  });

  test('a decision lists only capabilities the manifest says it decides', () => {
    const world = closedWorld(SHAPE);
    const decisions = world.decisions.map((d) =>
      d.id === 'decision-0'
        ? { ...d, capabilities: ['create a space', 'fly'] }
        : d
    );
    expect(closureProblems({ ...world, decisions })).toEqual([
      'capability "join a space": specs/spaces/decision-0.dmn decision "decision-0" does not list it among what they want to do',
      'specs/spaces/decision-0.dmn decision "decision-0": "fly" is not a capability in the manifest — declare it',
    ]);
  });

  test('a capability names a decision that exists', () => {
    const world = withManifest(closedWorld(SHAPE), (manifest) => ({
      ...manifest,
      product: {
        ...manifest.product,
        capabilities: manifest.product.capabilities.map((c) =>
          c.id === 'create a space' ? { ...c, 'decided by': 'nowhere' } : c
        ),
      },
    }));
    expect(closureProblems(world)).toEqual([
      'capability "create a space": no decision table has the decision "nowhere"',
      'specs/spaces/decision-0.dmn decision "decision-0": answers "create a space", which the manifest says is decided by "nowhere"',
    ]);
  });

  test('a decision answering one capability is named by exactly one', () => {
    const world = withManifest(closedWorld(SHAPE), (manifest) => ({
      ...manifest,
      product: {
        ...manifest.product,
        capabilities: [
          ...manifest.product.capabilities,
          { id: 'another', context: 'spaces', 'decided by': 'decision-1' },
        ],
      },
    }));
    expect(closureProblems(world)).toEqual([
      'specs/spaces/decision-1.dmn decision "decision-1": answers one capability, so exactly one manifest capability must be decided by it (found 2)',
    ]);
  });

  test('every spec is bound and every kind has one', () => {
    const world = closedWorld(SHAPE);
    const specs = world.specs
      .filter((spec) => spec.kind !== 'structure')
      .map((spec) =>
        spec.kind === 'dynamics' ? { ...spec, bound: false } : spec
      );
    expect(closureProblems({ ...world, specs })).toEqual([
      'conformance "structure": required, but there is no structure spec',
      'specs/spaces/model.qnt: not bound exactly once (bun run spec:check says why) — nothing checks it, so it cannot count',
    ]);
  });

  test('an objective measures a context', () => {
    const world = closedWorld(SHAPE);
    const objectives = [
      { specUri: 'specs/spaces/o.openslo.yaml', slo: 'fast', service: 'api' },
    ];
    expect(closureProblems({ ...world, objectives })).toEqual([
      'specs/spaces/o.openslo.yaml SLO "fast": service "api" is not a context in the manifest',
    ]);
  });

  test('the evidence map and the manifest name the same ids', () => {
    const world = closedWorld(SHAPE);
    const evidence = {
      ...world.evidence,
      environments: { online: [{ spec: 'specs/spaces/spaces-story.feature' }] },
    };
    expect(closureProblems({ ...world, evidence })).toEqual([
      'environments "offline": nothing maps it to the checks that prove it',
      'environments "online": mapped, but not in the manifest — remove it or declare it',
    ]);
  });

  test('every proof is automated', () => {
    const world = closedWorld(SHAPE);
    const evidence = {
      ...world.evidence,
      environments: {
        offline: [
          { spec: 'specs/spaces/gone.feature' },
          { live: 'specs/spaces/model.qnt' },
        ],
      },
    };
    expect(
      closureProblems({ ...world, evidence, gatingTasks: new Set() })
    ).toEqual([
      'environments "offline": names specs/spaces/gone.feature, which does not exist',
      'environments "offline": names specs/spaces/model.qnt as live evidence, but no package runs it against a deployment',
      'release gates "lint": names task //#gate:lint, which the release gate does not run',
    ]);
  });

  test('a public contract is proven in its own context', () => {
    const world = closedWorld(SHAPE);
    const evidence = {
      ...world.evidence,
      'public contracts': {
        'the link': [{ spec: 'specs/chess/chess-story.feature' }],
      },
    };
    expect(closureProblems({ ...world, evidence })).toEqual([
      'public contracts "the link": no spec of its context spaces proves it',
    ]);
  });
});

const CONTEXTS = ['auth', 'chess', 'spaces', 'health', 'room'] as const;

const shapes = fc.record({
  contexts: fc.uniqueArray(fc.constantFrom(...CONTEXTS), {
    minLength: 1,
    maxLength: 5,
  }),
  decisions: fc.array(
    fc.option(
      fc.uniqueArray(fc.constantFrom('a', 'b', 'c', 'd'), {
        minLength: 1,
        maxLength: 3,
      }),
      {
        nil: null,
      }
    ),
    { minLength: 1, maxLength: 3 }
  ),
  environments: fc.uniqueArray(fc.constantFrom('online', 'offline', 'UTC'), {
    minLength: 1,
  }),
  gates: fc.uniqueArray(fc.constantFrom('lint', 'tc', 'audit'), {
    minLength: 1,
  }),
});

/** Capability values must be distinct across decisions to be closed. */
function distinct(shape: WorldShape): WorldShape {
  return {
    ...shape,
    decisions: shape.decisions.map((values, i) =>
      values === null ? null : values.map((v) => `${v}${String(i)}`)
    ),
  };
}

type Break = (world: ClosureWorld) => ClosureWorld;

const BREAKS: Readonly<Record<string, Break>> = {
  'a spec directory the manifest lacks': (w) => ({
    ...w,
    specDirectories: [...w.specDirectories, 'undeclared'],
  }),
  'a context without a directory': (w) => ({
    ...w,
    specDirectories: w.specDirectories.slice(1),
  }),
  'an unbound spec': (w) => ({
    ...w,
    specs: w.specs.map((s, i) =>
      i === w.specs.length - 1 ? { ...s, bound: false } : s
    ),
  }),
  'a capability dropped from the manifest': (w) =>
    withManifest(w, (m) => ({
      ...m,
      product: { ...m.product, capabilities: m.product.capabilities.slice(1) },
    })),
  'a decision answering an undeclared capability': (w) => ({
    ...w,
    decisions: w.decisions.map((d, i) =>
      i === 0
        ? { ...d, capabilities: [...(d.capabilities ?? []), 'undeclared'] }
        : d
    ),
  }),
  'an objective of an unknown service': (w) => ({
    ...w,
    objectives: [
      { specUri: 'specs/x/y.openslo.yaml', slo: 's', service: 'nowhere' },
    ],
  }),
  'an environment nothing proves': (w) => ({
    ...w,
    evidence: { ...w.evidence, environments: {} },
  }),
  'a gate the release gate does not run': (w) => ({
    ...w,
    gatingTasks: new Set(),
  }),
  'a kind with no spec': (w) => ({
    ...w,
    specs: w.specs.filter((s) => s.kind !== 'structure'),
  }),
};

describe('closureProblems over generated worlds', () => {
  test('every closed world passes', () => {
    assertProperty(
      'closed worlds are closed',
      fc.property(shapes, (shape) => {
        expect(closureProblems(closedWorld(distinct(shape)))).toEqual([]);
      })
    );
  });

  test('every single break is caught', () => {
    assertProperty(
      'one break, at least one problem',
      fc.property(
        shapes,
        fc.constantFrom(...Object.keys(BREAKS)),
        (shape, name) => {
          const broken = (BREAKS[name] as Break)(closedWorld(distinct(shape)));
          expect(closureProblems(broken).length).toBeGreaterThan(0);
        }
      )
    );
  });
});
