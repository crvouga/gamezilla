import { describe, expect, test } from 'bun:test';
import * as fcAdapter from './fast-check';
import * as sim from './index';
import * as kernel from './internals';
import { virtualTimeRuntime } from './runtime';
import { defineSystem } from './system';

const FORBIDDEN = [
  'defineScenario',
  'defineObservation',
  'defineSurface',
  'defineProperty',
  'draw',
  'read',
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
  'getRunInternal',
  'RunInternal',
  'getScriptInternal',
  'ScriptInternal',
  'Body',
  'start',
  'check',
  'CheckFailedError',
  'CampaignReport',
  'run',
  'randomActions',
  'explore',
  'replay',
  'script',
  'walk',
  'Host',
  'defineHost',
  'virtualHost',
  'wallHost',
] as const;

describe('public-api', () => {
  test('@pkgs/sim exports the algebra only', () => {
    for (const k of [
      'defineSystem',
      'defineAction',
      'ExploreFailedError',
      'virtualTimeRuntime',
      'realTimeRuntime',
      'defineRuntime',
      'RECORDING_VERSION',
      'parseRecording',
      'stringifyRecording',
      'RELIABLE_NETWORK',
      'asSeededRng',
    ]) {
      expect(sim).toHaveProperty(k);
    }
    for (const k of FORBIDDEN) {
      expect(sim).not.toHaveProperty(k);
    }
  });

  test('Run has no _internal escape hatch', async () => {
    const sys = defineSystem({
      name: 'api-contract',
      create: () => ({ n: 0 }),
    });
    sys.runtime({
      default: true,
      name: 'virtual',
      create: () => virtualTimeRuntime(),
    });
    await using s = await sys.run({ seed: 1 });
    expect(s).not.toHaveProperty('_internal');
    expect(Object.keys(s).sort()).toEqual(
      [
        'apply',
        'assert',
        'advanceTime',
        'never',
        'read',
        'record',
        'report',
        'snapshot',
        'until',
        'randomActions',
      ].sort()
    );
  });

  test('@pkgs/sim/internals exports factories', () => {
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

  test('@pkgs/sim/fast-check exports adapters, assertProperty, JSON arbs', () => {
    expect(Object.keys(fcAdapter).sort()).toEqual(
      [
        'arbitrary',
        'gen',
        'randomGeneratorOver',
        'assertProperty',
        'arbFiniteNumber',
        'arbJsonKey',
        'arbJsonObject',
        'arbJsonValue',
      ].sort()
    );
  });
});
