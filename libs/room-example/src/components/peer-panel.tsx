import type { Event, State } from '@gamezilla/room/types';
import { Card, Text } from '@gamezilla/lib/ui';
import { StateInspector } from './state-inspector';
import { TicTacToeBoard } from './tic-tac-toe-board';
import { PeerPanelHeader } from './peer-panel-header';
import { PeerPanelLegend } from './peer-panel-legend';
import { PeerPanelActions, type PeerAction } from './peer-panel-actions';
import { PeerPanelEvents } from './peer-panel-events';

export type { PeerAction } from './peer-panel-actions';

function derivePanelState(
  displayState: State,
  committedState: State,
  player: 'X' | 'O' | null,
): { isReadonly: boolean; hasOptimistic: boolean; turnHint: string } {
  const currentTurn = displayState['currentTurn'];
  const status = displayState['status'];
  const gameCompleted = status === 'completed';
  const isPlayerTurn =
    (player === 'X' || player === 'O') && currentTurn === player;

  return {
    isReadonly: player === null || !isPlayerTurn || gameCompleted,
    hasOptimistic: JSON.stringify(displayState) !== JSON.stringify(committedState),
    turnHint:
      player === null
        ? 'Authority/relay node'
        : gameCompleted
          ? 'Game completed'
          : isPlayerTurn
            ? 'Your turn'
            : `Waiting for ${currentTurn === 'X' || currentTurn === 'O' ? currentTurn : 'opponent'}`,
  };
}

export function PeerPanel({
  peerId,
  role,
  displayState,
  committedState,
  events,
  isOnline,
  isBadActor,
  isCheater,
  player,
  actions,
  onCellClick,
  onDisconnect,
  onReconnect,
}: {
  peerId: string;
  role: string;
  displayState: State;
  committedState: State;
  events: Event[];
  isOnline: boolean;
  isBadActor: boolean;
  isCheater: boolean;
  player: 'X' | 'O' | null;
  actions?: PeerAction[];
  onCellClick?: ((cell: number) => void) | undefined;
  onDisconnect: () => void;
  onReconnect: () => void;
}) {
  const { isReadonly, hasOptimistic, turnHint } = derivePanelState(
    displayState,
    committedState,
    player,
  );

  return (
    <Card elevation={1} sx={{ p: 4, gap: 3, flex: 1 }}>
      <PeerPanelHeader
        role={role}
        isOnline={isOnline}
        isBadActor={isBadActor}
        isCheater={isCheater}
        onDisconnect={onDisconnect}
        onReconnect={onReconnect}
      />

      <TicTacToeBoard
        state={displayState}
        onCellClick={onCellClick}
        readonly={isReadonly}
      />
      <Text variant="caption" label={turnHint} />

      <PeerPanelLegend hasOptimistic={hasOptimistic} />

      <PeerPanelActions actions={actions} />

      <Text variant="caption" label={peerId} />

      <StateInspector
        committedState={committedState}
        displayState={displayState}
      />

      <PeerPanelEvents events={events} />
    </Card>
  );
}
