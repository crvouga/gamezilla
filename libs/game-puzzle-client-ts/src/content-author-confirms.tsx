import type { JSX } from 'solid-js';
import { ContentCopyConfirm } from './content-kept-copies';
import { ContentPackRemoval } from './content-pack-items';
import { ContentWithdrawConfirm } from './content-withdraw';
import type { ContentAuthorWorkspace } from './use-content-author-workspace';

/**
 * The builder's confirmation dialogs, owned by its shell so each survives
 * the small screen under it changing: withdrawing the publication,
 * continuing from another kept copy, taking a puzzle out of the pack.
 */
export function ContentAuthorConfirms(props: {
  workspace: ContentAuthorWorkspace;
}): JSX.Element {
  return (
    <>
      <ContentWithdrawConfirm
        visible={props.workspace.withdrawing()}
        onClose={() => props.workspace.setWithdrawing(false)}
        onWithdraw={props.workspace.publication.withdraw}
      />
      <ContentCopyConfirm
        visible={props.workspace.copyChoice.visible()}
        disabled={props.workspace.disabled() || props.workspace.writer.dirty()}
        onClose={props.workspace.copyChoice.close}
        onChoose={props.workspace.copyChoice.choose}
      />
      <ContentPackRemoval
        puzzleId={props.workspace.removing()}
        tools={props.workspace.packTools}
        onClose={() => props.workspace.setRemoving(null)}
      />
    </>
  );
}
