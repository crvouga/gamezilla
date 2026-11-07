import { expect, test } from 'bun:test';
import { contentPublicationCopyState } from '@libs/game-puzzle-client-ts/content-publication-copy-state';

const CURRENT = {
  document: {
    id: 'document-a',
    published_revision_id: 'draft-a',
    status: 'published' as const,
  },
  draftId: 'draft-a',
  dirty: false,
  online: true,
  feedback: null,
  revisions: [{ id: 'draft-a', document_id: 'document-a', deleted_at: null }],
};

test('current-copy publication state does not mistake optimistic or older data for success', () => {
  // Modeled identity cases complement the literal PublishPending screenshots.
  const pending = {
    mutationId: 'publish-a',
    status: 'pending' as const,
    rejectionId: null,
    code: null,
    message: null,
  };
  expect(
    contentPublicationCopyState({ ...CURRENT, feedback: pending })
  ).toEqual({ kind: 'pending', connection: 'online' });
  expect(
    contentPublicationCopyState({
      ...CURRENT,
      feedback: pending,
      online: false,
    })
  ).toEqual({ kind: 'pending', connection: 'offline' });
  expect(
    contentPublicationCopyState({ ...CURRENT, feedback: undefined })
  ).toEqual({ kind: 'reading' });
  expect(
    contentPublicationCopyState({
      ...CURRENT,
      feedback: { ...pending, status: 'rejected' },
    })
  ).toEqual({ kind: 'draft' });
  expect(contentPublicationCopyState(CURRENT)).toEqual({
    kind: 'edition',
    current: true,
  });
  expect(
    contentPublicationCopyState({ ...CURRENT, dirty: true, feedback: pending })
  ).toEqual({ kind: 'draft' });
  expect(
    contentPublicationCopyState({ ...CURRENT, draftId: 'draft-b' })
  ).toEqual({ kind: 'draft' });
  expect(
    contentPublicationCopyState({
      ...CURRENT,
      document: { ...CURRENT.document, status: 'withdrawn' },
    })
  ).toEqual({ kind: 'edition', current: false });
  expect(
    contentPublicationCopyState({
      ...CURRENT,
      document: { ...CURRENT.document, published_revision_id: 'draft-b' },
    })
  ).toEqual({ kind: 'edition', current: false });
});

test('only a kept edition of this document identifies this working copy', () => {
  expect(
    contentPublicationCopyState({
      ...CURRENT,
      revisions: [
        { id: 'draft-a', document_id: 'other-document', deleted_at: null },
      ],
    })
  ).toEqual({ kind: 'draft' });
  expect(
    contentPublicationCopyState({
      ...CURRENT,
      revisions: [
        { id: 'draft-a', document_id: 'document-a', deleted_at: '2026-01-01' },
      ],
    })
  ).toEqual({ kind: 'draft' });
});
