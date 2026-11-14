import {
  createMessageNamespace,
  isPlainRecord,
} from '@pkgs/message-shared-ts/message';
import { defineOutboxConsumer } from '@pkgs/outbox-shared-ts/define-consumer';
import { Outbox } from '@pkgs/outbox-shared-ts/outbox';
import type { SqlTx } from '@pkgs/sql-client-root-shared-ts/interface';
import sql from '@pkgs/sql-root-shared-ts/sql';
import type {
  MutationCtx,
  MutationDb,
  MutationEnv,
} from '@pkgs/sync-engine-shared-ts/mutations-types';
import type {
  ContentDocument,
  ContentDocumentRow,
  ContentPublication,
} from './content-types';

/** `syntheticAt`: when automated monitoring published this edition, else null. */
export async function writeContentPublication(
  tx: MutationDb,
  publication: ContentPublication,
  syntheticAt: string | null
): Promise<void> {
  await tx.run(sql`
    INSERT INTO puzzle_content_publications
      (id, owner_id, game_id, kind, published_revision_id, publication_count, status, published_at, synthetic_at)
    VALUES (${publication.id}, ${publication.owner_id}, ${publication.game_id}, ${publication.kind},
      ${publication.published_revision_id}, ${publication.publication_count}, ${publication.status},
      ${publication.published_at}, ${syntheticAt})
    ON CONFLICT (id) DO UPDATE SET
      published_revision_id = excluded.published_revision_id,
      publication_count = excluded.publication_count, status = excluded.status,
      published_at = excluded.published_at, synthetic_at = excluded.synthetic_at,
      deleted_at = NULL
  `);
}

/** Private documents retain the author's current working head; public heads are complete on their own. */
export function contentDocuments(
  documents: readonly ContentDocumentRow[],
  publications: readonly ContentPublication[]
): readonly ContentDocument[] {
  const heads = new Map(publications.map((head) => [head.id, head]));
  const own = new Map<string, ContentDocument>(
    documents.map((document) => [
      document.id,
      {
        ...document,
        published_at: heads.get(document.id)?.published_at ?? null,
      },
    ])
  );
  for (const publication of publications)
    if (!own.has(publication.id))
      own.set(publication.id, { ...publication, working_draft_id: null });
  return [...own.values()];
}

/*
 * Automated monitoring (the live Health journeys) publishes packs as a
 * synthetic author and withdraws them when the run ends. A run that fails
 * before its cleanup would leave its pack near the top of Browse for real
 * people, so every synthetic publication also schedules its own withdrawal an
 * hour later through the outbox; the scheduled sweep that drains the outbox
 * runs it. Synthetic provenance is the host's verified `MutationEnv.synthetic`,
 * never a mutation argument, so a person cannot have their own pack withdrawn.
 */

/** How long a synthetic publication stays public: past any Health run. */
export const SYNTHETIC_PUBLICATION_LIFETIME_MS = 60 * 60 * 1000;

export const syntheticPublicationExpiry = createMessageNamespace(
  'puzzle-content',
  'outbox'
)(
  'synthetic-publication-expiry',
  (value): value is { readonly documentId: string } =>
    isPlainRecord(value) &&
    typeof value['documentId'] === 'string' &&
    value['documentId'].length > 0
);

/**
 * When a publication counts as synthetic: the authoritative replay's server
 * time, only for a host-verified synthetic actor. Optimistic application and
 * every person's publication record null.
 */
export function syntheticPublicationAt(
  env: Pick<MutationEnv, 'synthetic' | 'serverNow'>
): string | null {
  if (env.synthetic !== true || env.serverNow === undefined) return null;
  return env.serverNow().toISOString();
}

/** One withdrawal per synthetic edition; publishing it again schedules nothing new. */
export async function scheduleSyntheticPublicationExpiry(
  ctx: Pick<MutationCtx, 'tx' | 'env'>,
  documentId: string,
  syntheticAt: string
): Promise<void> {
  const id = `puzzle-content.synthetic-publication-expiry:${JSON.stringify([documentId, syntheticAt])}`;
  await new Outbox({ tx: ctx.tx, env: ctx.env }).send({
    id,
    message: syntheticPublicationExpiry({ documentId }),
    availableAt: new Date(
      Date.parse(syntheticAt) + SYNTHETIC_PUBLICATION_LIFETIME_MS
    ),
  });
}

/**
 * Withdraw `documentId` when it is still a published synthetic publication
 * older than {@link SYNTHETIC_PUBLICATION_LIFETIME_MS}; the same withdrawal an
 * author makes. Anything else is left alone, so a repeat is a no-op.
 * Returns the owners whose documents changed.
 */
export async function withdrawExpiredSyntheticPublication(
  tx: SqlTx,
  documentId: string,
  nowMs: number
): Promise<readonly string[]> {
  const cutoff = new Date(nowMs - SYNTHETIC_PUBLICATION_LIFETIME_MS);
  const expired = await tx.query(sql<{ owner_id: string | null }>`
    SELECT owner_id FROM puzzle_content_publications
    WHERE id = ${documentId} AND status = ${'published'}
      AND synthetic_at IS NOT NULL AND synthetic_at <= ${cutoff.toISOString()}
      AND deleted_at IS NULL
  `);
  if (expired.length === 0) return [];
  await tx.run(sql`
    UPDATE puzzle_content_publications SET status = ${'withdrawn'}
    WHERE id = ${documentId} AND deleted_at IS NULL
  `);
  await tx.run(sql`
    UPDATE puzzle_content_documents SET status = ${'withdrawn'}
    WHERE id = ${documentId} AND status = ${'published'} AND deleted_at IS NULL
  `);
  const owner = expired[0]?.owner_id ?? null;
  return owner === null ? [] : [owner];
}

/** Runs each scheduled withdrawal; the drain's delivery span is its telemetry. */
export const syntheticPublicationExpiryConsumer = defineOutboxConsumer({
  id: 'puzzle-content.synthetic-publication-expiry',
  delivery: 'background',
  on: syntheticPublicationExpiry,
  async handler(ctx, payload) {
    const notifyUserIds = await withdrawExpiredSyntheticPublication(
      ctx.tx,
      payload.documentId,
      ctx.clock.now()
    );
    return { notifyUserIds };
  },
});
