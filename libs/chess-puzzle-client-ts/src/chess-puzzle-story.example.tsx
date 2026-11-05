/**
 * Story-only fixtures for chess's puzzle screens: what the chess board reads
 * from the app around it, and the platform's puzzle positions drawn on
 * chess's own puzzle board. Production never imports this module.
 */
import {
  PuzzlePlayScreenView,
  type PuzzlePlayScreenViewProps,
} from '@libs/game-puzzle-client-ts/puzzle-play-screen-view';
import type { StoryPuzzleBoardProps } from '@libs/game-puzzle-client-ts/puzzle-screen-story.example';
import { BoardMotionProvider } from '@pkgs/chess-board-root-client-ts/board-motion-context';
import {
  AudioPlaybackProvider,
  SoundsPreferenceProvider,
} from '@pkgs/sounds-client-ts/solid';
import { createInMemoryAudioPlaybackPort } from '@pkgs/sounds-shared-ts/in-memory-audio-playback-port';
import type { JSX } from 'solid-js';
import { createJSXDecorator } from 'storybook-solidjs-vite';
import { ChessPuzzleBoard } from './chess-puzzle-board';

/**
 * Story decorator: silent audio playback, the app's sound preference and
 * still, reduced-motion piece movement.
 */
export const withChessPuzzleBoardContext = createJSXDecorator((Story) => (
  <AudioPlaybackProvider value={createInMemoryAudioPlaybackPort()}>
    <SoundsPreferenceProvider>
      <BoardMotionProvider
        value={{
          animate: null,
          prefersReducedMotion: () => true,
          lowEnd: false,
          hidden: () => false,
          paintedTransform: () => '',
        }}
      >
        <Story />
      </BoardMotionProvider>
    </SoundsPreferenceProvider>
  </AudioPlaybackProvider>
));

const noop = (): void => {};

/** A story's puzzle position on chess's own puzzle board, White to solve. */
export function StoryChessPuzzleBoard(
  props: StoryPuzzleBoardProps
): JSX.Element {
  return (
    <ChessPuzzleBoard
      mode="play"
      position={props.position}
      orientation="white"
      interactive
      sound={false}
      syncKey={0}
      onAction={noop}
      testId={props.testId}
      setup={null}
      hand={null}
      committed={[]}
      commitment={null}
      size={props.size}
      animated={false}
      moveMs={null}
      marks={props.marks ?? { wrong: null, hint: null, solution: null }}
      suggestions={[]}
      lastAction={props.lastAction ?? null}
    />
  );
}

/**
 * Puzzle play, as chess's puzzle feed shows it: the platform's play screen
 * (the feed strip, the coach with whose move it is, the board well, the
 * move list and the actions, beside the board in one panel when wide) with
 * chess's own puzzle board in its well.
 */
export function StoryChessPuzzlePlayScreen(
  props: PuzzlePlayScreenViewProps
): JSX.Element {
  return <PuzzlePlayScreenView {...props} />;
}
