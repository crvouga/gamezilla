import { describe, expect, test } from 'bun:test';
import { createTestMutations } from '@libs/app-root-shared-ts/test-mutations';
import type {
  MutateResult,
  Mutation,
  MutationRegistry,
} from '@pkgs/sync-engine-shared-ts/mutations-types';

const offer = { name: 'offerDraw' } as unknown as Mutation<unknown>;
const registry: MutationRegistry = { offerDraw: offer };

describe('createTestMutations', () => {
  test('a ticket stays unanswered until the client gives its verdict', async () => {
    let answer: (result: MutateResult) => void = () => {};
    const sent: unknown[] = [];
    const hook = createTestMutations(<A>(m: Mutation<A>, args: A) => {
      sent.push([m, args]);
      return new Promise<MutateResult>((resolve) => {
        answer = resolve;
      });
    }, registry);
    const ticket = hook.send('offerDraw', JSON.stringify({ gameId: 'g1' }));
    expect(sent).toEqual([[offer, { gameId: 'g1' }]]);
    expect(hook.verdict(ticket)).toBeNull();
    answer({ ok: true, mutationId: 'm1' });
    await Promise.resolve();
    expect(JSON.parse(hook.verdict(ticket)!)).toEqual({
      result: { ok: true, mutationId: 'm1' },
    });
  });

  test('an unknown mutation or a thrown client error is the verdict', async () => {
    const hook = createTestMutations(
      () => Promise.reject(new Error('offline')),
      registry
    );
    expect(JSON.parse(hook.verdict(hook.send('nope', '{}'))!)).toEqual({
      error: 'Unknown mutation nope',
    });
    const ticket = hook.send('offerDraw', '{}');
    await Promise.resolve();
    await Promise.resolve();
    expect(JSON.parse(hook.verdict(ticket)!)).toEqual({ error: 'offline' });
  });
});
