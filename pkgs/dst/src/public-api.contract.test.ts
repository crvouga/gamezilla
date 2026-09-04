import { describe, expect, test } from 'bun:test';
import { kv } from './examples/acme-kv/scenario';
import * as fcAdapter from './fast-check';
import * as dst from './index';
import * as kernel from './kernel';

const FORBIDDEN = [
  'defineScenario',
  'defineObservation',
  'defineSurface',
  'defineProperty',
  'draw',
  'observe',
  'untilObserved',
  'neverObserved',
  'actions',
  'properties',
  'knob',
  'node',
  'std',
  'runProperty',
  'arbSeed',
  'checkSystem',
  'replaySystem',
  'getScriptInternal',
  'ScriptInternal',
  'Body',
  'start',
  'check',
  'CheckFailedError',
  'CampaignReport',
  'script',
  'walk',
  'explore',
  'replay',
] as const;

describe('public-api', () => {
  test('@pkgs/dst exports the algebra only', () => {
    for (const k of [
      'defineSystem',
      'defineAction',
      'ExploreFailedError',
      'virtualHost',
      'wallHost',
      'defineHost',
      'REPRO_VERSION',
      'parseRepro',
      'stringifyRepro',
      'RELIABLE_NETWORK',
      'asSeededRng',
    ]) {
      expect(dst).toHaveProperty(k);
    }
    for (const k of FORBIDDEN) {
      expect(dst).not.toHaveProperty(k);
    }
  });

  test('Script has no _internal escape hatch', async () => {
    await using s = await kv.script({ seed: 1, args: { clients: 1 } });
    expect(s).not.toHaveProperty('_internal');
    expect(Object.keys(s).sort()).toEqual([
      'apply',
      'assert',
      'elapse',
      'never',
      'observe',
      'until',
      'walk',
    ]);
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
