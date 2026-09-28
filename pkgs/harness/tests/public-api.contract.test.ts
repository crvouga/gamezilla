import { describe, expect, test } from 'bun:test';
import * as harness from '@pkgs/harness';
import * as fcAdapter from '@pkgs/harness/fast-check';
import * as kernel from '@pkgs/harness/internals';
import { exampleApp } from './example-app/example-app';

const FORBIDDEN = [
  'defineScenario',
  'defineObservation',
  'defineSurface',
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
  'createRuntime',
] as const;

describe('public-api', () => {
  test('@pkgs/harness exports the algebra only', () => {
    for (const k of [
      'defineSystem',
      'defineAction',
      'defineProperty',
      'defineSnapshot',
      'defineRuntime',
      'ExploreFailedError',
      'virtualTimeRuntime',
      'realTimeRuntime',
      'RECORDING_VERSION',
      'parseRecording',
      'stringifyRecording',
      'RELIABLE_NETWORK',
      'asSeededRng',
    ]) {
      expect(harness).toHaveProperty(k);
    }
    for (const k of FORBIDDEN) {
      expect(harness).not.toHaveProperty(k);
    }
  });

  test('Run has no _internal escape hatch', async () => {
    const sys = exampleApp();
    await using s = await sys.run({ seed: 1 });
    expect(s).not.toHaveProperty('_internal');
    expect(Object.keys(s).sort()).toEqual(
      [
        'apply',
        'assert',
        'advanceTime',
        'fail',
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

  test('@pkgs/harness/internals exports factories', () => {
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

  test('@pkgs/harness/fast-check exports only the Gen ↔ Arbitrary adapters', () => {
    // assertProperty and the JSON arbitraries live in the leaf @pkgs/property.
    expect(Object.keys(fcAdapter).sort()).toEqual(
      ['arbitrary', 'gen', 'randomGeneratorOver'].sort()
    );
  });
});
