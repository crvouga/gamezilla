import type {
  ContentDocument,
  ContentDraft,
} from '@libs/game-puzzle-shared-ts/content-types';
import { useDecision } from '@libs/permissions-client-ts/use-can';
import { PERMISSION } from '@libs/permissions-shared-ts/permission-catalog';
import type { Accessor, JSX } from 'solid-js';
import { ContentPublicationControlsView } from './content-publication-controls-view';
import type { ContentAuthorPublication } from './use-content-author-publication';
import { useDeniedView } from './use-denied-view';

function validationMessage(draft: ContentDraft | undefined): string {
  if (draft?.validation_status !== 'invalid') return '';
  try {
    const issues: unknown = JSON.parse(draft.validation_issues);
    return Array.isArray(issues)
      ? issues
          .flatMap((issue) =>
            typeof issue === 'object' &&
            issue !== null &&
            'message' in issue &&
            typeof issue.message === 'string'
              ? [issue.message]
              : []
          )
          .join(' ')
      : '';
  } catch {
    return '';
  }
}

/**
 * Where the failed check's first finding is corrected: a missing title in
 * the details, anything about the definition on the board. A playtest
 * finding (or none) names no place.
 */
function fixTarget(
  draft: ContentDraft | undefined
): 'details' | 'board' | undefined {
  if (draft?.validation_status !== 'invalid') return undefined;
  try {
    const issues: unknown = JSON.parse(draft.validation_issues);
    const first: unknown = Array.isArray(issues) ? issues[0] : undefined;
    const code =
      typeof first === 'object' &&
      first !== null &&
      'code' in first &&
      typeof first.code === 'string'
        ? first.code
        : null;
    if (code === null || code === 'PUZZLE_PLAYTEST_INCOMPLETE')
      return undefined;
    return code === 'PUZZLE_TITLE_REQUIRED' ? 'details' : 'board';
  } catch {
    return undefined;
  }
}

/**
 * The builder's publish screen wired to the draft's standing and the
 * publish permission; `before` (a puzzle's playtest) comes first among its
 * actions, and withdrawing asks the builder's shell to confirm.
 */
export function ContentPublicationControls(props: {
  document: ContentDocument;
  publication: ContentAuthorPublication;
  disabled: boolean;
  before?: ((next: Accessor<boolean>) => JSX.Element) | undefined;
  onWithdraw: () => void;
  /** Opens the details or the board, to correct what blocks publishing. */
  onFix: (where: 'details' | 'board') => void;
}): JSX.Element {
  const decision = useDecision(PERMISSION.puzzlesPublishContent, () => ({
    puzzleOwnerId: props.document.owner_id,
  }));
  const publishDenial = useDeniedView({
    get decision() {
      return decision();
    },
  });
  const tools = () => props.publication.tools;
  return (
    <ContentPublicationControlsView
      before={props.before}
      kind={props.document.kind}
      validation={tools().draft()?.validation_status ?? null}
      validationMessage={validationMessage(tools().draft())}
      fixTarget={fixTarget(tools().draft())}
      proven={tools().proven()}
      waitingOn={tools().waitingOn()}
      pending={props.publication.status.pending()}
      copyState={props.publication.copyState()}
      publishDenial={publishDenial()}
      published={props.document.published_revision_id !== null}
      disabled={props.disabled}
      playable={props.publication.playable()}
      onValidate={tools().validate}
      onPublish={tools().publish}
      onViewPublication={props.publication.viewPublication}
      onWithdraw={props.onWithdraw}
      onFix={props.onFix}
      refused={props.publication.status.refused()}
      onOpenWaiting={props.publication.openWaiting}
    />
  );
}
