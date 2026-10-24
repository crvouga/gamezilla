import {
  contentDraftCopies,
  discoverContent,
  readContentLibrary,
  workingContentDraft,
} from '@libs/game-puzzle-shared-ts/content-library';
import type { ContentDraft } from '@libs/game-puzzle-shared-ts/content-types';
import { contentClient } from './content-actions';
import type { ContentHarness } from './content-system';
import { examplePuzzleContent } from './example-app-rules';

export async function currentSavedContentDraft(
  s: ContentHarness,
  clientId: string
): Promise<ContentDraft | null> {
  const editor = s.editors.get(clientId);
  if (editor === undefined) return null;
  return workingContentDraft(
    await readContentLibrary(contentClient(s, clientId).db),
    editor.documentId
  );
}

export async function contentDraftTitle(
  s: ContentHarness,
  clientId: string
): Promise<string | null> {
  return (await currentSavedContentDraft(s, clientId))?.title ?? null;
}

export async function contentDraftIncomplete(
  s: ContentHarness,
  clientId: string
): Promise<boolean> {
  const draft = await currentSavedContentDraft(s, clientId);
  return (
    draft !== null &&
    !examplePuzzleContent.rules.validateDefinition(draft.definition).valid
  );
}

export async function contentDiscoverable(
  s: ContentHarness,
  clientId: string,
  title: string
): Promise<boolean> {
  const library = await readContentLibrary(contentClient(s, clientId).db);
  return discoverContent(library, 'counting').some(
    (edition) => edition.kind === 'puzzle' && edition.title === title
  );
}

export function contentNotice(
  s: ContentHarness,
  clientId: string
): string | null {
  const result = s.lastResult.get(clientId);
  return result?.ok === false
    ? (result.failures[0]?.code ?? 'unknown')
    : (s.notices.get(clientId) ?? null);
}

export function contentDetailsOpen(
  s: ContentHarness,
  clientId: string
): boolean {
  return s.editors.has(clientId);
}

export async function savedContentCopyTitles(
  s: ContentHarness,
  clientId: string
): Promise<readonly string[]> {
  const editor = s.editors.get(clientId);
  if (editor === undefined) return [];
  const library = await readContentLibrary(contentClient(s, clientId).db);
  return contentDraftCopies(library, editor.documentId).map(
    (draft) => draft.title
  );
}

export async function conflictingContentCopies(
  s: ContentHarness,
  clientId: string
): Promise<boolean> {
  const editor = s.editors.get(clientId);
  if (editor === undefined) return false;
  const library = await readContentLibrary(contentClient(s, clientId).db);
  return contentDraftCopies(library, editor.documentId).some(
    (draft) => draft.conflicted
  );
}
