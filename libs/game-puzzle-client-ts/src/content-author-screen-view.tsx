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
import { GameSection } from '@pkgs/ui-root-client-ts/game-section';
import { GameSessionLayout } from '@pkgs/ui-root-client-ts/game-session-layout';
import { EyeIcon } from '@pkgs/ui-root-client-ts/icons';
import { LoadingState } from '@pkgs/ui-root-client-ts/loading-state';
import { Notice } from '@pkgs/ui-root-client-ts/notice';
import { StackHorizontal, StackVertical } from '@pkgs/ui-root-client-ts/stack';
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
  /** The draft's other saved copies, to keep working from one. */
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
            Another device saved a different copy of this draft. Choose the copy
            to keep working from under Draft copies before publishing.
          </Trans>
        </Notice>
      </Show>
    </>
  );
}

/**
 * The editing tools, heading the stage they act on: undo and redo of this
 * session's edits, and a look at the draft as a player sees it.
 */
function AuthorTools(props: ContentAuthorScreenViewProps): JSX.Element {
  const { t } = useLingui();
  return (
    <StackHorizontal
      gap="sm"
      wrap
      align="center"
      dataSet={{ testid: 'content-author-tools' }}
    >
      {props.history}
      <Button
        title={props.preview ? t`Return to editing` : t`Preview`}
        intent="neutral"
        variant="ghost"
        startIcon={<EyeIcon size={20} />}
        onClick={() => props.onTogglePreview()}
        disabled={props.disabled}
        dataSet={{ testid: 'content-preview' }}
      />
    </StackHorizontal>
  );
}

/**
 * Beside the stage on a wide screen, after it on a phone: the draft's
 * details, then publishing it (a puzzle's playtest proves it first). The
 * draft's other saved copies follow the stage.
 */
function AuthorRail(props: ContentAuthorScreenViewProps): JSX.Element {
  const { t } = useLingui();
  return (
    <StackVertical gap="lg">
      <GameSection title={t`Details`}>
        <ContentDraftMetadata
          body={props.body}
          disabled={props.metadataDisabled}
          onChange={props.onChangeBody}
        />
      </GameSection>
      <GameSection
        title={t`Publish`}
        description={
          props.kind === 'pack'
            ? t`Check it, then share it with everyone who plays.`
            : t`Playtest it, check it, then share it with everyone who plays.`
        }
        dataSet={{ testid: 'content-author-publish' }}
      >
        <Show when={props.kind === 'puzzle'}>{props.playtest}</Show>
        {props.publication}
      </GameSection>
    </StackVertical>
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
        aside={<AuthorRail {...props} />}
      >
        <StackVertical gap="lg">
          <StackVertical gap="md" dataSet={{ testid: 'content-author-stage' }}>
            <AuthorTools {...props} />
            {props.stage}
          </StackVertical>
          {props.keptCopies}
        </StackVertical>
      </GameSessionLayout>
    </GameScreen>
  );
}

/**
 * The puzzle or pack builder, presentational, one layout for both: the
 * editing tools heading the stage (the game's editor, the pack's puzzles,
 * or a preview), and beside it the draft's details, publishing it and its
 * draft copies — or loading, denied and not-on-this-device states. The
 * host's bar holds the way back to the puzzles. Smart widgets arrive as
 * slots.
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
