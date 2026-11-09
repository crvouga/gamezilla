/**
 * Story-only: a game's puzzle player inside the screen a person plays a
 * pack puzzle on (`ContentAttemptScreenView`), so a game's player stories
 * show the title, the difficulty, the puzzle panel and its commands as the
 * app does. Production never imports this module.
 */
import { Button } from '@pkgs/ui-root-client-ts/button';
import { StackHorizontal } from '@pkgs/ui-root-client-ts/stack';
import { type JSX, Show } from 'solid-js';
import { fn } from 'storybook/test';
import {
  type AttemptFigure,
  type ContentAttemptPack,
  ContentAttemptScreenView,
} from './content-attempt-screen-view';
import type { PuzzleContentFrame } from './puzzle-content-client';

/** The puzzle a story plays, as its pack publishes it. */
export type StoryPackPuzzle = {
  readonly title: string;
  readonly difficulty: string;
  readonly description: string;
  readonly pack: ContentAttemptPack | null;
};

/** A pack puzzle's way on, as the pack card shows it: next once solved, then the overview. */
export function StoryPackActions(props: {
  readonly next?: { title: string; open: () => void } | undefined;
  readonly onOverview?: (() => void) | undefined;
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
        title="Pack overview"
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

/** `player` on a saved attempt at `puzzle`, as the app shows it. */
export function StoryPackAttempt(props: {
  readonly puzzle: StoryPackPuzzle;
  readonly complete?: boolean | undefined;
  readonly saving?: boolean | undefined;
  readonly next?: { title: string; open: () => void } | undefined;
  readonly disabled?: boolean | undefined;
  readonly player: JSX.Element;
  /** Stateful controls supplied by a game's rules-backed history fixture. */
  readonly controls?: JSX.Element;
  /** A game's own pack actions; by default next (once solved) and overview. */
  readonly packActions?: JSX.Element;
  /** The game's own figures for the attempt (`Connected pairs 2`). */
  readonly figures?: readonly AttemptFigure[] | undefined;
  readonly figuresPlacement?: PuzzleContentFrame['figuresPlacement'];
  /** The game's `frame.stageAlign`, as the production attempt screen passes it. */
  readonly stageAlign?: 'start' | 'center' | undefined;
  /** A completion is already saved, as the production screen reads it. */
  readonly solvedBefore?: boolean | undefined;
}): JSX.Element {
  return (
    <ContentAttemptScreenView
      status="ready"
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
      packActions={
        props.packActions ?? (
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
  );
}
