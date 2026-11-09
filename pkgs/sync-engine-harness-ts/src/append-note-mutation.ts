import sql from '@pkgs/sql-root-shared-ts/sql';
import { defineMutation } from '@pkgs/sync-engine-shared-ts/define-mutation';
import { z } from 'zod';

/**
 * Appends `|token` to a live note's body. Deliberately not idempotent: a write
 * applied twice leaves its token twice, so crash tests can count how many
 * times each write landed.
 */
export const appendNoteToken = defineMutation({
  name: 'appendNoteToken',
  args: z.object({
    id: z.string(),
    token: z.string(),
  }),
  async run({ tx }, { id, token }) {
    await tx.run(sql`
      UPDATE notes
      SET body = body || ${`|${token}`}
      WHERE id = ${id} AND deleted_at IS NULL
    `);
  },
});

/** Tokens in an appended body, in order (`'seed|a|b'` → `['a', 'b']`). */
export function appendedTokens(body: string): string[] {
  return body.split('|').slice(1);
}
