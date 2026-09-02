import { describe, expect, it } from 'bun:test';

import { createUiTestCtx } from './create-ctx';
import { describe as uiDescribe } from './describe';
import { installUiTestRunner, resetUiTestRunnerForTests } from './install';
import type {
  UiTestHostHooks,
  UiTestRunner,
  UiTestRunnerConfig,
} from './types';

type RecordedCall =
  | { kind: 'describe'; name: string }
  | { kind: 'test'; name: string; timeoutMs?: number }
  | { kind: 'beforeAll' }
  | { kind: 'afterAll' }
  | { kind: 'beforeEach' }
  | { kind: 'afterEach' };

function createRecordingHooks(calls: RecordedCall[]): UiTestHostHooks {
  return {
    describe(name, fn) {
      calls.push({ kind: 'describe', name });
      fn();
    },
    test(name, _fn, timeoutMs) {
      if (timeoutMs !== undefined) {
        calls.push({ kind: 'test', name, timeoutMs });
      } else {
        calls.push({ kind: 'test', name });
      }
    },
    beforeAll() {
      calls.push({ kind: 'beforeAll' });
    },
    afterAll() {
      calls.push({ kind: 'afterAll' });
    },
    beforeEach() {
      calls.push({ kind: 'beforeEach' });
    },
    afterEach() {
      calls.push({ kind: 'afterEach' });
    },
  };
}

function createFakeRunner(
  config: UiTestRunnerConfig,
  calls: RecordedCall[]
): UiTestRunner {
  const hooks = createRecordingHooks(calls);
  return {
    config,
    describe(name, fn) {
      hooks.describe(name, () => {
        fn(createUiTestCtx(config, hooks));
      });
    },
  };
}

describe('ui-testing runner', () => {
  it('describe delegates to installed runner and exposes ctx fidelity', () => {
    const calls: RecordedCall[] = [];
    installUiTestRunner(
      createFakeRunner({ fidelity: 'sim', driverKind: 'rntl' }, calls)
    );

    uiDescribe('space create', (ctx) => {
      expect(ctx.fidelity).toBe('sim');
      expect(ctx.driverKind).toBe('rntl');
      ctx.beforeAll(() => undefined);
      ctx.test('host creates a space', async () => undefined, 30_000);
      ctx.afterAll(() => undefined);
    });

    expect(calls).toEqual([
      { kind: 'describe', name: 'space create' },
      { kind: 'beforeAll' },
      { kind: 'test', name: 'host creates a space', timeoutMs: 30_000 },
      { kind: 'afterAll' },
    ]);

    resetUiTestRunnerForTests();
  });

  it('throws when describe runs before install', () => {
    resetUiTestRunnerForTests();
    expect(() => {
      uiDescribe('orphan', () => undefined);
    }).toThrow(/not installed/);
  });
});
