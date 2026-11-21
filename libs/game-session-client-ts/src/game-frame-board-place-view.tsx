import { Trans } from '@lingui/solid/macro';
import { Button } from '@pkgs/ui-root-client-ts/button';
import { GameBoardStage } from '@pkgs/ui-root-client-ts/game-board-stage';
import { GameScreen } from '@pkgs/ui-root-client-ts/game-screen';
import { GameSessionLayout } from '@pkgs/ui-root-client-ts/game-session-layout';
import type { JSX } from 'solid-js';
import { FrameBoard, FrameFacts } from './game-frame-play-view';
import type { FramePlaceProps } from './game-frame-screen-view';
import { FrameNoticesView } from './game-frame-shell';
import { FrameStatusView } from './game-frame-status-view';

/**
 * The board place, while a game is set up: the board the game starts on, at
 * its playing size and facing the person as it will once they play. Nothing
 * is played or changed here; the lobby is one step back.
 */
export function FrameBoardPlace(props: FramePlaceProps): JSX.Element {
  return (
    <GameScreen
      screenId="custom-game-board-preview"
      title={<Trans>Board</Trans>}
      compactInset={props.table.compactInset}
      facts={<FrameFacts {...props} />}
    >
      <GameSessionLayout
        dataSet={{
          component: 'CustomGameContent',
          testid: 'custom-game-content',
          phase: props.phase,
          place: props.place.screen,
        }}
        notices={
          <FrameNoticesView connection={props.connection} error={props.error} />
        }
        actions={
          <Button
            title={<Trans>Back to the lobby</Trans>}
            variant="solid"
            onClick={() => props.onClose()}
            dataSet={{ testid: 'custom-game-board-close' }}
          />
        }
      >
        <GameBoardStage
          viewportFit={props.boardFit}
          align={props.boardAlign}
          dataSet={{ ...props.boardState, testid: 'custom-game-public' }}
        >
          <FrameBoard {...props} />
        </GameBoardStage>
        <FrameStatusView status={props.status} spokenOnly />
      </GameSessionLayout>
    </GameScreen>
  );
}
