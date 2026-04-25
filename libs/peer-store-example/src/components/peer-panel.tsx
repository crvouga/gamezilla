import type { Event, State } from '@gamezilla/peer-store/types';
import { Card, Text } from '@gamezilla/lib/ui';
import { StateInspector } from './state-inspector';
import { TicTacToeBoard } from './tic-tac-toe-board';
import { PeerPanelHeader } from './peer-panel-header';
import { PeerPanelLegend } from './peer-panel-legend';
import { PeerPanelActions, type PeerAction } from './peer-panel-actions';
import { PeerPanelEvents } from './peer-panel-events';

export type { PeerAction } from './peer-panel-actions';

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
  const isReadonly = player === null;
  const hasOptimistic =
    JSON.stringify(displayState) !== JSON.stringify(committedState);

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
