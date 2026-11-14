/**
 * Story-only: a game's puzzle player inside the screens a person plays a
 * pack puzzle on (`ContentAttemptScreenView`), so a game's player stories
 * show the title, the difficulty, its commands and, behind "Progress", the
 * puzzle panel as the app does. Production never imports this module.
 */
import { Button } from '@pkgs/ui-root-client-ts/button';
import { StackHorizontal, StackVertical } from '@pkgs/ui-root-client-ts/stack';
import { TileBoard } from '@pkgs/ui-root-client-ts/tile-board';
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
  onRestart: fn(),
  onUpdateApp: fn(),
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

/** A pack puzzle's way around, as its details screen shows it: the overview. */
export function StoryPackActions(props: {
  readonly onOverview?: (() => void) | undefined;
  /** The quieter way on's name; a pack's overview unless it says otherwise. */
  readonly overview?: string | undefined;
}): JSX.Element {
  return (
    <Button
      title={props.overview ?? 'Pack overview'}
      intent="neutral"
      variant="outline"
      onClick={props.onOverview}
      dataSet={{
        testid:
          props.overview === undefined
            ? 'content-return-pack'
            : 'content-return-builder',
      }}
    />
  );
}

/**
 * The solved board's one command onward, as production words it: the
 * pack's next puzzle, or back to the pack once there is none.
 */
export function StoryPackOnward(props: {
  readonly next?: { title: string; open: () => void } | undefined;
  readonly onPack?: (() => void) | undefined;
}): JSX.Element {
  return (
    <Show
      when={props.next}
      fallback={
        <Button
          title="See the finished pack"
          fullWidth
          onClick={props.onPack}
          dataSet={{ testid: 'content-finished-pack' }}
        />
      }
    >
      {(next) => (
        <Button
          title={`Next puzzle: ${next().title}`}
          fullWidth
          onClick={next().open}
          dataSet={{ testid: 'content-next-puzzle' }}
        />
      )}
    </Show>
  );
}

/**
 * The solved board's command onward for a counting attempt story, as
 * production picks it: a playtest's builder, the pack's next puzzle (or
 * the finished pack), or another puzzle.
 */
export function StoryAttemptOnward(props: {
  readonly args: ContentAttemptScreenViewProps;
}): JSX.Element {
  const finished = () =>
    props.args.pack !== null &&
    props.args.pack !== undefined &&
    (props.args.packSolved ?? 0) >= props.args.pack.total;
  return (
    <Show
      when={!props.args.playtest}
      fallback={
        <Button
          title="Return to builder"
          fullWidth
          dataSet={{ testid: 'content-solved-builder' }}
        />
      }
    >
      <Show
        when={props.args.pack}
        fallback={
          <Button
            title="Choose another puzzle"
            intent="neutral"
            variant="outline"
            fullWidth
            dataSet={{ testid: 'content-solved-library' }}
          />
        }
      >
        <StoryPackOnward
          next={finished() ? undefined : { title: 'Count to nine', open: fn() }}
        />
      </Show>
    </Show>
  );
}

/** The counting board is five squares a side, as a small real puzzle board is. */
const COUNTING_COLUMNS = 5;

/**
 * The counting game's board as a person plays it (`3 of 7`): a track of
 * squares from zero to the target on a five-square board, walls after it,
 * with the counter where the count stands,
 * and the game's two moves under it. Story-only: production games bring
 * their own boards.
 */
export function StoryCountingBoard(props: {
  /** `<count> of <target>`. */
  readonly state: string;
  readonly disabled?: boolean | undefined;
}): JSX.Element {
  const numbers = () => /^(\d+) of (\d+)$/.exec(props.state);
  const count = () => Number(numbers()?.[1] ?? 0);
  const target = () => Math.max(1, Number(numbers()?.[2] ?? 7));
  const rows = () =>
    Math.max(COUNTING_COLUMNS, Math.ceil((target() + 1) / COUNTING_COLUMNS));
  return (
    <StackVertical gap="md">
      <TileBoard
        label={`Counted ${count()} of ${target()}`}
        testId="story-counting-board"
        columns={COUNTING_COLUMNS}
        rows={rows()}
        tiles={Array.from(
          { length: rows() * COUNTING_COLUMNS },
          (_, index) => ({
            terrain: index <= target() ? ('open' as const) : ('solid' as const),
            marked: index === target(),
            label: String(index),
          })
        )}
        pieces={[
          {
            id: 'counter',
            column: count() % COUNTING_COLUMNS,
            row: Math.floor(count() / COUNTING_COLUMNS),
            glyph: String(count()),
            tone: count() === target() ? 'settled' : 'actor',
          },
        ]}
        disabled={props.disabled === true}
      />
      <StackHorizontal gap="sm" paddingX="lg">
        <Button
          title="Take one step"
          intent="neutral"
          variant="outline"
          flex={1}
          disabled={props.disabled === true || count() >= target()}
        />
        <Button
          title="Take two steps"
          intent="neutral"
          variant="outline"
          flex={1}
          disabled={props.disabled === true || count() + 2 > target()}
        />
      </StackHorizontal>
    </StackVertical>
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
 * board, with "Details" opening where the attempt stands and its own
 * "Back to the board" returning, so a story can walk both screens.
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
  /** A game's own way around on the details screen; by default the overview. */
  readonly wayOn?: JSX.Element;
  /** The solved board's command onward; by default `next`, else the finished pack. */
  readonly onward?: JSX.Element;
  /** The pack's solved count, this puzzle included once solved. */
  readonly packSolved?: number | undefined;
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
        packSolved={props.packSolved}
        wayOn={props.wayOn ?? <StoryPackActions />}
        onward={props.onward ?? <StoryPackOnward next={props.next} />}
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
