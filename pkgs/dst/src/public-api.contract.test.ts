import { describe, expect, test } from 'bun:test';
import { kv } from './examples/acme-kv/scenario';
import * as fcAdapter from './fast-check';
import * as dst from './index';
import * as kernel from './kernel';
import { script } from './run/script';

const FORBIDDEN = [
  'defineScenario',
  'actions',
  'properties',
  'knob',
  'node',
  'std',
  'runProperty',
  'arbSeed',
  'checkSystem',
  'replaySystem',
  'getRunInternal',
  'RunInternal',
  'Body',
  'start',
  'check',
  'CheckFailedError',
  'CampaignReport',
] as const;

describe('public-api', () => {
  test('@pkgs/dst exports the algebra only', () => {
    for (const k of [
      'defineSystem',
      'defineObservation',
      'defineAction',
      'defineProperty',
      'defineSurface',
      'draw',
      'observe',
      'script',
      'walk',
      'explore',
      'replay',
      'ExploreFailedError',
      'untilObserved',
      'neverObserved',
      'virtualHost',
      'wallHost',
      'defineHost',
      'REPRO_VERSION',
      'parseRepro',
      'stringifyRepro',
    ]) {
      expect(dst).toHaveProperty(k);
    }
    for (const k of FORBIDDEN) {
      expect(dst).not.toHaveProperty(k);
    }
  });

  test('Run has no _internal escape hatch', async () => {
    await using run = await script(kv, { seed: 1, knobs: { clients: 1 } });
    expect(run).not.toHaveProperty('_internal');
    expect(Object.keys(run).sort()).toEqual(['apply', 'assert', 'observe']);
  });

  test('@pkgs/dst/kernel exports factories', () => {
    for (const k of [
      'createVirtualClock',
      'createVirtualScheduler',
      'createWallScheduler',
      'createRng',
      'createTimers',
      'createNetwork',
      'fingerprint',
    ]) {
      expect(kernel).toHaveProperty(k);
    }
    expect(kernel).not.toHaveProperty('createScriptedDraws');
  });

  test('@pkgs/dst/fast-check exports gen + arbitrary', () => {
    expect(Object.keys(fcAdapter).sort()).toEqual(
      ['arbitrary', 'gen', 'randomGeneratorOver'].sort()
    );
  });
});
