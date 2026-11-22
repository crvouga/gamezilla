import type {
  ContentBody,
  ContentKind,
} from '@libs/game-puzzle-shared-ts/content-types';
import type { DenialView } from '@libs/permissions-client-ts/denial-surface-view';
import { DenialSurfaceView } from '@libs/permissions-client-ts/denial-surface-view';
import { Trans, useLingui } from '@lingui/solid/macro';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { EmbeddedScreen } from '@pkgs/ui-root-client-ts/embedded-screen';
import { ErrorState } from '@pkgs/ui-root-client-ts/error-state';
import { LoadingState } from '@pkgs/ui-root-client-ts/loading-state';
import { Notice } from '@pkgs/ui-root-client-ts/notice';
import type { SpaceGameAction } from '@pkgs/ui-root-client-ts/space-types';
import { StackHorizontal, StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { P, Text } from '@pkgs/ui-root-client-ts/text';
import { type JSX, Match, Show, Switch } from 'solid-js';
import { ContentAuthorHubView } from './content-author-hub-view';
import {
  ContentAuthorBoardView,
  ContentAuthorCopiesView,
  ContentAuthorDetailsView,
  ContentAuthorPreviewView,
  ContentAuthorPublishView,
} from './content-author-place-views';
import type { ContentBuilderStanding } from './content-builder-standing';
import type { ContentBuilderPlace } from './content-places';
import { PuzzleSpaceInGame } from './puzzle-space-in-game';

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
  /** The working copy being edited (`data-draftid` on every place). */
  readonly draftId?: string | undefined;
  readonly kind: ContentKind;
  /** The working copy's title, description, difficulty and definition. */
  readonly body: ContentBody;
  readonly save: ContentDraftSave;
  /** Another working copy was kept meanwhile: choose one before publishing. */
  readonly conflicted: boolean;
  readonly metadataDisabled: boolean;
  /** The builder is busy (saving, adopting a copy, a pack change). */
  readonly disabled: boolean;
  /** The small screen shown: the hub of steps, or one of the steps. */
  readonly place: ContentBuilderPlace;
  readonly onOpen: (place: ContentBuilderPlace) => void;
  /** Where the draft stands on its way to being published. */
  readonly standing: ContentBuilderStanding;
  /** `false` while the game cannot play the draft: its board needs fixing. */
  readonly playable?: boolean | undefined;
  /**
   * `false` while there is nothing to preview: the game previews through
   * its player and cannot play the draft (its authoring `readable()`)
   * until it is corrected.
   */
  readonly previewable?: boolean | undefined;
  /** How many puzzles a pack draft holds. */
  readonly puzzles?: number | undefined;
  /** How many copies of the draft are kept. */
  readonly copies?: number | undefined;
  /** `board`: undo / redo of this session's edits, on the action bar. */
  readonly history?: readonly SpaceGameAction[] | undefined;
  /** `board`: an undo or redo that did not happen, with its retry. */
  readonly historyFailure?: JSX.Element;
  /**
   * The space's own notice (`SpaceScreenNotice`), for the shell the
   * `board` and `preview` places draw; the others are inside the space's
   * shell.
   */
  readonly spaceNotice?: JSX.Element;
  /** `board`: the game's editor, or the pack editor. */
  readonly stage?: JSX.Element;
  /** `preview`: the draft as a solver sees it. */
  readonly preview?: JSX.Element;
  /** `publish`: playtest, validate and publish, and why not yet. */
  readonly publication?: JSX.Element;
  /** `copies`: the draft's other saved copies, to keep working from one. */
  readonly keptCopies?: JSX.Element;
  /** The server's refusal of the last publication, said on every place. */
  readonly refusal?: JSX.Element;
  /** That refusal is in view: correcting the draft comes before publishing. */
  readonly refused?: boolean | undefined;
  /** The builder's confirmation dialogs, kept whichever place is shown. */
  readonly confirms?: JSX.Element;
  readonly onChangeBody: (body: ContentBody) => void;
  readonly onSaveAgain: () => void;
  /** Opens a pack's first draft puzzle, to finish and publish it there. */
  readonly onOpenWaiting?: (() => void) | undefined;
  readonly onViewPublication?: (() => void) | undefined;
  readonly onReturnToLibrary: () => void;
};

/**
 * Where the working copy's last save stands, one quiet line under the
 * draft's title on every place: the builder's one live region.
 */
function SaveLine(props: ContentAuthorScreenViewProps): JSX.Element {
  const { t } = useLingui();
  return (
    <Text variant="inherit" role="status" testId="content-draft-save-status">
      {props.save.saving
        ? t`Saving your draft…`
        : props.save.dirty
          ? t`Your changes still need to be saved.`
          : t`Saved on this device. Changes share when connected.`}
    </Text>
  );
}

