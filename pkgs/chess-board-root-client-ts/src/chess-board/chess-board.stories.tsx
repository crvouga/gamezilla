import { BoardMotionProvider } from '@pkgs/chess-board-root-client-ts/board-motion-context';
import { AudioPlaybackProvider } from '@pkgs/sounds-client-ts/solid';
import { createInMemoryAudioPlaybackPort } from '@pkgs/sounds-shared-ts/in-memory-audio-playback-port';
import type { ComponentProps } from 'solid-js';
import type { Meta, StoryObj } from 'storybook-solidjs-vite';
import { ChessBoard } from './index';

function BoardFixture(props: ComponentProps<typeof ChessBoard>) {
  const audio = createInMemoryAudioPlaybackPort();
  const motion = {
    animate: null,
    prefersReducedMotion: () => true,
    lowEnd: false,
    hidden: () => false,
    paintedTransform: () => '',
  };
  return (
    <AudioPlaybackProvider value={audio}>
      <BoardMotionProvider value={motion}>
        <ChessBoard {...props} />
      </BoardMotionProvider>
    </AudioPlaybackProvider>
  );
}
const meta = {
  title: 'Product/ChessBoard',
  render: (args) => <BoardFixture {...args} />,
  component: ChessBoard,
  tags: ['autodocs'],
  args: { size: 320, sound: false, animations: false, showCoordinates: true },
} satisfies Meta<typeof ChessBoard>;
export default meta;
// regression: storybook-clock-context-child-spread
export const Initial: StoryObj<typeof meta> = {};
export const BlackOrientation: StoryObj<typeof meta> = {
  args: { orientation: 'black' },
};
export const ReadOnly: StoryObj<typeof meta> = { args: { interactive: false } };
export const Endgame: StoryObj<typeof meta> = {
  args: { fen: '8/8/4k3/8/4K3/8/8/8 w - - 0 1' },
};
export const Promotion: StoryObj<typeof meta> = {
  args: { fen: '7k/P7/8/8/8/8/8/7K w - - 0 1' },
};
