import { useStoryPuzzlePlaces } from '@libs/game-puzzle-client-ts/puzzle-places-story.example';
import {
  PUZZLE_PLAY_STORY_ARGS,
  PuzzlePlayScreenView,
  STORY_LINE,
  storyLine,
} from '@libs/game-puzzle-client-ts/puzzle-screen-story.example';
import { createSignal } from 'solid-js';
import { ChessPuzzleBoard } from './chess-puzzle-board';

const STEPS = [
  { position: STORY_LINE.start, move: 'f3e5', reply: 'g4d1' },
  { position: STORY_LINE.afterBxd1, move: 'c4f7', reply: 'e8e7' },
  { position: STORY_LINE.afterKe7, move: 'c3d5', reply: 'c3d5' },
] as const;

const noop = (): void => {};

/** The moves of the line reached after `step` solver moves and their replies. */
function pliesAfter(step: number): number {
  return Math.min(6, 1 + step * 2);
}

/**
 * Deterministic screen fixture: accepted moves advance through the recorded
 * line, and the screen walks the feed's places as the app does: the board
 * while solving, the result once solved, the line from there.
 */
export function ChessPuzzleJourney() {
  const [step, setStep] = createSignal(0);
  const [wrong, setWrong] = createSignal(false);
  const [hint, setHint] = createSignal(false);
  const [revision, setRevision] = createSignal(0);
  const solved = () => step() === STEPS.length;
  const position = () =>
    wrong() ? STORY_LINE.wrong : (STEPS[step()]?.position ?? STORY_LINE.mate);
  const retry = () => {
    setWrong(false);
    setHint(false);
    setRevision((value) => value + 1);
  };
  const places = useStoryPuzzlePlaces({
    stage: () => (solved() ? 'finished' : 'playing'),
    place: () => ({ screen: 'play' }),
    onOpen: noop,
    onBack: noop,
  });
  const play = (action: string) => {
    if (action === STEPS[step()]?.move) {
      setStep((value) => value + 1);
      setHint(false);
    } else if (step() === 0 && action === 'c3d5') setWrong(true);
  };
  return (
    <PuzzlePlayScreenView
      {...PUZZLE_PLAY_STORY_ARGS}
      stage={solved() ? 'finished' : 'playing'}
      place={places.place()}
      onOpen={places.onOpen}
      onBack={places.onBack}
      line={storyLine({ count: pliesAfter(step()), awaiting: !solved() })}
      boardSizing="width"
      status={wrong() ? 'wrong' : solved() ? 'solved' : 'solving'}
      statusKind={wrong() ? 'failed' : solved() ? 'solved' : 'started'}
      hintStage={hint() ? 'highlight' : 'none'}
      coach={{
        message: wrong()
          ? 'That knight move misses the tactic. Retry from the same position.'
          : solved()
            ? 'Checkmate. Puzzle solved.'
            : hint()
              ? 'Look at the knight on f3. What can it take?'
              : 'Find the forcing move.',
      }}
      onHint={() => setHint(true)}
      onRetry={retry}
      board={(size) => (
        <ChessPuzzleBoard
          mode="play"
          position={position()}
          orientation="white"
          interactive={
            !wrong() && !solved() && places.place().screen === 'play'
          }
          sound={false}
          syncKey={revision()}
          onAction={play}
          testId="chess-puzzle-journey"
          setup={null}
          hand={null}
          committed={[]}
          commitment={null}
          size={size}
          animated={false}
          moveMs={0}
          marks={{
            wrong: wrong() ? 'd5' : null,
            hint: hint() ? 'f3' : null,
            solution: null,
          }}
          suggestions={[]}
          lastAction={step() > 0 ? (STEPS[step() - 1]?.reply ?? null) : 'g7g6'}
        />
      )}
    />
  );
}
