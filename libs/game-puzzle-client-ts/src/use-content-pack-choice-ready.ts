import { isBundledContent } from '@libs/game-puzzle-shared-ts/bundled-content';
import { decodePackDefinition } from '@libs/game-puzzle-shared-ts/content-pack';
import sql from '@pkgs/sql-root-shared-ts/sql';
import { createQuery } from '@pkgs/sync-engine-client-ts/sync-engine-context';
import type { Accessor } from 'solid-js';

/** Starting uses the pinned pack definition, without waiting for derived rows. */
export function useContentPackChoiceReady(
  revisionId: Accessor<string>,
  packRevisionId: Accessor<string | null>
): Accessor<boolean> {
  const editions = createQuery(
    () => sql<{ definition: string }>`
      SELECT definition FROM puzzle_content_revisions
      WHERE id = ${packRevisionId() ?? ''} AND deleted_at IS NULL
    `
  );
  return () => {
    const pack = packRevisionId();
    return (
      pack === null ||
      isBundledContent(pack) ||
      (decodePackDefinition(editions.rows()[0]?.definition ?? '')?.items.filter(
        (item) => item.revisionId === revisionId()
      ).length ?? 0) === 1
    );
  };
}
