import { describe, expect, test } from 'bun:test';
import fc from 'fast-check';
import { createFaultCatalog, defineFault } from './faults';
import { createKnobCatalog, defineKnob } from './knobs';
import { createNetEffect } from './net-effect';
import { RELIABLE_NET_FAULTS } from './network';
import { captureScenario, parseScenario } from './scenario';
import { createReplayingTrace, createSimTrace } from './trace';

describe('FaultCatalog', () => {
  test('queue FIFO + matcher', () => {
    const cat = createFaultCatalog([
      defineFault({ id: 'crash', mode: 'queue' }),
    ]);
    cat.arm('crash', 'n1', 'a');
    cat.arm('crash', 'n1', 'b');
    expect(cat.peek('crash', 'n1')).toBe('a');
    expect(cat.take('crash', 'n1')).toBe('a');
    expect(cat.take('crash', 'n1', (p) => p === 'b')).toBe('b');
  });

  test('set dedupe keeps position on replace', () => {
    const cat = createFaultCatalog([defineFault({ id: 'f', mode: 'set' })]);
    cat.arm('f', 't', 'one', { dedupeKey: 'k1' });
    cat.arm('f', 't', 'two', { dedupeKey: 'k2' });
    cat.arm('f', 't', 'ONE', { dedupeKey: 'k1' });
    expect(cat.take('f', 't')).toBe('ONE');
    expect(cat.take('f', 't')).toBe('two');
  });

  test('set non-primitive without key throws', () => {
    const cat = createFaultCatalog([defineFault({ id: 'f', mode: 'set' })]);
    expect(() => cat.arm('f', 't', { x: 1 })).toThrow(/dedupeKey/);
  });

  test('unknown id throws', () => {
    const cat = createFaultCatalog([]);
    expect(() => cat.arm('x', 't')).toThrow(/unknown/);
  });

  test('clear target vs all', () => {
    const cat = createFaultCatalog([defineFault({ id: 'f' })]);
    cat.arm('f', 'a', 1);
    cat.arm('f', 'b', 2);
    cat.clear('a');
    expect(cat.take('f', 'a')).toBeUndefined();
    expect(cat.take('f', 'b')).toBe(2);
  });
});

describe('KnobCatalog', () => {
  test('defaults, overrides, sorted toJSON', () => {
    const cat = createKnobCatalog<{ a: number; b: boolean }>(
      [
        defineKnob({ id: 'b', default: false, arb: fc.boolean() }),
        defineKnob({ id: 'a', default: 1, arb: fc.integer() }),
      ],
      { a: 2 }
    );
    expect(cat.get('a')).toBe(2);
    expect(cat.toJSON()).toEqual({ a: 2, b: false });
    expect(Object.keys(cat.toJSON())).toEqual(['a', 'b']);
  });

  test('duplicate id / unknown override throw', () => {
    expect(() =>
      createKnobCatalog([
        defineKnob({ id: 'x', default: 1, arb: fc.constant(1) }),
        defineKnob({ id: 'x', default: 2, arb: fc.constant(2) }),
      ])
    ).toThrow(/duplicate/);
    expect(() =>
      createKnobCatalog(
        [defineKnob({ id: 'x', default: 1, arb: fc.constant(1) })],
        {
          y: 2,
        } as never
      )
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
    const t = createSimTrace(false);
    t.record({ type: 'lifecycle', phase: 'boot', now: 0 });
    expect(t.events()).toEqual([]);
  });

  test('records in order; replay detects divergence', () => {
    const t = createSimTrace(true);
    t.record({ type: 'lifecycle', phase: 'boot', now: 0 });
    t.record({ type: 'lifecycle', phase: 'settle', now: 1 });
    expect(t.events()).toHaveLength(2);
    const replay = createReplayingTrace(t.getTrace());
    replay.record({ type: 'lifecycle', phase: 'boot', now: 0 });
    expect(() =>
      replay.record({ type: 'lifecycle', phase: 'chaos', now: 1 })
    ).toThrow(/divergence/);
  });
});

describe('createNetEffect', () => {
  test('apply once; restore idempotent', () => {
    let applied = 0;
    let restored = 0;
    const e = createNetEffect(
      () => {
        applied += 1;
      },
      () => {
        restored += 1;
      }
    );
    expect(applied).toBe(1);
    e.restore();
    e.restore();
    e[Symbol.dispose]();
    expect(restored).toBe(1);
  });
});