/**
 * What needs the author first, on every place: a failed save, a
 * conflicting copy, a refused publication.
 */
function AuthorNotices(props: ContentAuthorScreenViewProps): JSX.Element {
  const { t } = useLingui();
  return (
    <>
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
        <Notice tone="warning" dataSet={{ testid: 'content-author-conflict' }}>
          <Show
            when={props.place.screen === 'copies'}
            fallback={
              <StackVertical gap="sm">
                <Trans>
                  Another device saved a different copy of this draft. Choose
                  the copy to keep working from before publishing.
                </Trans>
                <Show when={props.place.screen !== 'builder'}>
                  <StackHorizontal>
                    <Button
                      title={t`Open draft copies`}
                      intent="neutral"
                      variant="outline"
                      size="sm"
                      onClick={() => props.onOpen({ screen: 'copies' })}
                      dataSet={{ testid: 'content-author-open-copies' }}
                    />
                  </StackHorizontal>
                </Show>
              </StackVertical>
            }
          >
            <Trans>
              Another device saved a different copy of this draft. Choose the
              copy to keep working from below before publishing.
            </Trans>
          </Show>
        </Notice>
      </Show>
      {/* On the publish screen the refusal is said once, with its fix. */}
      <Show when={!(props.place.screen === 'publish' && props.refused)}>
        {props.refusal}
      </Show>
    </>
  );
}

/** What the place is, said before the save line under the draft's title. */
function usePlaceName(props: ContentAuthorScreenViewProps): () => string {
  const { t } = useLingui();
  return () => {
    const pack = props.kind === 'pack';
    return {
      builder: pack ? t`Pack builder` : t`Puzzle builder`,
      details: t`Details`,
      board: pack ? t`Puzzles` : t`Board`,
      preview: t`Preview`,
      publish: t`Check and publish`,
      copies: t`Draft copies`,
    }[props.place.screen];
  };
}

/** The one small screen `place` names. */
function AuthorPlace(props: ContentAuthorScreenViewProps): JSX.Element {
  return (
    <Switch>
      <Match when={props.place.screen === 'builder'}>
        <ContentAuthorHubView view={props} />
      </Match>
      <Match when={props.place.screen === 'details'}>
        <ContentAuthorDetailsView view={props} />
      </Match>
      <Match when={props.place.screen === 'board'}>
        <ContentAuthorBoardView view={props} />
      </Match>
      <Match when={props.place.screen === 'preview'}>
        <ContentAuthorPreviewView view={props} />
      </Match>
      <Match when={props.place.screen === 'publish'}>
        <ContentAuthorPublishView view={props} />
      </Match>
      <Match when={props.place.screen === 'copies'}>
        <ContentAuthorCopiesView view={props} />
      </Match>
    </Switch>
  );
}

/** The board and the preview are stages; every other place is a menu column. */
function isStage(screen: ContentBuilderPlace['screen']): boolean {
  return screen === 'board' || screen === 'preview';
}

/** The identifiers every place of the builder carries. */
function authorDataSet(props: ContentAuthorScreenViewProps) {
  return {
    testid: 'content-author',
    documentid: props.documentId,
    draftid: props.draftId ?? '',
    place: props.place.screen,
  };
}

/**
 * Back to the steps, on the board's and the preview's action bar; a pack's
 * previewed puzzle returns to the pack's list by Back instead.
 */
function useStageActions(
  props: ContentAuthorScreenViewProps
): () => readonly SpaceGameAction[] {
  const { t } = useLingui();
  return () => {
    const place = props.place;
    const done: readonly SpaceGameAction[] =
      place.screen === 'preview' && place.puzzleId !== null
        ? []
        : [
            {
              id: 'done',
              label: t`Done`,
              onPress: () => props.onOpen({ screen: 'builder' }),
              testId: 'content-step-done',
            },
          ];
    return place.screen === 'board'
      ? [...(props.history ?? []), ...done]
      : done;
  };
}

/**
 * The board and the preview, worked in the space: the draft's title and
 * where it is on the status line; as the stage its save line, what needs
 * the author first and the place itself; undo, redo and Done on the
 * action bar. The author works; everyone else in the space watches.
 */
