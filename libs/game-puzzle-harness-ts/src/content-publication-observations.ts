import { readContentLibrary } from '@libs/game-puzzle-shared-ts/content-library';
import { contentClient } from './content-actions';
import { currentSavedContentDraft } from './content-observations';
import type { ContentHarness } from './content-system';

export function contentIssue(
  s: ContentHarness,
  clientId: string
): string | null {
  const result = s.lastResult.get(clientId);
  if (result?.ok !== false) return null;
  const issues = result.failures[0]?.meta?.['issues'];
  if (!Array.isArray(issues)) return result.failures[0]?.code ?? null;
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
