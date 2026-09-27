import { sql } from '@pkgs/sql';
import { defineQuery } from '@pkgs/sync-engine/shared';
import { z } from 'zod';

import { actorVisibleSpacesPredicateSql } from '../../../shared/space/actor-visible-spaces-sql';

/**
 * One space, for whoever holds its link (`/space/<id>`). The id is the
 * capability: a public space's row reaches anyone who has it — a guest with
 * no account, someone who is not the host's friend — so the join screen can
 * offer Join. A private space answers only to the people `mySpaces` already
 * shows it to. Tombstones included, like every snapshot query.
 */
export const spaceByLink = defineQuery({
  name: 'spaceByLink',
  params: z.object({ spaceId: z.string().min(1) }),
  sampleParams: { spaceId: 'space_x' },
  limit: 1,
  async run(ctx, { spaceId }) {
    const visible = actorVisibleSpacesPredicateSql(ctx.env.actorId);
    const rows = await ctx.db.query(sql`
      SELECT
        id, title, host_id, created_at, ended_at, visibility,
        host_account_id, host_member_id, deleted_at
      FROM spaces
      WHERE id = ${spaceId}
        AND (visibility = 'public' OR ${visible})`);
    return { spaces: rows };
  },
});
