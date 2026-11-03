import { BoardMotionProvider } from '@pkgs/chess-board-root-client-ts/board-motion-context';
import { AudioPlaybackProvider } from '@pkgs/sounds-client-ts/solid';
import { createInMemoryAudioPlaybackPort } from '@pkgs/sounds-shared-ts/in-memory-audio-playback-port';
import { createJSXDecorator } from 'storybook-solidjs-vite';

/**
 * Story decorator: what the chess board reads from the app around it —
 * silent audio playback and still, reduced-motion piece movement.
 */
export const withChessBoardContext = createJSXDecorator((Story) => (
  <AudioPlaybackProvider value={createInMemoryAudioPlaybackPort()}>
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
  </AudioPlaybackProvider>
));
