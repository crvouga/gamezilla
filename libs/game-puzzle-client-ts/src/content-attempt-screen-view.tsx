import type { DenialView } from '@libs/permissions-client-ts/denial-surface-view';
import { DenialSurfaceView } from '@libs/permissions-client-ts/denial-surface-view';
import { Trans, useLingui } from '@lingui/solid/macro';
import { Badge } from '@pkgs/ui-root-client-ts/badge';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { EmbeddedScreen } from '@pkgs/ui-root-client-ts/embedded-screen';
import { ErrorState } from '@pkgs/ui-root-client-ts/error-state';
import { GameScreen } from '@pkgs/ui-root-client-ts/game-screen';
import { GameSessionLayout } from '@pkgs/ui-root-client-ts/game-session-layout';
import { LoadingState } from '@pkgs/ui-root-client-ts/loading-state';
import { Notice } from '@pkgs/ui-root-client-ts/notice';
import { P } from '@pkgs/ui-root-client-ts/text';
import { type JSX, Match, Show, Switch } from 'solid-js';
import {
  ContentAttemptProgressView,
  ContentAttemptSaveStatus,
} from './content-attempt-progress-view';
import type { ContentAttemptPlace } from './content-places';
import type { PuzzleContentFrame } from './puzzle-content-client';

/**
 * `loading`: the attempt asked for is still on its way; `gone`: no such
 * attempt here; `missing`: the attempt is kept but what it plays has not
 * reached this device; `ready`: the attempt on its board.
 */
export type ContentAttemptStatus = 'loading' | 'gone' | 'missing' | 'ready';

/** The saved attempt and what it plays, as the screen names them. */
export type ContentAttemptSummary = {
  readonly id: string;
  readonly sourceId: string;
  readonly packRevisionId: string | null;
  readonly title: string;
  readonly difficulty: string;
  readonly description: string;
};

/** Where the puzzle sits in the pack it is played from. */
export type ContentAttemptPack = {
  readonly title: string;
  /** The puzzle's place in the pack, from 1. */
  readonly position: number;
  readonly total: number;
};

/** One of the game's figures for the attempt: its label and value. */
export type AttemptFigure = {
  readonly key: string;
  readonly label: string;
  readonly value: string;
};

export type ContentAttemptScreenViewProps = {
  readonly status: ContentAttemptStatus;
  /** Set when the person may not change this attempt. */
  readonly denial?: DenialView | undefined;
  /** The small screen shown: the board, or where the attempt stands. */
  readonly place: ContentAttemptPlace;
  readonly onOpen: (place: ContentAttemptPlace) => void;
  readonly attempt: ContentAttemptSummary;
  /** The pack this attempt is played from; absent for a puzzle on its own. */
  readonly pack?: ContentAttemptPack | null | undefined;
  /** A private playtest of a draft: it counts toward no completion. */
  readonly playtest: boolean;
  /** The last change is still being saved. */
  readonly saving: boolean;
  /** Why the last change was not saved; the earlier position is kept. */
  readonly changeError: string | null;
  readonly complete: boolean;
  /**
   * A completion of this puzzle is already saved. Once the board is played
   * away from solved (a restart, an undo), the panel says so quietly
   * instead of repeating the full completion message.
   */
  readonly solvedBefore?: boolean | undefined;
  /** Published under rules this app version does not have. */
  readonly rulesChanged: boolean;
  /** The saved position cannot be projected onto the board. */
  readonly unopenable: boolean;
  /** The puzzle itself cannot be read, so restarting cannot help either. */
  readonly unreadable?: boolean | undefined;
  /** `attempt`: the game's player on the attempt's position. */
  readonly player?: JSX.Element;
  /** `attempt`: undo / redo and restart. */
  readonly controls?: JSX.Element;
  /**
   * `progress`: the attempt's way on — a pack puzzle's next puzzle and its
   * overview, a playtest's way back to its builder.
   */
  readonly wayOn?: JSX.Element;
  /** Where the board sits on a one-column screen. */
  readonly stageAlign?: 'start' | 'center' | undefined;
  /** `progress`: earlier kept continuations to choose from. */
  readonly keptPositions?: JSX.Element;
  /**
   * The game's own figures for where the attempt stands, by its labels
   * (`Connected pairs 2`, `Moves 12`); empty when it gives none.
   */
  readonly figures?: readonly AttemptFigure[] | undefined;
  readonly figuresPlacement?: PuzzleContentFrame['figuresPlacement'];
  /** The attempt's confirmation dialogs, kept whichever place is shown. */
  readonly confirms?: JSX.Element;
  readonly onRetryChange: () => void;
  readonly onReturnToLibrary: () => void;
};

/**
 * What stops play or needs the person first, on every place: rules this
 * app lacks, or a change that was not saved.
 */
function AttemptAlerts(props: ContentAttemptScreenViewProps): JSX.Element {
  const { t } = useLingui();
  return (
    <>
      <Show when={props.rulesChanged}>
        <Notice
          tone="warning"
          dataSet={{ testid: 'content-attempt-rules-changed' }}
        >
          <Trans>
            This puzzle needs a version of the app with its rules. Your saved
            attempt stays kept; update the app to continue it.
          </Trans>
        </Notice>
      </Show>
      <Show when={props.changeError}>
        {(error) => (
          <ErrorState
            variant="compact"
            title={t`Your change was not saved`}
            body={error()}
            retry={{ onClick: props.onRetryChange }}
          />
        )}
      </Show>
    </>
  );
}

/**
 * What the puzzle asks ("Join each pair of numbers and fill every
 * square."), right above the board it is played on, at every size.
 */
