import { workingContentDraft } from '@libs/game-puzzle-shared-ts/content-library';
import { useDecision } from '@libs/permissions-client-ts/use-can';
import { PERMISSION } from '@libs/permissions-shared-ts/permission-catalog';
import { useLingui } from '@lingui/solid/macro';
import type { JSX } from 'solid-js';
import { useContentGame } from './content-game-context';
import { useContentLibraryState } from './content-library-context';
import { ContentPackItemRow } from './content-pack-editor-view';

export function ContentPackItem(props: {
  id: string;
  first: boolean;
  last: boolean;
  disabled: boolean;
  onUp: () => void;
  onDown: () => void;
  onRemove: () => void;
}): JSX.Element {
  const { t } = useLingui();
  const game = useContentGame();
  const data = useContentLibraryState();
  const document = () =>
    data.content().documents.find((entry) => entry.id === props.id);
  const draft = () => workingContentDraft(data.content(), props.id);
  const revision = () =>
    data
      .content()
      .revisions.find(
        (entry) => entry.id === document()?.published_revision_id
      );
  const title = () =>
    (draft()?.title ?? revision()?.title ?? '') || t`Unavailable puzzle`;
  const decision = useDecision(PERMISSION.puzzlesEditContent, () => ({
    puzzleOwnerId: document()?.owner_id ?? '',
  }));
  const open = (): void => {
    if (decision().allowed) game.open({ kind: 'edit', documentId: props.id });
    else {
      const id = revision()?.id;
      if (id !== undefined)
        game.open({ kind: 'edition', revisionId: id, packRevisionId: null });
    }
  };
  return (
    <ContentPackItemRow
      id={props.id}
      title={title()}
      caption={
        draft()?.validation_status === 'invalid'
          ? t`Needs corrections`
          : document()?.status === 'published'
            ? t`Published`
            : t`Draft: publish it before the pack`
      }
      first={props.first}
      last={props.last}
      disabled={props.disabled}
      open={
        decision().allowed ? 'edit' : revision() === undefined ? null : 'view'
      }
      onOpen={open}
      onUp={() => props.onUp()}
      onDown={() => props.onDown()}
      onRemove={() => props.onRemove()}
    />
  );
}
