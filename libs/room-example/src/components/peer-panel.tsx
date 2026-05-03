import type { Event, State } from '@gamezilla/room/types';
import type { LocalizedString } from '@gamezilla/lib/i18n';
import { Card, Text } from '@gamezilla/lib/ui';
import { useLingui } from '@lingui/react/macro';
import { StateInspector } from './state-inspector';
import { TicTacToeBoard } from './tic-tac-toe-board';
import { PeerPanelHeader } from './peer-panel-header';
import { PeerPanelLegend } from './peer-panel-legend';
import { PeerPanelActions, type PeerAction } from './peer-panel-actions';
import { PeerPanelEvents } from './peer-panel-events';

export type { PeerAction } from './peer-panel-actions';

type LinguiT = ReturnType<typeof useLingui>['t'];

function derivePanelState(
  displayState: State,
  committedState: State,
  player: 'X' | 'O' | null,
  t: LinguiT
): { isReadonly: boolean; hasOptimistic: boolean; turnHint: LocalizedString } {
  const currentTurn = displayState['currentTurn'];
  const status = displayState['status'];
  const gameCompleted = status === 'completed';
  const isPlayerTurn =
    (player === 'X' || player === 'O') && currentTurn === player;
  const opponentLabel =
    currentTurn === 'X' || currentTurn === 'O' ? currentTurn : t`opponent`;

  return {
    isReadonly: player === null || !isPlayerTurn || gameCompleted,
    hasOptimistic:
      JSON.stringify(displayState) !== JSON.stringify(committedState),
    turnHint:
      player === null
        ? t`Authority/relay node`
        : gameCompleted
          ? t`Game completed`
          : isPlayerTurn
            ? t`Your turn`
            : t`Waiting for ${opponentLabel}`,
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
  const { t } = useLingui();
  const { isReadonly, hasOptimistic, turnHint } = derivePanelState(
    displayState,
    committedState,
    player,
    t
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
