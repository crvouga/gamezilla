import { sql } from '@pkgs/sql';
import { defineMutation } from '@pkgs/sync-engine/shared';
import { z } from 'zod';

import { normalizeUsername } from '../../../shared/profile/username';

export const applyEnsuredUsernameMutation = defineMutation({
  name: 'applyEnsuredUsername',
  args: z.object({ username: z.string().min(1) }),
  async run({ tx, env }, { username }) {
    const next = normalizeUsername(username);
    await tx.run(sql`
      UPDATE profile
      SET username = ${next}, username_norm = ${next.toLowerCase()}
      WHERE id = ${env.actorId}
        AND (
          username = ''
          OR username IS NULL
          OR (
            username_changed_at IS NULL
            AND username != ${next}
          )
        )
    `);
  },
});
