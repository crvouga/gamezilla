import type { ProductHarness } from '@libs/harness-ts/harness';
import { spaceByLink } from '@libs/spaces-shared-ts/space-by-link-query';
import sql from '@pkgs/sql-root-shared-ts/sql';
import { scopeHash } from '@pkgs/sync-engine-shared-ts/canonical';

/** Compare the guest's copy of the invitation with the server only after opening times out. */
export async function describeSpaceLinkOpening(
  s: ProductHarness,
  actorId: string,
  link: string
): Promise<string> {
  const actor = s.actors.get(actorId);
  const spaceId = /^\/space\/([^/?#]+)/.exec(link)?.[1];
  if (!actor?.browser || !spaceId) return '';
  const scope = scopeHash(spaceByLink.name, { spaceId });
  const local = actor.localSql();
  let device = local === null ? 'no database' : 'unanswered';
  let server = 'unanswered';
  const readDevice = async () => {
    if (local === null) return;
    const [row] = await local.query(sql<{ space: string; scope: string }>`
      SELECT CASE WHEN EXISTS (SELECT 1 FROM spaces WHERE id = ${spaceId}
        AND deleted_at IS NULL) THEN 'present' ELSE 'absent' END AS space,
        CASE WHEN EXISTS (SELECT 1 FROM sync_engine_scope_meta
          WHERE scope_hash = ${scope} AND deleted_at IS NULL)
        THEN 'applied' ELSE 'absent' END AS scope
    `);
    if (row) device = `${row.space}, link scope=${row.scope}`;
  };
  const readServer = async () => {
    const [row] = await s.harness.serverSql.sqlClient.query(sql<{
      state: string;
    }>`
      SELECT CASE WHEN deleted_at IS NOT NULL THEN 'deleted'
        WHEN ended_at IS NOT NULL THEN 'ended' ELSE visibility END AS state
      FROM spaces WHERE id = ${spaceId}
    `);
    server = row?.state ?? 'absent';
  };
  const timers = s.session.ports.timers;
  let timer: unknown;
  try {
    await Promise.race([
      Promise.allSettled([readDevice(), readServer()]),
      new Promise<void>((resolve) => {
        timer = timers.setTimeout(resolve, 1000);
      }),
    ]);
    return `; device space=${device}; server space=${server}`;
  } finally {
    timers.clearTimeout(timer);
  }
}
