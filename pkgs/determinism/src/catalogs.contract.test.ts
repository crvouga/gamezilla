import { describe, expect, test } from 'bun:test';
import fc from 'fast-check';
import { createKnobCatalog, knob, resolveKnobDefs } from './knobs';
import { RELIABLE_NET_FAULTS } from './network';
import { captureScenario, parseScenario, stringifyScenario } from './scenario';
import {
  createDisabledTrace,
  createRecordingTrace,
  createReplayingTrace,
} from './trace';

describe('KnobCatalog', () => {
  test('defaults, overrides, sorted toJSON', () => {
    const defs = resolveKnobDefs({
      b: knob(false, fc.boolean()),
      a: knob(1, fc.integer()),
    });
    const cat = createKnobCatalog<{ a: number; b: boolean }>(defs, { a: 2 });
    expect(cat.get('a')).toBe(2);
    expect(cat.toJSON()).toEqual({ a: 2, b: false });
    expect(Object.keys(cat.toJSON())).toEqual(['a', 'b']);
  });

  test('duplicate id / unknown override throw', () => {
    expect(() =>
      createKnobCatalog([
        { id: 'x', default: 1, arb: fc.constant(1) },
        { id: 'x', default: 2, arb: fc.constant(2) },
      ])
    ).toThrow(/duplicate/);
    expect(() =>
      createKnobCatalog([{ id: 'x', default: 1, arb: fc.constant(1) }], {
        y: 2,
      } as never)
    ).toThrow(/unknown/);
  });
});

describe('Scenario', () => {
  test('round-trip canonical', () => {
    const s = {
      version: 1 as const,
      inputs: {
        seed: '42',
        startMs: 0,
        knobs: { n: 1 },
        actions: [{ type: 'inc' }],
        networkDefaults: RELIABLE_NET_FAULTS,
      },
      meta: { appId: 'test' },
    };
    const json = captureScenario(s);
    expect(parseScenario(json)).toEqual(s);
    expect(stringifyScenario(s)).toBe(json);
  });

  test('version mismatch / unknown top-level reject', () => {
    expect(() => parseScenario('{"version":2,"inputs":{},"meta":{}}')).toThrow(
      /version/
    );
    expect(() =>
      parseScenario(
        '{"version":1,"inputs":{"seed":"1","startMs":0,"knobs":{},"actions":[],"networkDefaults":{}},"meta":{},"extra":1}'
      )
    ).toThrow(/unknown top-level/);
  });

  test('meta extras allowed', () => {
    const profile = JSON.stringify(RELIABLE_NET_FAULTS);
    const json = `{"version":1,"inputs":{"seed":"1","startMs":0,"knobs":{},"actions":[],"networkDefaults":${profile}},"meta":{"customDiag":"x"}}`;
    const s = parseScenario(json);
    expect(s.meta['customDiag']).toBe('x');
  });
});

describe('SimTrace', () => {
  test('disabled is no-op', () => {
    const t = createDisabledTrace();
    t.record({ type: 'lifecycle', phase: 'boot', now: 0 });
    expect(t.events()).toEqual([]);
  });

  test('records in order; replay detects divergence', () => {
    const t = createRecordingTrace();
    t.record({ type: 'lifecycle', phase: 'boot', now: 0 });
    t.record({ type: 'lifecycle', phase: 'settle', now: 1 });
    expect(t.events()).toHaveLength(2);
    const replay = createReplayingTrace(t.events());
    replay.record({ type: 'lifecycle', phase: 'boot', now: 0 });
    expect(() =>
      replay.record({ type: 'lifecycle', phase: 'chaos', now: 1 })
    ).toThrow(/divergence/);
  });
});
