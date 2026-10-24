import { readContentLibrary } from '@libs/game-puzzle-shared-ts/content-library';
import { contentClient } from './content-actions';
import { currentSavedContentDraft } from './content-observations';
import type { ContentHarness } from './content-system';

export async function contentIssue(
  s: ContentHarness,
  clientId: string
): Promise<string | null> {
  const result = s.lastResult.get(clientId);
  const local = result?.ok === false ? result.failures[0] : undefined;
  if (local?.meta !== undefined) return issueCode(local.meta) ?? local.code;
  const editor = s.editors.get(clientId);
  const choice = s.publicationResults.get(editor?.documentId ?? '');
  if (choice?.ok === true) {
    const rejection = (
      await contentClient(s, clientId).engine.listRejections()
    ).find((entry) => entry.mutationId === choice.mutationId);
    if (rejection !== undefined) {
      const meta: unknown =
        rejection.meta === null ? null : JSON.parse(rejection.meta);
      return issueCode(meta) ?? rejection.code;
    }
  }
  return local?.code ?? null;
}

function issueCode(meta: unknown): string | null {
  if (typeof meta !== 'object' || meta === null || !('issues' in meta))
    return null;
  const issues = meta.issues;
  if (!Array.isArray(issues)) return null;
  const first: unknown = issues[0];
  return typeof first === 'object' &&
    first !== null &&
    'code' in first &&
    typeof first.code === 'string'
    ? first.code
    : null;
}

export async function contentEditionTitles(
  s: ContentHarness
): Promise<readonly string[]> {
  const editor = s.editors.get('alice:phone');
  if (editor === undefined) return [];
  const library = await readContentLibrary(contentClient(s, 'alice:phone').db);
  return library.revisions
    .filter((edition) => edition.document_id === editor.documentId)
    .sort((a, b) => a.edition - b.edition)
    .map((edition) => edition.title);
}

export async function contentValidationStatus(
  s: ContentHarness
): Promise<string | null> {
  return (
    (await currentSavedContentDraft(s, 'alice:phone'))?.validation_status ??
    null
  );
}

export async function contentValidationIssues(
  s: ContentHarness
): Promise<boolean> {
  const draft = await currentSavedContentDraft(s, 'alice:phone');
  return (
    draft?.validation_status === 'invalid' && draft.validation_issues !== '[]'
  );
}
