import type { HarnessWorld } from '@libs/harness-ts/spec-world';

/** Where a scenario keeps the username an actor renamed themselves to. */
export function usernameKey(actor: string): string {
  return `username:${actor}`;
}

/** The username `actor` renamed themselves to, or their own name. */
export function rememberedUsername(w: HarnessWorld, actor: string): string {
  const name = w.memo.get(usernameKey(actor));
  return typeof name === 'string' ? name : actor;
}
