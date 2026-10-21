import sql from '@pkgs/sql-root-shared-ts/sql';
import { defineMutation } from '@pkgs/sync-engine-shared-ts/define-mutation';
import { z } from 'zod';

/** Seed / claim a non-empty username for the actor's profile row. */
export const setProfileUsername = defineMutation({
  name: 'setProfileUsername',
  args: z.object({ username: z.string().min(1) }),
  async run({ tx, env }, { username }) {
    const norm = username.toLowerCase();
    await tx.run(sql`
      INSERT INTO profile (id, username, username_norm)
      VALUES (${env.actorId}, ${username}, ${norm})
      ON CONFLICT (id) DO UPDATE SET
        username = excluded.username,
        username_norm = excluded.username_norm,
        deleted_at = NULL
    `);
  },
});

/**
 * Bug-repro seed: INSERT empty username (ON CONFLICT DO NOTHING).
 * Write-capture fans out username='' to same-account peers unless framework
 * scrubbers drop incomplete profile images.
 */
export const ensureProfileEmpty = defineMutation({
  name: 'ensureProfileEmpty',
  args: z.object({}),
  async run({ tx, env }) {
    await tx.run(sql`
      INSERT INTO profile (id, username, username_norm)
      VALUES (${env.actorId}, ${''}, ${''})
      ON CONFLICT (id) DO NOTHING
    `);
  },
});