function AttemptRule(props: ContentAttemptScreenViewProps): JSX.Element {
  return (
    <Show when={props.attempt.description}>
      <P tone="secondary" testId="puzzle-attempt-rule">
        {props.attempt.description}
      </P>
    </Show>
  );
}

/**
 * The stage's one control onward: it opens where the attempt stands (its
 * pack, its figures, its saved positions), and is the filled command once
 * the puzzle is solved, when what comes next is there.
 */
function OpenProgress(props: ContentAttemptScreenViewProps): JSX.Element {
  const { t } = useLingui();
  return (
    <Button
      title={props.complete ? t`Solved: what next` : t`Progress`}
      intent={props.complete ? 'primary' : 'neutral'}
      variant={props.complete ? 'solid' : 'outline'}
      size="sm"
      onClick={() => props.onOpen({ screen: 'progress' })}
      dataSet={{
        testid: 'content-open-progress',
        complete: String(props.complete),
      }}
    />
  );
}

/** Why there is no board to play: the position, or the puzzle itself. */
function Unopenable(props: ContentAttemptScreenViewProps): JSX.Element {
  return (
    <Notice tone="error">
      <Show
        when={props.unreadable === true}
        fallback={
          <Trans>
            This saved position cannot be opened. Choose another kept
            continuation under Progress, or restart. Your earlier attempt stays
            saved.
          </Trans>
        }
      >
        <Trans>
          This puzzle cannot be opened. Your attempt stays saved. Return to the
          library to choose another puzzle.
        </Trans>
      </Show>
    </Notice>
  );
}

/** The identifiers every place of one attempt carries. */
function attemptDataSet(props: ContentAttemptScreenViewProps) {
  return {
    testid: 'content-attempt',
    attemptid: props.attempt.id,
    sourceid: props.attempt.sourceId,
    packrevisionid: props.attempt.packRevisionId ?? '',
    place: props.place.screen,
  };
}

/**
 * `attempt`: the stage. The puzzle's title and difficulty, what it asks,
 * the game's player on the saved position, one status line (the save), and
 * with the board its own commands (undo, redo, restart) and the one
 * control onward.
 */
function AttemptStage(props: ContentAttemptScreenViewProps): JSX.Element {
  return (
    <GameScreen
      screenId="puzzle-content-attempt"
      dataSet={attemptDataSet(props)}
      title={props.attempt.title}
      keepTitle
      facts={
        <Show when={props.attempt.difficulty}>
          {(difficulty) => <Badge intent="neutral" label={difficulty()} />}
        </Show>
      }
    >
      <GameSessionLayout
        notices={
          <>
            <AttemptRule {...props} />
            <AttemptAlerts {...props} />
          </>
        }
        status={<ContentAttemptSaveStatus {...props} />}
        actions={
          <>
            {props.controls}
            <OpenProgress {...props} />
          </>
        }
        stageAlign={props.stageAlign}
      >
        <Show when={!props.unopenable} fallback={<Unopenable {...props} />}>
          {props.player}
        </Show>
      </GameSessionLayout>
    </GameScreen>
  );
}

/** `progress` under the attempt's title, with what needs the person first. */
function AttemptProgress(props: ContentAttemptScreenViewProps): JSX.Element {
  const { t } = useLingui();
  return (
    <EmbeddedScreen
      screenId="puzzle-content-attempt-progress"
      dataSet={attemptDataSet(props)}
      title={props.attempt.title}
      subtitle={t`Where this attempt stands`}
    >
      <AttemptAlerts {...props} />
      <ContentAttemptProgressView view={props} />
    </EmbeddedScreen>
  );
}

/** The attempt cannot be shown: why, and the way back to the puzzles. */
function AttemptUnavailable(props: {
  gone: boolean;
  onReturnToLibrary: () => void;
}): JSX.Element {
  const { t } = useLingui();
  return (
    <ErrorState
      title={
        props.gone
          ? t`This attempt is no longer here`
          : t`This puzzle has not reached this device`
      }
      body={
        props.gone
          ? t`It was removed, or it belongs to another account. Return to puzzles to continue another.`
          : t`Return to puzzles, reconnect and open the attempt again. Your progress stays saved.`
      }
      secondary={{
        label: t`Return to puzzles`,
        onClick: () => props.onReturnToLibrary(),
      }}
    />
  );
}

/**
 * A saved attempt at a published puzzle or a private playtest,
 * presentational, as two small screens. `attempt` is the stage: the
 * puzzle's title and difficulty, what it asks, the game's player on the
 * saved position, the save status as its one status line, undo, redo and
 * restart, and one control onward. `progress` is where the attempt stands:
 * its place in its pack and the next puzzle, the game's figures, the save
 * status, the completion, and the kept positions. A change that was not
 * saved and rules this app lacks are said on both — or loading, denied,
 * gone and not-on-this-device states. Player, commands and dialogs arrive as slots.
 */
export function ContentAttemptScreenView(
  props: ContentAttemptScreenViewProps
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
        <Switch>
          <Match when={props.place.screen === 'attempt'}>
            <AttemptStage {...props} />
          </Match>
          <Match when={props.place.screen === 'progress'}>
            <AttemptProgress {...props} />
          </Match>
        </Switch>
        {props.confirms}
      </Match>
      <Match when={props.status === 'gone' || props.status === 'missing'}>
        <AttemptUnavailable
          gone={props.status === 'gone'}
          onReturnToLibrary={props.onReturnToLibrary}
        />
      </Match>
    </Switch>
  );
}
