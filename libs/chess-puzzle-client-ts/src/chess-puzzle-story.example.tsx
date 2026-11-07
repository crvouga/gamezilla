/**
 * Story-only fixtures for chess's puzzle screens: what the chess board reads
 * from the app around it, and the platform's puzzle positions drawn on
 * chess's own puzzle board. Production never imports this module.
 */
import type { StoryPuzzleBoardProps } from '@libs/game-puzzle-client-ts/puzzle-screen-story.example';
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
 * still piece movement selected by each board fixture’s `animated={false}`.
 */
export const withChessPuzzleBoardContext = createJSXDecorator((Story) => (
  <AudioPlaybackProvider value={createInMemoryAudioPlaybackPort()}>
    <SoundsPreferenceProvider>
      <Story />
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
