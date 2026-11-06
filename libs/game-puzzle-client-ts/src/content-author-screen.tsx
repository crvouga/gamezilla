import type {
  ContentBody,
  ContentDocument,
  ContentDraft,
} from '@libs/game-puzzle-shared-ts/content-types';
import { useDecision } from '@libs/permissions-client-ts/use-can';
import { PERMISSION } from '@libs/permissions-shared-ts/permission-catalog';
import { createMemo, type JSX, Show } from 'solid-js';
import { ContentAuthorScreenView } from './content-author-screen-view';
import { ContentAuthorStage } from './content-author-stage';
import { ContentDraftHistory } from './content-draft-history';
import { ContentDraftPlaytest } from './content-draft-playtest';
import { useContentGame } from './content-game-context';
import { ContentKeptCopies } from './content-kept-copies';
import { useContentLibraryState } from './content-library-context';
import { ContentPackEditor } from './content-pack-editor';
import { ContentPackPreview } from './content-pack-preview';
import { ContentPublicationControls } from './content-publication-controls';
import { useContentAuthorWorkspace } from './use-content-author-workspace';
import { useDeniedView } from './use-denied-view';

type AuthorWorkspace = ReturnType<typeof useContentAuthorWorkspace>;

/** What the view's builder props hold before there is a working copy. */
const NO_BODY: ContentBody = {
  title: '',
  description: '',
  difficulty: '',
  definition: '',
};
const NO_SAVE = { saving: false, dirty: false, error: null } as const;

/** The game's editor, the pack editor, or a preview of either. */
function AuthorStage(props: {
  document: ContentDocument;
  workspace: AuthorWorkspace;
}): JSX.Element {
  return (
    <Show
      when={props.document.kind === 'pack'}
      fallback={
        <ContentAuthorStage
          writer={props.workspace.writer}
          preview={props.workspace.preview()}
          disabled={props.workspace.adopting() !== null}
        />
      }
    >
      <Show
        when={!props.workspace.preview()}
        fallback={
          <ContentPackPreview
            definition={props.workspace.writer.body().definition}
          />
        }
      >
        <ContentPackEditor
          writer={props.workspace.writer}
          disabled={props.workspace.disabled()}
          tools={props.workspace.packTools}
        />
      </Show>
    </Show>
  );
}

/** The builder for one working copy, wired to saves, history and copies. */
function AuthorWorkspaceScreen(props: {
  document: ContentDocument;
  initial: ContentDraft;
  onReturnToLibrary: () => void;
}): JSX.Element {
  const workspace = useContentAuthorWorkspace(
    () => props.document,
    () => props.initial
  );
  const { writer } = workspace;
  return (
    <ContentAuthorScreenView
      status="ready"
      documentId={props.document.id}
      kind={props.document.kind}
      body={writer.body()}
      save={{
        saving: writer.saving(),
        dirty: writer.dirty(),
        error: writer.error(),
      }}
      conflicted={workspace.conflicted()}
      metadataDisabled={
        workspace.adopting() !== null || workspace.packPending()
      }
      disabled={workspace.disabled()}
      preview={workspace.preview()}
      history={
        <ContentDraftHistory
          writer={writer}
          history={workspace.history}
          disabled={
            workspace.disabled() || workspace.conflicted() || writer.dirty()
          }
        />
      }
      publication={
        <ContentPublicationControls
          document={props.document}
          writer={writer}
          disabled={workspace.disabled() || workspace.conflicted()}
          before={(next) => (
            <Show when={props.document.kind === 'puzzle'}>
              <ContentDraftPlaytest
                documentId={props.document.id}
                writer={writer}
                next={next()}
                disabled={workspace.disabled()}
              />
            </Show>
          )}
        />
      }
      stage={<AuthorStage document={props.document} workspace={workspace} />}
      keptCopies={
        <ContentKeptCopies
          document={props.document}
          currentId={writer.draftId()}
          disabled={workspace.disabled() || writer.dirty()}
          onChoose={workspace.chooseCopy}
        />
      }
      onChangeBody={writer.change}
      onSaveAgain={() => {
        void writer.save();
      }}
      onTogglePreview={() => workspace.setPreview((value) => !value)}
      onReturnToLibrary={props.onReturnToLibrary}
    />
  );
}

/** `ContentAuthorScreenView` wired to the library, permissions and saves. */
export function ContentAuthorScreen(props: {
  documentId: string;
}): JSX.Element {
  const game = useContentGame();
  const data = useContentLibraryState();
  const document = createMemo(() =>
    data
      .content()
      .documents.find(
        (entry) => entry.id === props.documentId && entry.deleted_at === null
      )
  );
  const draft = createMemo(() =>
    data
      .content()
      .drafts.find((entry) => entry.id === document()?.working_draft_id)
  );
  // Independent SQL watches can deliver the new head before its draft row.
  // Keep the workspace alive: only an explicit choice adopts another body.
  const initial = createMemo<ContentDraft | null>(
    (first) => first ?? draft() ?? null,
    null
  );
  const decision = useDecision(PERMISSION.puzzlesEditContent, () => ({
    puzzleOwnerId: document()?.owner_id ?? '',
  }));
  const denial = useDeniedView({
    get decision() {
      return data.isLoading() ? null : decision();
    },
  });
  const status = () => {
    if (data.isLoading()) return 'loading';
    if (document() === undefined) return 'gone';
    return initial() === null ? 'missing' : 'ready';
  };
  /** The builder's inputs, once it may open on a working copy. */
  const workspaceInput = createMemo(() => {
    const doc = document();
    const first = initial();
    if (status() !== 'ready' || denial() !== undefined) return null;
    return doc === undefined || first === null
      ? null
      : { document: doc, initial: first };
  });
  const onReturnToLibrary = (): void => game.open({ kind: 'library' });
  return (
    <Show
      when={workspaceInput()}
      fallback={
        <ContentAuthorScreenView
          status={status()}
          denial={denial()}
          documentId={props.documentId}
          kind={document()?.kind ?? 'puzzle'}
          body={NO_BODY}
          save={NO_SAVE}
          conflicted={false}
          metadataDisabled
          disabled
          preview={false}
          onChangeBody={() => undefined}
          onSaveAgain={() => undefined}
          onTogglePreview={() => undefined}
          onReturnToLibrary={onReturnToLibrary}
        />
      }
    >
      {(input) => (
        <AuthorWorkspaceScreen
          document={input().document}
          initial={input().initial}
          onReturnToLibrary={onReturnToLibrary}
        />
      )}
    </Show>
  );
}
