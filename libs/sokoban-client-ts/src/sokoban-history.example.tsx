import { StoryPackAttempt } from '@libs/game-puzzle-client-ts/content-attempt-story.example';
import { sokobanPuzzleContent } from '@libs/sokoban-shared-ts/sokoban-puzzle-content';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { StackHorizontal } from '@pkgs/ui-root-client-ts/stack';
import { createSignal, untrack } from 'solid-js';
import { SokobanPlayer } from './sokoban-player';

/** Story-only local position history; every forward move uses production rules. */
export function SokobanHistory(props: {
  definition: string;
  state: string;
  disabled: boolean;
  onAction: (action: string) => void;
}) {
  const [history, setHistory] = createSignal([untrack(() => props.state)]);
  const [cursor, setCursor] = createSignal(0);
  const state = () => history()[cursor()] ?? props.state;
  const rules = sokobanPuzzleContent.rules;
  return (
    <StoryPackAttempt
      puzzle={{
        title: 'Two crates',
        difficulty: 'Easy',
        description: 'Push each crate onto a goal.',
        pack: { title: 'Warehouse basics', position: 3, total: 4 },
      }}
      complete={rules.complete(props.definition, state())}
      disabled={props.disabled}
      player={
        <SokobanPlayer
          definition={props.definition}
          state={state()}
          disabled={props.disabled}
          onAction={(action) => {
            const next = rules.apply(props.definition, state(), action);
            if (!next.accepted) throw new Error('Player sent a refused move');
            props.onAction(action);
            setHistory((values) => [
              ...values.slice(0, cursor() + 1),
              next.state,
            ]);
            setCursor((value) => value + 1);
          }}
        />
      }
      controls={
        <StackHorizontal gap="sm" wrap>
          <Button
            title="Undo"
            disabled={props.disabled || cursor() === 0}
            onClick={() => setCursor((value) => value - 1)}
          />
          <Button
            title="Redo"
            disabled={props.disabled || cursor() === history().length - 1}
            onClick={() => setCursor((value) => value + 1)}
          />
          <Button
            title="Restart"
            disabled={props.disabled}
            onClick={() => {
              const initial = rules.initial(props.definition);
              if (!initial.accepted) throw new Error('Invalid restart');
              setHistory([initial.state]);
              setCursor(0);
            }}
          />
        </StackHorizontal>
      }
    />
  );
}
