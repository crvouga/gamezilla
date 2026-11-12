/**
 * Browser test builds (`VITE_TEST_HOOKS=1`, e.g. a localhost stack under test)
 * let the test harness send a write through the page's own mutation client,
 * the way `window.__testLocalSql` lets it read the page's own database. A
 * scenario's modified device (a command its screen would not offer, an
 * earlier revision, a repeated request id) then crosses the same client
 * boundary as the screen's controls: local apply, upload, and the server's
 * verdict. Never present for end users.
 *
 * A write's verdict can take as long as the device's connection does, so
 * sending returns a ticket at once and the harness polls the ticket.
 */

import type {
  MutateResult,
  Mutation,
  MutationRegistry,
} from '@pkgs/sync-engine-shared-ts/mutations-types';

export const TEST_MUTATIONS_GLOBAL = '__testMutations';

/** A ticket's outcome: the client's verdict, or the error it threw. */
export type TestMutationVerdict =
  | { readonly result: MutateResult }
  | { readonly error: string };

export type TestMutations = {
  /** Sends `name` with `args` (JSON); returns the ticket to poll. */
  send(name: string, args: string): string;
  /** The ticket's verdict as JSON, or `null` while it is still unanswered. */
  verdict(ticket: string): string | null;
};

type Mutate = <A>(mutation: Mutation<A>, args: A) => Promise<MutateResult>;

const env = import.meta.env as { VITE_TEST_HOOKS?: string };

/** Registers `mutate` as the client the hook sends through (test builds only). */
export function exposeMutationsForTests(
  mutate: Mutate,
  registry: MutationRegistry
): void {
  if (env.VITE_TEST_HOOKS !== '1') return;
  Reflect.set(
    globalThis,
    TEST_MUTATIONS_GLOBAL,
    createTestMutations(mutate, registry)
  );
}

export function createTestMutations(
  mutate: Mutate,
  registry: MutationRegistry
): TestMutations {
  const verdicts = new Map<string, TestMutationVerdict | null>();
  let sent = 0;
  return {
    send: (name, args) => {
      sent += 1;
      const ticket = String(sent);
      const mutation = Object.values(registry).find((m) => m.name === name);
      if (mutation === undefined) {
        verdicts.set(ticket, { error: `Unknown mutation ${name}` });
        return ticket;
      }
      verdicts.set(ticket, null);
      mutate(mutation, JSON.parse(args) as unknown).then(
        (result) => verdicts.set(ticket, { result }),
        (error: unknown) =>
          verdicts.set(ticket, {
            error: error instanceof Error ? error.message : String(error),
          })
      );
      return ticket;
    },
    verdict: (ticket) => {
      const verdict = verdicts.get(ticket);
      if (verdict === undefined) return JSON.stringify({ error: 'No ticket' });
      return verdict === null ? null : JSON.stringify(verdict);
    },
  };
}
