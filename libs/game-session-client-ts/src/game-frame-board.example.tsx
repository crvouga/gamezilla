import { ConnectFourStoryBoard } from './connect-four-story-board.example';
import { recordReviewing } from './game-frame-record-view';
import {
  GameFrameScreenView,
  type GameFrameScreenViewProps,
} from './game-frame-screen-view';
import { WON_LINE, WON_MOVES } from './game-frame-story.example';

/** The frame with Connect Four's board at the position `moves` reach. */
export function onBoard(moves: readonly number[]) {
  return (args: GameFrameScreenViewProps) => (
    <GameFrameScreenView
      {...args}
      board={
        <ConnectFourStoryBoard
          moves={moves}
          interactive={
            args.phase === 'active' &&
            !args.stopped &&
            (args.connection === 'online' ||
              args.connection === 'offline-local') &&
            !args.status?.sending &&
            !recordReviewing(args.record) &&
            args.viewerSide !== null &&
            args.table.near?.side === args.viewerSide &&
            args.table.near.deciding &&
            !args.table.near.standIn
          }
          winning={moves === WON_MOVES ? WON_LINE : undefined}
        />
      }
    />
  );
}
