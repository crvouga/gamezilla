import { expect, test } from 'bun:test';
import {
  awaitRequiredPrChecks,
  type PrCheckSnapshot,
} from './pr-check-readiness';

const sha = '166ac03a5c76aff3beaa84df6b1f9162f7e1f4c1';
const required = [
  { context: 'CodeQL', integration_id: 57789 },
  { context: 'Analyze (javascript-typescript)', integration_id: 15368 },
];
const pending: PrCheckSnapshot = {
  activeCodeqlShas: [sha],
  checks: [
    {
      sha,
      name: 'CodeQL',
      appId: 57789,
      status: 'completed',
      conclusion: 'neutral',
    },
    {
      sha,
      name: 'Analyze (javascript-typescript)',
      appId: 15368,
      status: 'in_progress',
      conclusion: null,
    },
  ],
};
const success: PrCheckSnapshot = {
  activeCodeqlShas: [],
  checks: pending.checks.map((check) => ({
    ...check,
    status: 'completed',
    conclusion: 'success',
  })),
};
function run(snapshots: readonly PrCheckSnapshot[], collectionMs = 0) {
  let now = 0;
  let reads = 0;
  const result = awaitRequiredPrChecks({
    required,
    emptyShardPlan: false,
    read: () => {
      now += collectionMs;
      return snapshots[Math.min(reads++, snapshots.length - 1)]!;
    },
    clock: { now: () => now },
    timers: {
      setTimeout: (fn, ms) => {
        now += ms;
        fn();
        return 0;
      },
      clearTimeout: () => {},
      setInterval: () => {
        throw new Error('unexpected interval');
      },
      clearInterval: () => {},
    },
    timeoutMs: 30,
    intervalMs: 10,
  });
  return { result, reads: () => reads, now: () => now };
}
// regression: pr-checks-codeql-readiness-race
// Run 42444456910 failed at 03:56:10Z with this exact head/check lifecycle;
// producer 42444454937 finished successfully at 03:58:12Z.
test('observes the real neutral CodeQL / running analysis lifecycle until strict success', async () => {
  const execution = run([pending, success]);
  expect(await execution.result).toEqual(success.checks);
  expect(execution.reads()).toBe(2);
});
test('neutral without its same-head active producer fails immediately', async () => {
  for (const activeCodeqlShas of [[], ['other-head']]) {
    const execution = run([{ ...pending, activeCodeqlShas }, success]);
    await expect(execution.result).rejects.toThrow('CodeQL (neutral)');
    expect(execution.reads()).toBe(1);
  }
});
test('every terminal non-success and untrusted producer fails without another read', async () => {
  for (const conclusion of [
    'failure',
    'cancelled',
    'timed_out',
    'skipped',
    'action_required',
    'stale',
    'startup_failure',
  ]) {
    const execution = run([
      {
        ...pending,
        checks: [{ ...pending.checks[0]!, conclusion }, pending.checks[1]!],
      },
      success,
    ]);
    await expect(execution.result).rejects.toThrow(conclusion);
    expect(execution.reads()).toBe(1);
  }
  const execution = run([
    {
      ...pending,
      checks: [...pending.checks, { ...pending.checks[0]!, appId: 99 }],
    },
    success,
  ]);
  await expect(execution.result).rejects.toThrow('untrusted');
  expect(execution.reads()).toBe(1);
});
test('missing or unfinished checks expire on virtual time, never pass', async () => {
  for (const snapshot of [pending, { checks: [], activeCodeqlShas: [] }]) {
    const execution = run([snapshot]);
    await expect(execution.result).rejects.toThrow(
      'readiness deadline exceeded'
    );
    expect(execution.now()).toBe(30);
    expect(execution.reads()).toBe(4);
  }
});
test('a producer finishing neutral is not retried until green', async () => {
  const execution = run([
    pending,
    { ...pending, activeCodeqlShas: [] },
    success,
  ]);
  await expect(execution.result).rejects.toThrow('CodeQL (neutral)');
  expect(execution.reads()).toBe(2);
});

test('metadata access errors fail closed without another read', async () => {
  let reads = 0;
  await expect(
    awaitRequiredPrChecks({
      required,
      emptyShardPlan: false,
      read: () => {
        reads++;
        throw new Error('GitHub denied access');
      },
      clock: { now: () => 0 },
      timers: {
        setTimeout: () => {
          throw new Error('must not wait');
        },
        clearTimeout: () => {},
        setInterval: () => {
          throw new Error('must not wait');
        },
        clearInterval: () => {},
      },
      timeoutMs: 30,
      intervalMs: 10,
    })
  ).rejects.toThrow('GitHub denied access');
  expect(reads).toBe(1);
});

test('metadata collection cannot grant success after the readiness deadline', async () => {
  await expect(run([success], 31).result).rejects.toThrow(
    'deadline exceeded during metadata collection'
  );
});

// regression: codeql-bundle-download-504
test('a tolerated neutral CodeQL result waits for its active producer', async () => {
  const tolerant = required.map((policy) => ({
    ...policy,
    outage_tolerant: true,
  }));
  const failedAnalysis = {
    ...pending.checks[1]!,
    status: 'completed',
    conclusion: 'failure',
  };
  const snapshots: readonly PrCheckSnapshot[] = [
    { activeCodeqlShas: [sha], checks: [pending.checks[0]!, failedAnalysis] },
    { activeCodeqlShas: [], checks: [pending.checks[0]!, failedAnalysis] },
  ];
  let reads = 0;
  let now = 0;
  const checks = await awaitRequiredPrChecks({
    required: tolerant,
    emptyShardPlan: false,
    read: () => snapshots[Math.min(reads++, snapshots.length - 1)]!,
    clock: { now: () => now },
    timers: {
      setTimeout: (fn, ms) => {
        now += ms;
        fn();
        return 0;
      },
      clearTimeout: () => {},
      setInterval: () => {
        throw new Error('unexpected interval');
      },
      clearInterval: () => {},
    },
    timeoutMs: 30,
    intervalMs: 10,
  });
  expect(checks).toEqual(snapshots[1]!.checks);
  expect(reads).toBe(2);
});

// regression: verify-end-awaits-itself
// Runs 42587259782 and 42592949094: every check had passed by 09:26:53Z, but
// verify:end saw its own in-progress run and waited out the deadline.
test('the running verify:end aggregate does not wait for itself', async () => {
  const self = {
    sha,
    name: 'verify:end',
    appId: 15368,
    status: 'in_progress',
    conclusion: null,
  };
  const snapshot = { ...success, checks: [...success.checks, self] };
  const execution = run([snapshot]);
  expect(await execution.result).toEqual(snapshot.checks);
  expect(execution.reads()).toBe(1);
});
