import type {
  ContentDocument,
  ContentRevision,
} from '@libs/game-puzzle-shared-ts/content-types';
import type { MutationFeedback } from '@pkgs/sync-engine-client-ts/mutation-status';

/** Presentation of this working copy, not a permission or validation decision. */
export type ContentPublicationCopyState =
  | { readonly kind: 'draft' }
  | { readonly kind: 'reading' }
  | { readonly kind: 'pending'; readonly connection: 'online' | 'offline' }
  | { readonly kind: 'edition'; readonly current: boolean };

export function contentPublicationCopyState(input: {
  readonly document: Pick<
    ContentDocument,
    'id' | 'published_revision_id' | 'status'
  >;
  readonly draftId: string;
  readonly dirty: boolean;
  /** Must be scoped to BOTH documentId and draftId by useMutationFeedback. */
  readonly feedback: MutationFeedback | null | undefined;
  readonly revisions: readonly Pick<
    ContentRevision,
    'id' | 'document_id' | 'deleted_at'
  >[];
  readonly online: boolean;
}): ContentPublicationCopyState {
  // Saving these edits creates another draft ID; an older edition cannot be its receipt.
  if (input.dirty) return { kind: 'draft' };
  if (input.feedback === undefined) return { kind: 'reading' };
  if (input.feedback?.status === 'pending')
    return { kind: 'pending', connection: input.online ? 'online' : 'offline' };
  if (input.feedback?.status === 'rejected') return { kind: 'draft' };
  const edition = input.revisions.some(
    (entry) =>
      entry.id === input.draftId &&
      entry.document_id === input.document.id &&
      entry.deleted_at === null
  );
  if (!edition) return { kind: 'draft' };
  return {
    kind: 'edition',
    current:
      input.document.status === 'published' &&
      input.document.published_revision_id === input.draftId,
  };
}
