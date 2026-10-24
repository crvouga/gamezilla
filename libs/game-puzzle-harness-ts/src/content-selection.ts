import {
  readContentLibrary,
  workingContentDraft,
} from '@libs/game-puzzle-shared-ts/content-library';
import { contentBody } from '@libs/game-puzzle-shared-ts/content-types';
import { contentClient } from './content-actions';
import type { ContentHarness } from './content-system';

export async function selectContentDocument(
  s: ContentHarness,
  clientId: string,
  documentId: string
): Promise<void> {
  if (s.editors.get(clientId)?.documentId === documentId) return;
  const library = await readContentLibrary(contentClient(s, clientId).db);
  const draft = workingContentDraft(library, documentId);
  if (draft === null)
    throw new Error('This content draft is not available on the device');
  s.editors.set(clientId, {
    documentId,
    parentId: draft.id,
    body: contentBody(draft),
  });
}

export async function selectPuzzleEditor(
  s: ContentHarness,
  clientId: string
): Promise<void> {
  const documentId = s.selectedPuzzles.get(clientId);
  if (documentId !== undefined)
    await selectContentDocument(s, clientId, documentId);
}

export async function selectPackEditor(
  s: ContentHarness,
  clientId: string
): Promise<void> {
  const documentId = s.selectedPacks.get(clientId);
  if (documentId === undefined) throw new Error('Choose a pack draft');
  await selectContentDocument(s, clientId, documentId);
}
