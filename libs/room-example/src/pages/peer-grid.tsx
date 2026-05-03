import type { LocalizedString } from '@gamezilla/lib/i18n';
import { Box, Stack } from '@gamezilla/lib/ui';
import { useLingui } from '@lingui/react/macro';
import { PeerPanel } from '../components/peer-panel';
import type { PeerAction } from '../components/peer-panel-actions';
import {
  PEERS,
  type PeerId,
  type PlaygroundSimulator,
} from '../simulator/playground';
import type { PeerHandlers } from './use-peer-handlers';

type LinguiT = ReturnType<typeof useLingui>['t'];

function peerRole(peerId: PeerId, t: LinguiT): LocalizedString {
  switch (peerId) {
    case 'player-x':
      return t`Player X`;
    case 'player-o':
      return t`Player O`;
    case 'server':
      return t`Server`;
  }
}

function peerPlayer(peerId: PeerId): 'X' | 'O' | null {
  if (peerId === 'player-x') return 'X';
  if (peerId === 'player-o') return 'O';
  return null;
}

export function PeerGrid({
  sim,
  handlers,
  peerActions,
  badActorIds,
  cheaterIds,
  panelWidth,
}: {
  sim: PlaygroundSimulator;
  handlers: PeerHandlers;
  peerActions: Record<PeerId, PeerAction[]>;
  badActorIds: Set<string | undefined>;
  cheaterIds: Set<string>;
  panelWidth?: number | undefined;
}) {
  return (
    <Stack
      direction="horizontal"
      spacing={3}
      wrap
      justify="center"
      align="stretch"
    >
      {PEERS.map((peerId) => (
        <PeerGridItem
          key={peerId}
          peerId={peerId}
          sim={sim}
          handlers={handlers}
          actions={peerActions[peerId]}
          isBadActor={badActorIds.has(peerId)}
          isCheater={cheaterIds.has(peerId)}
          panelWidth={panelWidth}
        />
      ))}
    </Stack>
  );
}

function PeerGridItem({
  peerId,
  sim,
  handlers,
  actions,
  isBadActor,
  isCheater,
  panelWidth,
}: {
  peerId: PeerId;
  sim: PlaygroundSimulator;
  handlers: PeerHandlers;
  actions: PeerAction[];
  isBadActor: boolean;
  isCheater: boolean;
  panelWidth?: number | undefined;
}) {
  const { t } = useLingui();
  const player = peerPlayer(peerId);
  const isOnline = !handlers.disconnectedPeers.current.has(peerId);
  return (
    <Box style={panelWidth ? { width: panelWidth } : undefined}>
      <PeerPanel
        peerId={peerId}
        role={peerRole(peerId, t)}
        displayState={sim.getState(peerId)}
        committedState={sim.getCommittedState(peerId)}
        events={sim.getEventLog(peerId)}
        isOnline={isOnline}
        isBadActor={isBadActor}
        isCheater={isCheater}
        player={player}
        actions={actions}
        onCellClick={
          player ? (cell) => handlers.dispatch(peerId, cell) : undefined
        }
        onDisconnect={() => handlers.disconnect(peerId)}
        onReconnect={() => handlers.reconnect(peerId)}
      />
    </Box>
  );
}