function AuthorStage(props: ContentAuthorScreenViewProps): JSX.Element {
  const { t } = useLingui();
  const name = usePlaceName(props);
  const actions = useStageActions(props);
  return (
    <PuzzleSpaceInGame
      gameKey="puzzle-builder"
      solver="you"
      status={props.body.title || t`Untitled draft`}
      statusTestId="content-author-title"
      detail={name()}
      actions={actions()}
      waiting={t`Back returns to the pack's puzzles`}
      notice={props.spaceNotice}
      board={
        <StackVertical
          grow
          gap="md"
          paddingX="lg"
          paddingTop="sm"
          paddingBottom="lg"
          dataSet={authorDataSet(props)}
        >
          <P variant="caption" tone="secondary">
            <SaveLine {...props} />
          </P>
          <AuthorNotices {...props} />
          <Show when={props.place.screen === 'board'}>
            {props.historyFailure}
          </Show>
          <AuthorPlace {...props} />
        </StackVertical>
      }
    />
  );
}

/**
 * The builder's shell around one place: the draft's title and its save
 * line, then what needs the author first, then the place. Each place is
 * its own screen, so opening one starts at its top with focus on it; the
 * board and the preview are worked in the space (`AuthorStage`).
 */
function AuthorShell(props: ContentAuthorScreenViewProps): JSX.Element {
  const { t } = useLingui();
  const name = usePlaceName(props);
  const title = (): JSX.Element => (
    <Text variant="inherit" testId="content-author-title">
      {props.body.title || t`Untitled draft`}
    </Text>
  );
  const subtitle = (): JSX.Element => (
    <>
      {name()}
      {' · '}
      <SaveLine {...props} />
    </>
  );
  return (
    <Show when={props.place.screen} keyed>
      {(screen) => (
        <Show
          when={isStage(screen)}
          fallback={
            <EmbeddedScreen
              screenId={
                screen === 'builder'
                  ? 'puzzle-content-author'
                  : `puzzle-content-author-${screen}`
              }
              dataSet={authorDataSet(props)}
              title={title()}
              subtitle={subtitle()}
            >
              <AuthorNotices {...props} />
              <AuthorPlace {...props} />
            </EmbeddedScreen>
          }
        >
          <AuthorStage {...props} />
        </Show>
      )}
    </Show>
  );
}

/** The way back to the puzzles from a builder that cannot open. */
function ReturnToPuzzles(props: {
  onReturnToLibrary: () => void;
}): JSX.Element {
  const { t } = useLingui();
  return (
    <Button
      title={t`Return to puzzles`}
      intent="neutral"
      variant="outline"
      onClick={() => props.onReturnToLibrary()}
      dataSet={{ testid: 'content-author-return' }}
    />
  );
}

/** The draft cannot be shown: why, and the way back to the puzzles. */
function AuthorUnavailable(props: {
  gone: boolean;
  onReturnToLibrary: () => void;
}): JSX.Element {
  const { t } = useLingui();
  return (
    <ErrorState
      title={
        props.gone
          ? t`This draft is no longer here`
          : t`This draft is not available on this device`
      }
      body={
        props.gone
          ? t`It was removed, or it belongs to another account. Return to your puzzles to open another.`
          : t`Return to your library, reconnect and open it again. Your saved work stays kept.`
      }
      secondary={{
        label: t`Return to puzzles`,
        onClick: () => props.onReturnToLibrary(),
      }}
    />
  );
}

/**
 * The puzzle or pack builder, presentational, as small screens under one
 * shell. `builder` is the hub: one row per step with where it stands
 * (Details, Board or Puzzles, Preview, Check and publish, Draft copies)
 * and the one next step as its filled command. `details` is the form for
 * the title, description and difficulty; `board` the game's editor or the
 * pack's puzzles with undo and redo; `preview` the draft as a solver sees
 * it; `publish` playtesting, validating and publishing; `copies` the kept
 * draft copies. The shell shows on every place: the draft's title, its
 * save line, a failed save, a conflicting copy, a refused publication, and
 * the confirmation dialogs — or loading, denied, gone and
 * not-on-this-device states. Smart widgets arrive as slots, each drawn
 * only on its place.
 */
export function ContentAuthorScreenView(
  props: ContentAuthorScreenViewProps
): JSX.Element {
  return (
    <Switch>
      <Match when={props.status === 'loading'}>
        <LoadingState />
      </Match>
      <Match when={props.denial}>
        {(denial) => (
          <StackVertical gap="lg" align="center">
            <DenialSurfaceView denial={denial()} />
            <ReturnToPuzzles onReturnToLibrary={props.onReturnToLibrary} />
          </StackVertical>
        )}
      </Match>
      <Match when={props.status === 'ready'}>
        <AuthorShell {...props} />
        {props.confirms}
      </Match>
      <Match when={props.status === 'gone' || props.status === 'missing'}>
        <AuthorUnavailable
          gone={props.status === 'gone'}
          onReturnToLibrary={props.onReturnToLibrary}
        />
      </Match>
    </Switch>
  );
}
