import { StoryPackAttempt } from '@libs/game-puzzle-client-ts/content-attempt-story.example';
import { sokobanPuzzleContent } from '@libs/sokoban-shared-ts/sokoban-puzzle-content';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { StackHorizontal } from '@pkgs/ui-root-client-ts/stack';
import { createSignal, untrack } from 'solid-js';
import { sokobanGameClient } from './sokoban-game-client';
import { SokobanPlayerView } from './sokoban-player';

/** Story-only local position history; every forward move uses production rules. */
/** The attempt's commands, styled as the production screen styles them. */
function StoryControls(props: {
  disabled: boolean;
  canUndo: boolean;
  canRedo: boolean;
  onUndo: () => void;
  onRedo: () => void;
  onRestart: () => void;
  onOpenLibrary: () => void;
}) {
  return (
    <StackHorizontal gap="sm" wrap>
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
      {/* As the production screen offers a pack puzzle's way on. */}
      <Button
        title="Pack overview"
        intent="neutral"
        variant="outline"
        size="sm"
        onClick={props.onOpenLibrary}
      />
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
  const [history, setHistory] = createSignal([untrack(() => props.state)]);
  const [cursor, setCursor] = createSignal(0);
  const state = () => history()[cursor()] ?? props.state;
  const rules = sokobanPuzzleContent.rules;
  // As in production: complete while the board is solved; once solved, the
  // completion stays saved and is said quietly after a restart.
  const complete = () => rules.complete(props.definition, state());
  const [completionSaved, setCompletionSaved] = createSignal(
    untrack(() => complete())
  );
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
      disabled={props.disabled}
      player={
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
      }
      controls={
        <StoryControls
          disabled={props.disabled}
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
          onOpenLibrary={props.onOpenLibrary}
        />
      }
    />
  );
}
