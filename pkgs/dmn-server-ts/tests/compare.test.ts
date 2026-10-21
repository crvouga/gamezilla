/**
 * Mutation tests (strategy § 21): a product broken the realistic ways — an
 * inverted permission, a limit off by one, a server that enforces nothing —
 * must make the comparison fail, on exactly the cases that show it.
 */

import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { generateCases } from '@pkgs/dmn-shared-ts/cases';
import {
  bindingProblems,
  compareLayer,
  formatMismatches,
} from '@pkgs/dmn-shared-ts/compare';
import { parseDmn } from '@pkgs/dmn-shared-ts/model';
import type { DecisionLayer } from '@pkgs/dmn-shared-ts/registry';

import {
  applicationLayer,
  can,
  clientLayer,
  factsOf,
  SHIPPED,
  serverLayer,
  serverOperation,
} from './fixtures/access-product';

const parsed = parseDmn(
  readFileSync(join(import.meta.dir, 'fixtures/access.dmn'), 'utf8')
);
if (!parsed.ok) throw new Error(parsed.issues.join('\n'));
const definitions = parsed.definitions;
const decision = definitions.decisions[0];
if (decision === undefined) throw new Error('no decision');
const cases = generateCases(decision);

describe('the shipped product', () => {
  test('agrees in every layer', async () => {
    const layers = [
      applicationLayer(SHIPPED),
      serverLayer((facts) => serverOperation(SHIPPED, facts)),
      clientLayer(SHIPPED),
    ];
    const results = await Promise.all(
      layers.map((layer) => compareLayer({ decision, cases, layer }))
    );
    expect(results.map((r) => [r.checked, r.mismatches.length])).toEqual([
      [cases.length, 0],
      [cases.length, 0],
      [(cases.length * 2) / 3, 0],
    ]);
  });
});

describe('mutations are detected', () => {
  test('an inverted permission: free players may customize', async () => {
    const inverted: DecisionLayer = {
      decide: (input) => {
        const facts = factsOf(input);
        return facts.tier === 'free' && facts.capability === 'game.customize'
          ? { decision: 'allow', reason: 'none' }
          : can(SHIPPED, facts);
      },
    };
    const { mismatches } = await compareLayer({
      decision,
      cases,
      layer: inverted,
    });
    expect(mismatches.length).toBe(6);
    expect(
      mismatches.every((m) =>
        m.caseId.startsWith('tier=free/capability=game.customize/')
      )
    ).toBe(true);
    expect(mismatches[0]).toMatchObject({
      expected: { decision: 'deny', reason: 'upgrade' },
      actual: { decision: 'allow', reason: 'none' },
      reason: 'differs on decision, reason',
    });
  });

  test('a limit off by one: 21 plays instead of 20', async () => {
    const { mismatches } = await compareLayer({
      decision,
      cases,
      layer: applicationLayer({ dailyPlays: 21 }),
    });
    expect(mismatches.map((m) => m.caseId)).toEqual([
      'tier=guest/capability=game.play/plays today=20',
      'tier=free/capability=game.play/plays today=20',
    ]);
  });

  test('a limit off by one the other way: 19 plays', async () => {
    const { mismatches } = await compareLayer({
      decision,
      cases,
      layer: applicationLayer({ dailyPlays: 19 }),
    });
    expect(mismatches.map((m) => m.input['plays today'])).toEqual([19, 19]);
  });

  test('a server that enforces nothing', async () => {
    const allowAll = serverLayer(() => 'done');
    const { checked, mismatches } = await compareLayer({
      decision,
      cases,
      layer: allowAll,
    });
    expect(checked).toBe(cases.length);
    const denied = cases.filter(
      (c) => c.expected.ok && c.expected.output['decision'] === 'deny'
    );
    expect(mismatches.map((m) => m.caseId)).toEqual(denied.map((c) => c.id));
    expect(mismatches[0]?.reason).toBe('differs on decision');
  });

  test('a layer that throws is a mismatch, not a crash', async () => {
    const broken: DecisionLayer = {
      decide: () => {
        throw new Error('database unavailable');
      },
    };
    const { mismatches } = await compareLayer({
      decision,
      cases: cases.slice(0, 2),
      layer: broken,
    });
    expect(mismatches.map((m) => m.reason)).toEqual([
      'the layer threw: database unavailable',
      'the layer threw: database unavailable',
    ]);
  });

  test('a layer that leaves out an output it observes disagrees', async () => {
    const silent: DecisionLayer = {
      decide: (input) => ({
        decision: can(SHIPPED, factsOf(input))['decision'] ?? null,
      }),
    };
    const { mismatches } = await compareLayer({
      decision,
      cases,
      layer: silent,
    });
    expect(mismatches.length).toBe(cases.length);
    expect(mismatches[0]?.reason).toBe('differs on reason');
  });

  test('a layer that governs no case checks nothing', async () => {
    const idle: DecisionLayer = { applies: () => false, decide: () => ({}) };
    expect(await compareLayer({ decision, cases, layer: idle })).toEqual({
      checked: 0,
      mismatches: [],
    });
  });

  test('the world reaches the layer with the case it answers', async () => {
    const seen: string[] = [];
    const layer: DecisionLayer<{ log: string[] }> = {
      decide: (input, context) => {
        context.world.log.push(`${context.decisionId}:${context.caseId}`);
        return can(SHIPPED, factsOf(input));
      },
    };
    await compareLayer({
      decision,
      cases: cases.slice(0, 1),
      layer,
      world: { log: seen },
    });
    expect(seen).toEqual([
      'access:tier=guest/capability=game.play/plays today=0',
    ]);
  });

  test('mismatches read as a list of inputs, expected and actual', async () => {
    const { mismatches } = await compareLayer({
      decision,
      cases,
      layer: applicationLayer({ dailyPlays: 21 }),
    });
    expect(formatMismatches(mismatches, 1)).toBe(
      [
        '- tier="guest", capability="game.play", plays today=20',
        '    expected: decision="deny", reason="limit reached"',
        '    actual:   decision="allow", reason="none"',
        '    differs on decision, reason',
        '… and 1 more',
      ].join('\n')
    );
  });
});

describe('binding problems', () => {
  const layer = applicationLayer(SHIPPED);

  test('a sound binding has none', () => {
    expect(
      bindingProblems(definitions, { spec: 'access', layers: { app: layer } })
    ).toEqual([]);
  });

  test('a decision the file lacks, no layers, an output the decision lacks', () => {
    expect(
      bindingProblems(definitions, {
        spec: 'access',
        decisions: ['acess'],
        layers: { app: layer },
      })
    ).toEqual(['the file has no decision "acess"']);
    expect(
      bindingProblems(definitions, { spec: 'access', layers: {} })
    ).toEqual(['the binding has no layers — bind at least one']);
    expect(
      bindingProblems(definitions, {
        spec: 'access',
        layers: {
          gate: { ...layer, observes: ['allowed'] },
          none: { ...layer, observes: [] },
        },
      })
    ).toEqual([
      'layer "gate": observes "allowed", which decision access does not output (decision, reason)',
      'layer "none": observes no output',
    ]);
  });
});
