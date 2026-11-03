import { useLingui } from '@lingui/solid/macro';

function publicationIssue(meta: string | null): string | null {
  if (meta === null) return null;
  try {
    const value: unknown = JSON.parse(meta);
    if (typeof value !== 'object' || value === null || !('issues' in value))
      return null;
    const first: unknown = Array.isArray(value.issues) ? value.issues[0] : null;
    return typeof first === 'object' &&
      first !== null &&
      'code' in first &&
      typeof first.code === 'string'
      ? first.code
      : null;
  } catch {
    return null;
  }
}

/** Known reason codes choose local copy; remote messages are never rendered. */
export function useRefusedPublicationCopy(): (
  code: string,
  meta: string | null
) => string | undefined {
  const { t } = useLingui();
  return (code, meta) => {
    if (code !== 'PUZZLE_PUBLICATION_INVALID') return undefined;
    const issue = publicationIssue(meta);
    if (issue === 'PACK_PUZZLE_UNAVAILABLE')
      return t`A chosen puzzle is no longer available. Your pack draft is kept. Choose an available puzzle, or publish that puzzle again, then choose Publish for this pack.`;
    if (issue === 'PACK_PUZZLE_UNPUBLISHED')
      return t`A chosen puzzle has not been published. Your pack draft is kept. Publish its puzzles first, then choose Publish for this pack.`;
    if (issue === 'PACK_EMPTY')
      return t`Your pack draft is kept. Add a published puzzle, then choose Publish again.`;
    return t`Your draft is kept. Check its validation details, correct the draft, then choose Publish again.`;
  };
}
