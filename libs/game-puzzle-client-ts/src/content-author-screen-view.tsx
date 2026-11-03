import type {
  ContentBody,
  ContentKind,
} from '@libs/game-puzzle-shared-ts/content-types';
import type { DenialView } from '@libs/permissions-client-ts/denial-surface-view';
import { DenialSurfaceView } from '@libs/permissions-client-ts/denial-surface-view';
import { Trans, useLingui } from '@lingui/solid/macro';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { ErrorState } from '@pkgs/ui-root-client-ts/error-state';
import { GameScreen } from '@pkgs/ui-root-client-ts/game-screen';
import { GameSessionLayout } from '@pkgs/ui-root-client-ts/game-session-layout';
import { LoadingState } from '@pkgs/ui-root-client-ts/loading-state';
import { Notice } from '@pkgs/ui-root-client-ts/notice';
import { StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { P } from '@pkgs/ui-root-client-ts/text';
import { type JSX, Match, Show, Switch } from 'solid-js';
import { ContentDraftMetadata } from './content-draft-metadata';

/**
 * `loading`: the library is still being read; `gone`: the document is not
 * (or no longer) in it; `missing`: its working copy has not reached this
 * device; `ready`: the builder.
 */
export type ContentAuthorStatus = 'loading' | 'gone' | 'missing' | 'ready';

/** Where the working copy's last save stands. */
export type ContentDraftSave = {
  readonly saving: boolean;
  /** Edits that still need to be saved. */
  readonly dirty: boolean;
  /** Why the last save failed; the edits stay on screen. */
  readonly error: string | null;
};

export type ContentAuthorScreenViewProps = {
  readonly status: ContentAuthorStatus;
  /** Set when the person may not edit this document. */
  readonly denial?: DenialView | undefined;
  readonly documentId: string;
  readonly kind: ContentKind;
  /** The working copy's title, description, difficulty and definition. */
  readonly body: ContentBody;
  readonly save: ContentDraftSave;
  /** Another working copy was kept meanwhile: choose one before publishing. */
  readonly conflicted: boolean;
  readonly metadataDisabled: boolean;
  /** The builder is busy (saving, adopting a copy, a pack change). */
  readonly disabled: boolean;
  /** Previewing the draft as a player sees it. */
  readonly preview: boolean;
  /** Undo / redo of this session's edits. */
  readonly history?: JSX.Element;
  /** Start a private playtest (puzzles). */
  readonly playtest?: JSX.Element;
  /** Validation and publication. */
  readonly publication?: JSX.Element;
  /** The game's editor, the pack editor, or the preview. */
  readonly stage?: JSX.Element;
  /** Earlier kept copies to choose from. */
  readonly keptCopies?: JSX.Element;
  readonly onChangeBody: (body: ContentBody) => void;
  readonly onSaveAgain: () => void;
  readonly onTogglePreview: () => void;
  readonly onReturnToLibrary: () => void;
};

function SaveStatus(props: ContentAuthorScreenViewProps): JSX.Element {
  const { t } = useLingui();
  return (
    <>
      <P
        role="status"
        variant="caption"
        tone="secondary"
        dataSet={{ testid: 'content-draft-save-status' }}
      >
        {props.save.saving
          ? t`Saving your draft…`
          : props.save.dirty
            ? t`Your changes still need to be saved.`
            : t`Saved on this device. Changes share when connected.`}
      </P>
      <Show when={props.save.error}>
        {(error) => (
          <ErrorState
            variant="compact"
            title={t`Your changes are still here`}
            body={error()}
            retry={{ label: t`Save again`, onClick: props.onSaveAgain }}
          />
        )}
      </Show>
      <Show when={props.conflicted}>
        <Notice tone="warning">
          <Trans>
            A different working copy was kept. Choose the copy you want below
            before publishing.
          </Trans>
        </Notice>
      </Show>
    </>
  );
}

/** Undo, redo, preview and playtest beside the builder. */
function AuthorActions(props: ContentAuthorScreenViewProps): JSX.Element {
  const { t } = useLingui();
  return (
    <>
      {props.history}
      <Button
        title={props.preview ? t`Return to editing` : t`Preview`}
        intent="neutral"
        variant="outline"
        onClick={() => props.onTogglePreview()}
        disabled={props.disabled}
        dataSet={{ testid: 'content-preview' }}
      />
      <Show when={props.kind === 'puzzle'}>{props.playtest}</Show>
    </>
  );
}

function AuthorBody(props: ContentAuthorScreenViewProps): JSX.Element {
  const { t } = useLingui();
  return (
    <GameScreen
      screenId="puzzle-content-author"
      dataSet={{ testid: 'content-author', documentid: props.documentId }}
      title={props.body.title || t`Untitled draft`}
      subtitle={props.kind === 'pack' ? t`Pack builder` : t`Puzzle builder`}
    >
      <GameSessionLayout
        notices={<SaveStatus {...props} />}
        aside={
          <StackVertical gap="lg">
            <ContentDraftMetadata
              body={props.body}
              disabled={props.metadataDisabled}
              onChange={props.onChangeBody}
            />
            {props.publication}
          </StackVertical>
        }
        actions={<AuthorActions {...props} />}
      >
        {props.stage}
      </GameSessionLayout>
      {props.keptCopies}
    </GameScreen>
  );
}

/**
 * The puzzle or pack builder, presentational: the draft's details, its
 * save status, the game's editor or a preview, undo / redo, playtest,
 * validation and publication, and the kept copies — or loading, denied
 * and not-on-this-device states. Smart widgets arrive as slots.
 */
export function ContentAuthorScreenView(
  props: ContentAuthorScreenViewProps
): JSX.Element {
  const { t } = useLingui();
  return (
    <Switch>
      <Match when={props.status === 'loading'}>
        <LoadingState />
      </Match>
      <Match when={props.denial}>
        {(denial) => <DenialSurfaceView denial={denial()} />}
      </Match>
      <Match when={props.status === 'missing'}>
        <ErrorState
          title={t`This draft is not available on this device`}
          body={t`Return to your library, reconnect and open it again. Your saved work stays kept.`}
          secondary={{
            label: t`Return to puzzles`,
            onClick: () => props.onReturnToLibrary(),
          }}
        />
      </Match>
      <Match when={props.status === 'ready'}>
        <AuthorBody {...props} />
      </Match>
    </Switch>
  );
}
