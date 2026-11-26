import type { JSX } from '@solidjs/web';
import { createSignal } from 'solid-js';
import { ConnectFourStoryBoard } from './connect-four-story-board.example';
import type { CustomGameScreenViewProps } from './custom-game-screen-view';
import { FrameStory } from './game-frame-board.example';
import { FRAME_CONFIGURING } from './game-frame-setup-story.example';
import {
  AVERY,
  BOT,
  FRAME_PLAYING,
  playSeat,
  record,
  status,
} from './game-frame-story.example';

/** The host has a ready bot opponent. Starting and dropping the first disc update the same screen. */
export function CustomGameStartExample(
  props: CustomGameScreenViewProps
): JSX.Element {
  const [started, setStarted] = createSignal(false);
  const [moves, setMoves] = createSignal<readonly number[]>([]);
  const ownTurn = () => moves().length === 0;
  return (
    <FrameStory
      {...props}
      {...(started() ? FRAME_PLAYING : FRAME_CONFIGURING)}
      onChoose={async (choice) => {
        await props.onChoose(choice);
        if (choice.operation === 'start') setStarted(true);
      }}
      status={
        started()
          ? status({
              lineup: 'Red circle: avery. Yellow diamond: Bot (medium).',
              emphasis: ownTurn() ? 'yours' : 'neutral',
              description: ownTurn() ? 'Your turn.' : 'Bot (medium) to move.',
            })
          : (FRAME_CONFIGURING.status ?? null)
      }
      table={{
        shape: 'strip',
        near: playSeat(AVERY, { deciding: ownTurn() }),
        others: [playSeat(BOT, { deciding: !ownTurn() })],
      }}
      record={record(moves().map((column) => String(column + 1)))}
      board={
        <ConnectFourStoryBoard
          moves={moves()}
          interactive={started() && ownTurn()}
          onDrop={(column) => setMoves([column])}
        />
      }
    />
  );
}
