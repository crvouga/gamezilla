/**
 * Story-only: a game's puzzle player inside the screens a person plays a
 * pack puzzle on (`ContentAttemptScreenView`), so a game's player stories
 * show the title, the difficulty, its commands and, behind "Progress", the
 * puzzle panel as the app does. Production never imports this module.
 */
import { Button } from '@pkgs/ui-root-client-ts/button';
import { StackHorizontal } from '@pkgs/ui-root-client-ts/stack';
import { createSignal, type JSX, Show, untrack } from 'solid-js';
import { fn } from 'storybook/test';
import {
  type AttemptFigure,
  type ContentAttemptPack,
  ContentAttemptScreenView,
  type ContentAttemptScreenViewProps,
} from './content-attempt-screen-view';
import type { ContentAttemptPlace } from './content-places';
import type { PuzzleContentFrame } from './puzzle-content-client';

/** A saved attempt at a published counting puzzle, on its board. */
export const ATTEMPT_STORY_ARGS = {
  status: 'ready',
  place: { screen: 'attempt' },
  onOpen: fn(),
  attempt: {
    id: 'a77e0000-0000-4000-8000-000000000001',
    sourceId: '7c1e0a00-0000-4000-8000-000000000001',
    packRevisionId: null,
    title: 'Count to seven',
    difficulty: 'Easy',
    description: 'Reach seven exactly, one or two steps at a time.',
  },
  playtest: false,
  saving: false,
  changeError: null,
  complete: false,
  rulesChanged: false,
  unopenable: false,
  onRetryChange: fn(),
  onReturnToLibrary: fn(),
} satisfies ContentAttemptScreenViewProps;

/** What an attempt story's controls leave out: its data and slots. */
export const ATTEMPT_STORY_PARAMETERS = {
  appRouter: true,
  controls: {
    exclude: [
      'denial',
      'place',
      'attempt',
      'player',
      'controls',
      'wayOn',
      'keptPositions',
      'confirms',
    ],
  },
} as const;

/** The puzzle a story plays, as its pack publishes it. */
export type StoryPackPuzzle = {
  readonly title: string;
  readonly difficulty: string;
  readonly description: string;
  readonly pack: ContentAttemptPack | null;
};

/** A pack puzzle's way on, as its progress shows it: next once solved, then the overview. */
export function StoryPackActions(props: {
  readonly next?: { title: string; open: () => void } | undefined;
  readonly onOverview?: (() => void) | undefined;
  /** The quieter way on's name; a pack's overview unless it says otherwise. */
  readonly overview?: string | undefined;
}): JSX.Element {
  return (
    <>
      <Show when={props.next}>
        {(next) => (
          <Button
            title={`Next puzzle: ${next().title}`}
            size="sm"
            onClick={next().open}
            dataSet={{ testid: 'content-next-puzzle' }}
          />
        )}
      </Show>
      <Button
        title={props.overview ?? 'Pack overview'}
        intent="neutral"
        variant="outline"
        size="sm"
        onClick={props.onOverview}
      />
    </>
  );
}

/** An attempt's commands at rest: undo, redo and restart. */
function StoryPackAttemptControls(props: {
  readonly disabled: boolean;
}): JSX.Element {
  return (
    <StackHorizontal gap="sm" wrap shrink>
      <Button
        title="Undo"
        intent="neutral"
        variant="outline"
        size="sm"
        disabled={props.disabled}
      />
      <Button
        title="Redo"
        intent="neutral"
        variant="outline"
        size="sm"
        disabled
      />
      <Button
        title="Restart"
        intent="neutral"
        variant="outline"
        size="sm"
        disabled={props.disabled}
      />
    </StackHorizontal>
  );
}

/**
 * `player` on a saved attempt at `puzzle`, as the app shows it: on its
 * board, with "Progress" opening where the attempt stands and Back
 * (`story-attempt-back`) returning, so a story can walk both screens.
 */
export function StoryPackAttempt(props: {
  readonly puzzle: StoryPackPuzzle;
  readonly complete?: boolean | undefined;
  readonly saving?: boolean | undefined;
  readonly next?: { title: string; open: () => void } | undefined;
  readonly disabled?: boolean | undefined;
  readonly player: JSX.Element;
  /** Stateful controls supplied by a game's rules-backed history fixture. */
  readonly controls?: JSX.Element;
  /** A game's own way on; by default next (once solved) and overview. */
  readonly wayOn?: JSX.Element;
  /** The game's own figures for the attempt (`Connected pairs 2`). */
  readonly figures?: readonly AttemptFigure[] | undefined;
  readonly figuresPlacement?: PuzzleContentFrame['figuresPlacement'];
  /** The game's `frame.stageAlign`, as the production attempt screen passes it. */
  readonly stageAlign?: 'start' | 'center' | undefined;
  /** A completion is already saved, as the production screen reads it. */
  readonly solvedBefore?: boolean | undefined;
  /** The screen the story opens on; the board unless it says `progress`. */
  readonly place?: ContentAttemptPlace['screen'] | undefined;
}): JSX.Element {
  // Only the opening screen: later ones come from the story's own presses.
  const [place, setPlace] = createSignal<ContentAttemptPlace>({
    screen: untrack(() => props.place) ?? 'attempt',
  });
  return (
    <>
      <Show when={place().screen === 'progress'}>
        <Button
          title="Back"
          intent="neutral"
          variant="ghost"
          size="sm"
          onClick={() => setPlace({ screen: 'attempt' })}
          dataSet={{ testid: 'story-attempt-back' }}
        />
      </Show>
      <ContentAttemptScreenView
        status="ready"
        place={place()}
        onOpen={setPlace}
        figures={props.figures}
        figuresPlacement={props.figuresPlacement}
        stageAlign={props.stageAlign}
        attempt={{
          id: 'a77e0000-0000-4000-8000-0000000000b1',
          sourceId: '7c1e0a00-0000-4000-8000-0000000000b1',
          packRevisionId:
            props.puzzle.pack === null
              ? null
              : '7c1e0a00-0000-4000-8000-0000000000b2',
          title: props.puzzle.title,
          difficulty: props.puzzle.difficulty,
          description: props.puzzle.description,
        }}
        pack={props.puzzle.pack}
        playtest={false}
        saving={props.saving === true}
        changeError={null}
        complete={props.complete === true}
        solvedBefore={props.solvedBefore}
        rulesChanged={false}
        unopenable={false}
        player={props.player}
        wayOn={
          props.wayOn ?? (
            <StoryPackActions next={props.complete ? props.next : undefined} />
          )
        }
        controls={
          props.controls ?? (
            <StoryPackAttemptControls disabled={props.disabled === true} />
          )
        }
        onRetryChange={fn()}
        onReturnToLibrary={fn()}
      />
    </>
  );
}
