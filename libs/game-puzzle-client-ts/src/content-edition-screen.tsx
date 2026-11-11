import { useDecision } from '@libs/permissions-client-ts/use-can';
import { PERMISSION } from '@libs/permissions-shared-ts/permission-catalog';
import { createMemo, type JSX, Show } from 'solid-js';
import { contentEditionAvailable } from './content-availability';
import { ContentEditionScreenView } from './content-edition-screen-view';
import { useContentGame } from './content-game-context';
import { useContentLibraryState } from './content-library-context';
import { ContentPackOverview } from './content-pack-overview';
import { ContentPreview } from './content-preview';
import { ContentStartAttempt } from './content-start-attempt';
import { useDeniedView } from './use-denied-view';

/** `ContentEditionScreenView` wired to the library and permissions. */
export function ContentEditionScreen(props: {
  revisionId: string;
  packRevisionId: string | null;
}): JSX.Element {
  const game = useContentGame();
  const data = useContentLibraryState();
  const revision = createMemo(() =>
    data.content().revisions.find((entry) => entry.id === props.revisionId)
  );
  const document = createMemo(() =>
    data
      .content()
      .documents.find((entry) => entry.id === revision()?.document_id)
  );
  const available = () =>
    contentEditionAvailable(
      data.content(),
      props.revisionId,
      props.packRevisionId
    );
  const edit = useDecision(PERMISSION.puzzlesEditContent, () => ({
    puzzleOwnerId: document()?.owner_id ?? '',
  }));
  const play = useDecision(PERMISSION.puzzlesPlay);
  const playDenial = useDeniedView({
    get decision() {
      return play();
    },
  });
  const edition = createMemo(() => {
    const current = revision();
    return current === undefined
      ? null
      : {
          id: current.id,
          documentId: current.document_id,
          kind: current.kind,
          title: current.title,
          difficulty: current.difficulty,
          description: current.description,
        };
  });
  return (
    <ContentEditionScreenView
      edition={edition()}
      available={available()}
      canEdit={edit().allowed}
      playDenial={playDenial()}
      startAttempt={
        <ContentStartAttempt
          revisionId={props.revisionId}
          packRevisionId={props.packRevisionId}
          disabled={!available()}
        />
      }
      body={
        <Show
          when={revision()?.kind === 'pack'}
          fallback={
            <ContentPreview definition={revision()?.definition ?? ''} />
          }
        >
          <ContentPackOverview revisionId={props.revisionId} />
        </Show>
      }
      onEditWorkingDraft={() => {
        const documentId = revision()?.document_id;
        if (documentId !== undefined)
          game.open({ kind: 'builder', documentId });
      }}
      onReturnToLibrary={() => game.open({ kind: 'library' })}
    />
  );
}
