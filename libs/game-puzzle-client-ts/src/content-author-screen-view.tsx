import type {
  ContentBody,
  ContentKind,
} from '@libs/game-puzzle-shared-ts/content-types';
import type { DenialView } from '@libs/permissions-client-ts/denial-surface-view';
import { DenialSurfaceView } from '@libs/permissions-client-ts/denial-surface-view';
import { Trans, useLingui } from '@lingui/solid/macro';
import { EmbeddedScreen } from '@pkgs/ui-root-client-ts/embedded-screen';
import { ErrorState } from '@pkgs/ui-root-client-ts/error-state';
import { GameScreen } from '@pkgs/ui-root-client-ts/game-screen';
import { GameSessionLayout } from '@pkgs/ui-root-client-ts/game-session-layout';
import { LoadingState } from '@pkgs/ui-root-client-ts/loading-state';
import { Notice } from '@pkgs/ui-root-client-ts/notice';
import { Text } from '@pkgs/ui-root-client-ts/text';
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
  /** `board`: undo / redo of this session's edits. */
  readonly history?: JSX.Element;
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
          <Trans>
            Another device saved a different copy of this draft. Choose the copy
            to keep working from under Draft copies before publishing.
          </Trans>
        </Notice>
      </Show>
      {props.refusal}
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

/**
 * The builder's shell around one place: the draft's title and its save
 * line, then what needs the author first, then the place. Each place is
 * its own screen, so opening one starts at its top with focus on it.
 */
function AuthorShell(props: ContentAuthorScreenViewProps): JSX.Element {
  const { t } = useLingui();
  const name = usePlaceName(props);
  const dataSet = () => ({
    testid: 'content-author',
    documentid: props.documentId,
    draftid: props.draftId ?? '',
    place: props.place.screen,
  });
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
              dataSet={dataSet()}
              title={title()}
              subtitle={subtitle()}
            >
              <AuthorNotices {...props} />
              <AuthorPlace {...props} />
            </EmbeddedScreen>
          }
        >
          <GameScreen
            screenId={`puzzle-content-author-${screen}`}
            dataSet={dataSet()}
            title={title()}
            subtitle={subtitle()}
          >
            <GameSessionLayout notices={<AuthorNotices {...props} />} workspace>
              <AuthorPlace {...props} />
            </GameSessionLayout>
          </GameScreen>
        </Show>
      )}
    </Show>
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
        {(denial) => <DenialSurfaceView denial={denial()} />}
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
