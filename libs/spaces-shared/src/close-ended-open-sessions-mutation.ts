import sql from '@pkgs/sql-root-shared/sql';
import { defineMutation } from '@pkgs/sync-engine-shared/define-mutation';
import { z } from 'zod';

export const closeEndedOpenSessionsMutation = defineMutation({
  name: 'closeEndedOpenSessions',
  args: z.object({}),
  async run({ tx, env }) {
    await tx.run(sql`
      UPDATE spaces_open_sessions
      SET deleted_at = ${env.now().toISOString()}
      WHERE deleted_at IS NULL
        AND space_id IN (SELECT id FROM spaces WHERE ended_at IS NOT NULL)
    `);
  },
});
