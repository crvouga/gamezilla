import { describe, expect, test } from 'bun:test';
import { hostLimit } from '@pkgs/gherkin/registry';
import { recordStep } from '../src/spec/world';

/** A session whose `record` marks a step failed when its body throws, as the real one does. */
function session() {
  const steps: { title: string; status: 'passed' | 'failed' }[] = [];
  return {
    steps,
    record: async (
      meta: { readonly title: string },
      fn: () => Promise<void>
    ) => {
      try {
        await fn();
        steps.push({ title: meta.title, status: 'passed' });
      } catch (error) {
        steps.push({ title: meta.title, status: 'failed' });
        throw error;
      }
    },
  };
}

describe('recordStep', () => {
  test('a host limit is a passed step, a note, and still ends the scenario', async () => {
    const s = session();
    const limit = hostLimit('no real browser');
    const outcome = await recordStep(
      s as never,
      { kind: 'When', title: 'When they sign in' },
      () => Promise.reject(limit)
    ).catch((error: unknown) => error);
    expect(outcome).toBe(limit);
    expect(s.steps).toEqual([
      { title: 'When they sign in', status: 'passed' },
      { title: 'host limit: no real browser', status: 'passed' },
    ]);
  });

  test('any other error fails the step and no note follows', async () => {
    const s = session();
    const boom = new Error('boom');
    const outcome = await recordStep(
      s as never,
      { kind: 'Then', title: 'Then it works' },
      () => Promise.reject(boom)
    ).catch((error: unknown) => error);
    expect(outcome).toBe(boom);
    expect(s.steps).toEqual([{ title: 'Then it works', status: 'failed' }]);
  });

  test('a step that succeeds records once', async () => {
    const s = session();
    await recordStep(s as never, { kind: 'Given', title: 'Given x' }, () =>
      Promise.resolve()
    );
    expect(s.steps).toEqual([{ title: 'Given x', status: 'passed' }]);
  });
});
