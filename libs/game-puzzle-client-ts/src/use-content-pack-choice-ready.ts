import { isBundledContent } from '@libs/game-puzzle-shared-ts/bundled-content';
import sql from '@pkgs/sql-root-shared-ts/sql';
import { createQuery } from '@pkgs/sync-engine-client-ts/sync-engine-context';
import type { Accessor } from 'solid-js';

/** A published pack's choice must reach local storage before its mutation can run. */
export function useContentPackChoiceReady(
  revisionId: Accessor<string>,
  packRevisionId: Accessor<string | null>
): Accessor<boolean> {
  const references = createQuery(
    () => sql<{ matches: number }>`
      SELECT COUNT(*) AS matches FROM puzzle_content_pack_items
      WHERE pack_revision_id = ${packRevisionId() ?? ''}
        AND puzzle_revision_id = ${revisionId()} AND deleted_at IS NULL
    `
  );
  return () => {
    const pack = packRevisionId();
    return (
      pack === null ||
      isBundledContent(pack) ||
      references.rows()[0]?.matches === 1
    );
  };
}
