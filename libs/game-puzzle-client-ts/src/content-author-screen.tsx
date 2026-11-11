import { decodePackDefinition } from '@libs/game-puzzle-shared-ts/content-pack';
import type {
  ContentBody,
  ContentDocument,
  ContentDraft,
} from '@libs/game-puzzle-shared-ts/content-types';
import { useDecision } from '@libs/permissions-client-ts/use-can';
import { PERMISSION } from '@libs/permissions-shared-ts/permission-catalog';
import { createMemo, type JSX, Show } from 'solid-js';
import { ContentAuthorConfirms } from './content-author-confirms';
import { ContentAuthorScreenView } from './content-author-screen-view';
import { ContentAuthorStage } from './content-author-stage';
import { ContentDraftHistory } from './content-draft-history';
import { contentDraftPreviewable } from './content-draft-playable';
import { ContentDraftPlaytest } from './content-draft-playtest';
import { useContentGame, useContentPlace } from './content-game-context';
import { ContentKeptCopies } from './content-kept-copies';
import { useContentLibraryState } from './content-library-context';
import { ContentPackEditor } from './content-pack-editor';
import { ContentPackPreview } from './content-pack-preview';
import { type ContentBuilderPlace, contentPlaceOf } from './content-places';
import { ContentPreview } from './content-preview';
import { ContentPublicationControls } from './content-publication-controls';
import {
  type ContentAuthorWorkspace,
  useContentAuthorWorkspace,
} from './use-content-author-workspace';
import { useDeniedView } from './use-denied-view';

/** What the view's builder props hold before there is a working copy. */
const NO_BODY: ContentBody = {
  title: '',
  description: '',
  difficulty: '',
  definition: '',
};
const NO_SAVE = { saving: false, dirty: false, error: null } as const;

/** `board`: the game's editor, or the pack's puzzles. */
function AuthorStage(props: {
  document: ContentDocument;
  workspace: ContentAuthorWorkspace;
}): JSX.Element {
  return (
    <Show
      when={props.document.kind === 'pack'}
      fallback={
        <ContentAuthorStage
          writer={props.workspace.writer}
          disabled={props.workspace.adopting() !== null}
        />
      }
    >
      <ContentPackEditor
        writer={props.workspace.writer}
        disabled={props.workspace.disabled()}
        tools={props.workspace.packTools}
        onRemove={props.workspace.setRemoving}
      />
    </Show>
  );
}

/** `preview`: the puzzle on its board, or the pack's puzzles and one of them. */
function AuthorPreview(props: {
  document: ContentDocument;
  workspace: ContentAuthorWorkspace;
  place: ContentBuilderPlace;
  onOpen: (place: ContentBuilderPlace) => void;
}): JSX.Element {
  const definition = () => props.workspace.writer.body().definition;
  return (
    <Show
      when={props.document.kind === 'pack'}
      fallback={<ContentPreview definition={definition()} />}
    >
      <ContentPackPreview
        definition={definition()}
        puzzleId={
          props.place.screen === 'preview' ? props.place.puzzleId : null
        }
        onSelect={(puzzleId) => props.onOpen({ screen: 'preview', puzzleId })}
      />
    </Show>
  );
}

/** `publish`: playtest (a puzzle), validate and publish, on the workspace. */
function AuthorPublication(props: {
  document: ContentDocument;
  workspace: ContentAuthorWorkspace;
}): JSX.Element {
  return (
    <ContentPublicationControls
      document={props.document}
      publication={props.workspace.publication}
      disabled={props.workspace.disabled() || props.workspace.conflicted()}
      onWithdraw={() => props.workspace.setWithdrawing(true)}
      before={(next) => (
        <Show when={props.document.kind === 'puzzle'}>
          <ContentDraftPlaytest
            documentId={props.document.id}
            writer={props.workspace.writer}
            next={next()}
            disabled={props.workspace.disabled()}
            attemptId={props.workspace.playtestId()}
            onStarted={props.workspace.setPlaytestId}
          />
        </Show>
      )}
    />
  );
}

/** `board`: undo and redo, offered once this session's edits are kept. */
function AuthorHistory(props: {
  workspace: ContentAuthorWorkspace;
}): JSX.Element {
  return (
    <ContentDraftHistory
      writer={props.workspace.writer}
      history={props.workspace.history}
      disabled={
        props.workspace.disabled() ||
        props.workspace.conflicted() ||
        props.workspace.writer.dirty()
      }
    />
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
  const game = useContentGame();
  const nav = useContentPlace();
  const data = useContentLibraryState();
  const place = () => contentPlaceOf('builder', nav.place());
  const copies = () =>
    data
      .content()
      .drafts.filter((draft) => draft.document_id === props.document.id).length;
  return (
    <ContentAuthorScreenView
      status="ready"
      documentId={props.document.id}
      draftId={writer.draftId()}
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
      place={place()}
      onOpen={nav.open}
      standing={workspace.publication.standing()}
      playable={workspace.publication.playable()}
      previewable={contentDraftPreviewable(
        game.client,
        props.document.kind,
        writer.body().definition
      )}
      puzzles={decodePackDefinition(writer.body().definition)?.items.length}
      copies={copies()}
      history={<AuthorHistory workspace={workspace} />}
      stage={<AuthorStage document={props.document} workspace={workspace} />}
      preview={
        <AuthorPreview
          document={props.document}
          workspace={workspace}
          place={place()}
          onOpen={nav.open}
        />
      }
      publication={
        <AuthorPublication document={props.document} workspace={workspace} />
      }
      keptCopies={
        <ContentKeptCopies
          document={props.document}
          currentId={writer.draftId()}
          disabled={workspace.disabled() || writer.dirty()}
          onSelect={workspace.copyChoice.select}
        />
      }
      refusal={workspace.publication.status.refusal()}
      confirms={<ContentAuthorConfirms workspace={workspace} />}
      onChangeBody={writer.change}
      onSaveAgain={() => {
        void writer.save();
      }}
      onOpenWaiting={workspace.publication.openWaiting}
      onViewPublication={workspace.publication.viewPublication}
      onReturnToLibrary={props.onReturnToLibrary}
    />
  );
}

/** `ContentAuthorScreenView` wired to the library, permissions and saves. */
export function ContentAuthorScreen(props: {
  documentId: string;
}): JSX.Element {
  const game = useContentGame();
  const nav = useContentPlace();
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
    // A document asked for by id may still be on its way.
    if (document() === undefined) return data.isFetching() ? 'loading' : 'gone';
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
          place={contentPlaceOf('builder', nav.place())}
          onOpen={nav.open}
          standing={{ kind: 'validate', invalid: false }}
          onChangeBody={() => undefined}
          onSaveAgain={() => undefined}
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
