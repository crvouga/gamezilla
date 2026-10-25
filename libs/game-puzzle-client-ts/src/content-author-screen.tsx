import type {
  ContentDocument,
  ContentDraft,
} from '@libs/game-puzzle-shared-ts/content-types';
import { DenialSurface } from '@libs/permissions-client-ts/denial-surface';
import { useDecision } from '@libs/permissions-client-ts/use-can';
import { PERMISSION } from '@libs/permissions-shared-ts/permission-catalog';
import { useLingui } from '@lingui/solid/macro';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { ErrorState } from '@pkgs/ui-root-client-ts/error-state';
import { GameScreen } from '@pkgs/ui-root-client-ts/game-screen';
import { GameSessionLayout } from '@pkgs/ui-root-client-ts/game-session-layout';
import { LoadingState } from '@pkgs/ui-root-client-ts/loading-state';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { createMemo, type JSX, Show } from 'solid-js';
import { ContentAuthorStage } from './content-author-stage';
import { ContentAuthorStatus } from './content-author-status';
import { ContentDraftHistoryControls } from './content-draft-history-controls';
import { ContentDraftMetadata } from './content-draft-metadata';
import { ContentDraftPlaytest } from './content-draft-playtest';
import { useContentGame } from './content-game-context';
import { ContentKeptCopies } from './content-kept-copies';
import { useContentLibraryState } from './content-library-context';
import { ContentPackEditor } from './content-pack-editor';
import { ContentPackPreview } from './content-pack-preview';
import { ContentPublicationControls } from './content-publication-controls';
import { useContentAuthorWorkspace } from './use-content-author-workspace';
import type { useContentDraftSave } from './use-content-draft-save';

function AuthorActions(props: {
  document: ContentDocument;
  writer: ReturnType<typeof useContentDraftSave>;
  preview: boolean;
  onPreview: () => void;
  disabled: boolean;
}): JSX.Element {
  const { t } = useLingui();
  return (
    <>
      <ContentDraftHistoryControls
        writer={props.writer}
        disabled={props.disabled || props.preview}
      />
      <Button
        title={props.preview ? t`Return to editing` : t`Preview`}
        intent="neutral"
        variant="outline"
        onClick={props.onPreview}
        disabled={props.disabled}
        dataSet={{ testid: 'content-preview' }}
      />
      <Show when={props.document.kind === 'puzzle'}>
        <ContentDraftPlaytest
          documentId={props.document.id}
          writer={props.writer}
          disabled={props.disabled}
        />
      </Show>
    </>
  );
}

function AuthorBody(props: {
  document: ContentDocument;
  initial: ContentDraft;
}): JSX.Element {
  const { t } = useLingui();
  const {
    writer,
    preview,
    setPreview,
    adopting,
    packTools,
    packPending,
    disabled,
    conflicted,
  } = useContentAuthorWorkspace(
    () => props.document,
    () => props.initial
  );
  return (
    <GameScreen
      screenId="puzzle-content-author"
      dataSet={{ testid: 'content-author', documentid: props.document.id }}
      title={writer.body().title || t`Untitled draft`}
      subtitle={
        props.document.kind === 'pack' ? t`Pack builder` : t`Puzzle builder`
      }
    >
      <GameSessionLayout
        notices={
          <ContentAuthorStatus writer={writer} conflicted={conflicted()} />
        }
        aside={
          <StackVertical gap="lg">
            <ContentDraftMetadata
              body={writer.body()}
              disabled={adopting() !== null || packPending()}
              onChange={writer.change}
            />
            <ContentPublicationControls
              document={props.document}
              writer={writer}
              disabled={disabled() || conflicted()}
            />
          </StackVertical>
        }
        actions={
          <AuthorActions
            document={props.document}
            writer={writer}
            preview={preview()}
            onPreview={() => setPreview((value) => !value)}
            disabled={disabled()}
          />
        }
      >
        <Show
          when={props.document.kind === 'pack'}
          fallback={
            <ContentAuthorStage
              writer={writer}
              preview={preview()}
              disabled={adopting() !== null}
            />
          }
        >
          <Show
            when={!preview()}
            fallback={
              <ContentPackPreview definition={writer.body().definition} />
            }
          >
            <ContentPackEditor
              writer={writer}
              disabled={disabled()}
              tools={packTools}
            />
          </Show>
        </Show>
      </GameSessionLayout>
      <ContentKeptCopies
        document={props.document}
        currentId={writer.draftId()}
        disabled={disabled() || writer.dirty()}
        onChoose={(draft) => writer.adopt(draft, 'replace')}
      />
    </GameScreen>
  );
}

export function ContentAuthorScreen(props: {
  documentId: string;
}): JSX.Element {
  const { t } = useLingui();
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
  return (
    <Show when={!data.isLoading()} fallback={<LoadingState />}>
      <Show
        when={decision().allowed}
        fallback={<DenialSurface decision={decision()} />}
      >
        <Show when={document()}>
          {(doc) => (
            <Show
              when={initial()}
              fallback={
                <ErrorState
                  title={t`This draft is not available on this device`}
                  body={t`Return to your library, reconnect and open it again. Your saved work stays kept.`}
                  secondary={{
                    label: t`Return to puzzles`,
                    onClick: () => game.open({ kind: 'library' }),
                  }}
                />
              }
            >
              {(initial) => <AuthorBody document={doc()} initial={initial()} />}
            </Show>
          )}
        </Show>
      </Show>
    </Show>
  );
}
