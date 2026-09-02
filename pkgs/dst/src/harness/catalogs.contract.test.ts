import { describe, expect, test } from 'bun:test';
import fc from 'fast-check';
import {
  createTraceRecorder,
  createTraceResolver,
  NOOP_TRACE_RECORDER,
} from '../kernel/trace';
import { RELIABLE_NETWORK } from '../models/network';
import { createKnobCatalog, knob, resolveKnobDefs } from './knobs';
import { parseRepro, REPRO_VERSION, stringifyRepro } from './repro';

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

describe('Repro', () => {
  test('round-trip canonical', () => {
    const r = {
      version: REPRO_VERSION,
      inputs: {
        seed: '42',
        startTime: 0,
        knobs: { n: 1 },
        actions: [{ kind: 'inc' }],
        networkFaults: RELIABLE_NETWORK,
      },
      meta: { scenarioId: 'test' },
    };
    const json = stringifyRepro(r);
    expect(parseRepro(json)).toEqual(r);
  });

  test('v1 and unknown top-level keys are rejected loudly', () => {
    expect(() => parseRepro('{"version":1,"inputs":{},"meta":{}}')).toThrow(
      /unsupported version 1/
    );
    expect(() =>
      parseRepro(
        '{"version":3,"inputs":{"seed":"1","startTime":0,"knobs":{},"actions":[],"networkFaults":{}},"meta":{},"extra":1}'
      )
    ).toThrow(/unknown top-level/);
  });

  test('meta extras allowed', () => {
    const faults = JSON.stringify(RELIABLE_NETWORK);
    const json = `{"version":3,"inputs":{"seed":"1","startTime":0,"knobs":{},"actions":[],"networkFaults":${faults}},"meta":{"customDiag":"x"}}`;
    const r = parseRepro(json);
    expect(r.meta['customDiag']).toBe('x');
  });
});

describe('TraceRecorder', () => {
  test('noop recorder drops records', () => {
    NOOP_TRACE_RECORDER.record({ type: 'task_fire', taskId: 0, at: 0 });
    expect(NOOP_TRACE_RECORDER.records()).toEqual([]);
  });

  test('records in order; resolver detects divergence', () => {
    const t = createTraceRecorder();
    t.record({ type: 'task_create', taskId: 0, at: 0 });
    t.record({ type: 'task_fire', taskId: 0, at: 0 });
    expect(t.records()).toHaveLength(2);
    const resolver = createTraceResolver(t.records());
    resolver.record({ type: 'task_create', taskId: 0, at: 0 });
    expect(() =>
      resolver.record({ type: 'task_fire', taskId: 1, at: 0 })
    ).toThrow(/divergence/);
  });
});
