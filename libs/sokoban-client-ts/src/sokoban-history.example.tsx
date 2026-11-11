import {
  StoryPackActions,
  StoryPackAttempt,
} from '@libs/game-puzzle-client-ts/content-attempt-story.example';
import { sokobanPuzzleContent } from '@libs/sokoban-shared-ts/sokoban-puzzle-content';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { StackHorizontal } from '@pkgs/ui-root-client-ts/stack';
import { VisuallyHidden } from '@pkgs/ui-root-client-ts/visually-hidden';
import { createSignal, type JSX, Show, untrack } from 'solid-js';
import { sokobanGameClient } from './sokoban-game-client';
import { SokobanPlayerView } from './sokoban-player';

/**
 * A pack puzzle's ways on, as its progress screen offers them, with where
 * the last one pressed asked to go (readable there, where they are pressed).
 */
function StoryWayOn(props: {
  opened: string;
  complete: boolean;
  onOpen: (destination: string) => void;
}): JSX.Element {
  return (
    <>
      <VisuallyHidden testId="story-way-on-opened">
        {props.opened}
      </VisuallyHidden>
      <StoryPackActions
        next={
          props.complete
            ? { title: 'Lift', open: () => props.onOpen('Lift') }
            : undefined
        }
        onOverview={() => props.onOpen('Pack overview')}
      />
    </>
  );
}

/** Story-only local position history; every forward move uses production rules. */
/** The attempt's commands, styled as the production screen styles them. */
function StoryControls(props: {
  disabled: boolean;
  /** As production, commands that cannot help unreadable content are withheld. */
  readable: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onRestart: () => void;
}) {
  return (
    <StackHorizontal gap="sm" wrap shrink>
      <Show when={props.readable}>
        <Button
          title="Undo"
          intent="neutral"
          variant="outline"
          size="sm"
          disabled={props.disabled || !props.canUndo}
          onClick={props.onUndo}
        />
        <Button
          title="Redo"
          intent="neutral"
          variant="outline"
          size="sm"
          disabled={props.disabled || !props.canRedo}
          onClick={props.onRedo}
        />
        <Button
          title="Restart"
          intent="neutral"
          variant="outline"
          size="sm"
          disabled={props.disabled}
          onClick={props.onRestart}
        />
      </Show>
    </StackHorizontal>
  );
}

export function SokobanHistory(props: {
  definition: string;
  state: string;
  disabled: boolean;
  onAction: (action: string) => void;
  onOpenLibrary: () => void;
}) {
  const rules = sokobanPuzzleContent.rules;
  // A resumed attempt can step back to where it started, as a saved
  // attempt's history can.
  const [history, setHistory] = createSignal(
    untrack(() => {
      const start = rules.initial(props.definition);
      return start.accepted && start.state !== props.state
        ? [start.state, props.state]
        : [props.state];
    })
  );
  const [cursor, setCursor] = createSignal(untrack(() => history().length - 1));
  const state = () => history()[cursor()] ?? props.state;
  // As in production: complete while the board is solved; once solved, the
  // completion stays saved and is said quietly after a restart.
  const complete = () => rules.complete(props.definition, state());
  const [completionSaved, setCompletionSaved] = createSignal(
    untrack(() => complete())
  );
  // Story-only: where a way on was asked to go, so a journey can click it
  // for real and read the destination (production navigates instead).
  const [opened, setOpened] = createSignal('');
  const open = (destination: string) => {
    setOpened(destination);
    props.onOpenLibrary();
  };
  return (
    <StoryPackAttempt
      // As the production attempt screen passes the game's frame.
      stageAlign={sokobanGameClient.puzzleContent.frame.stageAlign}
      puzzle={{
        title: 'Two crates',
        difficulty: 'Easy',
        description: 'Push each crate onto a goal.',
        pack: { title: 'Warehouse basics', position: 3, total: 4 },
      }}
      complete={complete()}
      solvedBefore={completionSaved()}
      // As production: the pack's next puzzle (once solved) and its
      // overview, in the pack card.
      wayOn={
        <StoryWayOn opened={opened()} complete={complete()} onOpen={open} />
      }
      disabled={props.disabled}
      player={
        <>
          <VisuallyHidden testId="story-way-on-opened">
            {opened()}
          </VisuallyHidden>
          <SokobanPlayerView
            onReturnToLibrary={props.onOpenLibrary}
            // A pack's puzzle: the screen offers the pack overview and next.
            context={{ kind: 'pack', shellOffersWayOn: true }}
            definition={props.definition}
            state={state()}
            disabled={props.disabled}
            onAction={(action) => {
              const next = rules.apply(props.definition, state(), action);
              if (!next.accepted) throw new Error('Player sent a refused move');
              props.onAction(action);
              if (rules.complete(props.definition, next.state))
                setCompletionSaved(true);
              setHistory((values) => [
                ...values.slice(0, cursor() + 1),
                next.state,
              ]);
              setCursor((value) => value + 1);
            }}
          />
        </>
      }
      controls={
        <StoryControls
          disabled={props.disabled}
          readable={rules.validateDefinition(props.definition).valid}
          canUndo={cursor() > 0}
          canRedo={cursor() < history().length - 1}
          onUndo={() => setCursor((value) => value - 1)}
          onRedo={() => setCursor((value) => value + 1)}
          onRestart={() => {
            const initial = rules.initial(props.definition);
            if (!initial.accepted) throw new Error('Invalid restart');
            setHistory([initial.state]);
            setCursor(0);
          }}
        />
      }
    />
  );
}
