import { describe, expect, test } from 'bun:test';
import { retireWorker } from '@libs/infra-shared-ts/worker-retirement';
import { technicalName } from '@libs/product-identity-shared-ts/technical-names';

const success = { exitCode: 0, stdout: 'Deleted', stderr: '' };
const cleanupFailure = {
  exitCode: 1,
  stdout: '',
  stderr:
    'A request to /storage/kv/namespaces failed. Authentication error [code: 10000]',
};

describe('Worker retirement completion', () => {
  // regression: wrangler-retirement-kv-cleanup-auth
  test('a deleted Worker completes retirement despite legacy KV cleanup failure', async () => {
    let calls = 0;
    const result = await retireWorker(
      technicalName(['api', 'development']),
      () => {
        calls += 1;
        return cleanupFailure;
      },
      { scriptExists: async () => false }
    );
    expect(result).toBe(cleanupFailure);
    expect(calls).toBe(1);
  });

  test('a still-present Worker fails even when the command reports success', async () => {
    for (const result of [success, cleanupFailure]) {
      await expect(
        retireWorker('old-worker', () => result, {
          scriptExists: async () => true,
        })
      ).rejects.toThrow('Worker still exists');
    }
  });

  test('an unreadable inventory never counts as completed retirement', async () => {
    await expect(
      retireWorker('old-worker', () => success, {
        scriptExists: async () => {
          throw new Error('inventory unavailable');
        },
      })
    ).rejects.toThrow('inventory unavailable');
  });
});
