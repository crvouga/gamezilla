import type { JSX } from '@solidjs/web';
import { createSignal } from 'solid-js';
import type { MatchmakingScreenViewProps } from './matchmaking-screen-view';
import {
  STORY_GAME,
  StoryAnnouncement,
  StoryPlaces,
  StoryStage,
  storyMoves,
} from './matchmaking-screen-view.example';

/** A compatible opponent is already waiting when the person seeks a match. */
export function MatchmakingStartExample(
  props: MatchmakingScreenViewProps
): JSX.Element {
  const [paired, setPaired] = createSignal(false);
  const [moves, setMoves] = createSignal<readonly number[]>([]);
  const ownTurn = () => moves().length === 0;
  return (
    <StoryPlaces
      {...props}
      stage={paired() ? 'playing' : 'idle'}
      onFind={async (control) => {
        await props.onFind(control);
        setPaired(true);
      }}
      game={
        paired()
          ? {
              ...STORY_GAME,
              leave: 'abort',
              moves: storyMoves(moves().length, moves()),
            }
          : null
      }
      board={(stage) => (
        <StoryStage
          information={stage.information}
          preparation={stage.setup}
          moves={moves()}
          active={ownTurn()}
          onDrop={(column) => setMoves([column])}
        />
      )}
      status={
        <StoryAnnouncement title={ownTurn() ? 'Your turn.' : 'Bob to move.'} />
      }
    />
  );
}
