import { describe, expect, test } from 'bun:test';
import type { ReportStep } from '@pkgs/harness';

import { actionLabel, formatArgs } from '../src/lib/format';
import { gherkinText, scenarioScript } from '../src/lib/scenario';

function step(
  patch: Partial<ReportStep> & Pick<ReportStep, 'kind' | 'title'>
): ReportStep {
  return {
    index: 1,
    status: 'passed',
    startedAtMs: 0,
    endedAtMs: 1,
    durationMs: 1,
    frames: [],
    steps: [],
    ...patch,
  };
}

describe('scenario script', () => {
  test('lays the gherkin out as lines and nests every action under its line', () => {
    const put = step({
      kind: 'apply',
      title: 'put',
      action: 'put',
      args: ['x', 'hello'],
    });
    const given = step({
      kind: 'Given',
      title: 'Given a board',
      steps: [put],
    });
    const then = step({ kind: 'Then', title: 'Then the value is hello' });
    const script = scenarioScript([given, then]);
    expect(script).toHaveLength(2);
    expect(gherkinText(given)).toBe('a board');
    expect(script?.[0]?.actions.map((action) => actionLabel(action))).toEqual([
      'put("x", "hello")',
    ]);
    expect(gherkinText(then)).toBe('the value is hello');
  });

  test('a run with no gherkin leaves the step tree as the action log', () => {
    expect(
      scenarioScript([step({ kind: 'apply', title: 'put', action: 'put' })])
    ).toBeNull();
    expect(formatArgs([{ n: 1 }, null])).toBe('{"n":1}, null');
    expect(actionLabel(step({ kind: 'apply', title: 'put' }))).toBe('put');
  });
});
