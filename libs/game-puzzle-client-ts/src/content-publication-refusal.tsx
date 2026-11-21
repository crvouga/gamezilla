import { Handles } from '@libs/test-ids-shared-ts/handles';
import { useLingui } from '@lingui/solid/macro';
import type { WriteRefusal } from '@pkgs/sync-engine-client-ts/write-outcome-reads';
import { Notice } from '@pkgs/ui-root-client-ts/notice';
import type { JSX } from 'solid-js';

/**
 * Why the server refused a publication, in local words, by its first
 * finding's code (a remote message is never shown): what went wrong, that
 * the draft is kept, and what to do before publishing again.
 */
export function useRefusalReason(): (issue: string | null) => string {
  const { t } = useLingui();
  return (issue) => {
    if (issue === 'PUZZLE_TITLE_REQUIRED')
      return t`Publishing did not go ahead: the draft has no title. Your draft is kept. Add a title, then publish again.`;
    if (issue === 'PUZZLE_PLAYTEST_INCOMPLETE')
      return t`Publishing did not go ahead: its playtest was not finished. Your draft is kept. Finish a playtest, then publish again.`;
    if (issue === 'PACK_EMPTY')
      return t`Publishing did not go ahead: the pack holds no puzzles. Your draft is kept. Add a puzzle, then publish again.`;
    if (issue === 'PACK_PUZZLE_UNAVAILABLE')
      return t`Publishing did not go ahead: a puzzle in the pack is no longer available. Your draft is kept. Change the pack's puzzles, then publish again.`;
    if (issue === 'PACK_PUZZLE_UNPUBLISHED')
      return t`Publishing did not go ahead: a puzzle in the pack has not been published. Your draft is kept. Publish it first, then publish the pack again.`;
    if (issue !== null)
      return t`Publishing did not go ahead: the game cannot finish the puzzle from its board. Your draft is kept. Correct the board and playtest it, then publish again.`;
    return t`Publishing did not go ahead. Your draft is kept. Correct the draft, then publish again.`;
  };
}

/**
 * The builder's refused publication, said on its screens in the same words
 * as the publish screen's correction, with a way to put it away.
 */
export function ContentRefusalNotice(props: {
  refusal: WriteRefusal;
  /** The refusal's first finding, by its code. */
  issue: string | null;
  onDismiss: () => void;
}): JSX.Element {
  const reason = useRefusalReason();
  return (
    <Notice
      tone="warning"
      onDismiss={() => props.onDismiss()}
      dataSet={{
        testid: Handles.refusedChange,
        mutation: props.refusal.mutationName ?? '',
        code: props.refusal.code,
      }}
    >
      {reason(props.issue)}
    </Notice>
  );
}
