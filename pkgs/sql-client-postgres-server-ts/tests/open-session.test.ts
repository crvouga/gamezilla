import { expect, test } from 'bun:test';
import { openSession } from '@pkgs/sql-client-postgres-server-ts/open-session';

// regression: postgres-failed-open-session-leak
for (const phase of ['transport', 'schema'] as const) {
  test(`failed ${phase} closes the connection and preserves the cause`, async () => {
    const calls: string[] = [];
    const error = new Error(phase);
    await expect(
      openSession({
        connect: async () => {
          calls.push('connect');
          if (phase === 'transport') throw error;
        },
        initialize: async () => {
          calls.push('schema');
          throw error;
        },
        close: async () => {
          calls.push('close');
          throw new Error('cleanup');
        },
        observe: async (stage, run) => {
          calls.push(`start:${stage}`);
          try {
            await run();
          } finally {
            calls.push(`end:${stage}`);
          }
        },
      })
    ).rejects.toBe(error);
    expect(calls.at(-1)).toBe('close');
    expect(calls).toContain(`end:${phase}`);
    expect(calls.filter((call) => call === 'close')).toHaveLength(1);
  });
}

test('successful opens retain the session and observe transport before schema', async () => {
  const calls: string[] = [];
  await openSession({
    connect: async () => {
      calls.push('connect');
    },
    initialize: async () => {
      calls.push('schema');
    },
    close: async () => {
      calls.push('close');
    },
    observe: async (stage, run) => {
      calls.push(stage);
      await run();
    },
  });
  expect(calls).toEqual(['transport', 'connect', 'schema', 'schema']);
});
