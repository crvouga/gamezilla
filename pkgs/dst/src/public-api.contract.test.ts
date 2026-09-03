import { describe, expect, test } from 'bun:test';
import * as fcAdapter from './fast-check';
import * as dst from './index';
import * as kernel from './kernel';
import * as pbt from './pbt';

const FORBIDDEN = [
  'openWorld',
  'defineScenario',
  'createWorldPorts',
  'actions',
  'properties',
  'knob',
  'node',
  'std',
  'WorldPorts',
  'runProperty',
  'arbSeed',
  'checkSystem',
  'replaySystem',
] as const;

describe('public-api', () => {
  test('@pkgs/dst exports the algebra only', () => {
    for (const k of [
      'defineSystem',
      'defineObservation',
      'defineAction',
      'defineProperty',
      'draw',
      'observe',
      'start',
      'walk',
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

  test('@pkgs/dst/pbt exports check + replay only', () => {
    for (const k of ['check', 'replay', 'CheckFailedError']) {
      expect(pbt).toHaveProperty(k);
    }
    for (const k of [
      'runProperty',
      'arbSeed',
      'checkSystem',
      'replaySystem',
      'assertDeterministic',
    ]) {
      expect(pbt).not.toHaveProperty(k);
    }
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
  });

  test('@pkgs/dst/fast-check exports gen + arbitrary', () => {
    expect(Object.keys(fcAdapter).sort()).toEqual(
      ['arbitrary', 'gen', 'randomGeneratorOver'].sort()
    );
  });
});
