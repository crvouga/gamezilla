import { useCallback, useMemo, useRef, useSyncExternalStore } from 'react';
import { useWindowDimensions } from 'react-native';
import {
  Box,
  Button,
  Collapsible,
  ScrollView,
  Stack,
  Text,
} from '@gamezilla/shared/ui';
import { EventLog } from '../components/event-log';
import { MessageLog } from '../components/message-log';
import { PeerPanel } from '../components/peer-panel';
import {
  PEERS,
  PlaygroundSimulator,
  type PeerId,
} from '../simulator/playground';

const PANEL_MIN_WIDTH = 280;

export function PlaygroundPage() {
  const simRef = useRef<PlaygroundSimulator | null>(null);
  if (!simRef.current) {
    simRef.current = new PlaygroundSimulator();
  }
  const sim = simRef.current;

  const versionRef = useRef(0);
  const tick = useSyncExternalStore(
    useCallback((cb) => sim.subscribe(() => {
      versionRef.current += 1;
      cb();
    }), [sim]),
    useCallback(() => versionRef.current, []),
  );
  void tick;

  const disconnectedPeers = useRef(new Set<string>());
  const isPaused = useRef(false);

  const handleDispatch = useCallback(
    (peerId: PeerId, cell: number) => {
      const player = peerId === 'player-x' ? 'X' : 'O';
      try {
        sim.dispatch(peerId, {
          type: 'PLACE_MARK',
          payload: { cell, player },
        });
      } catch {
        /* error logged via onError callback */
      }
    },
    [sim],
  );

  const handlePause = useCallback(() => {
    try {
      sim.pauseDelivery();
      isPaused.current = true;
    } catch { /* already paused */ }
  }, [sim]);

  const handleResume = useCallback(() => {
    try {
      sim.resumeDelivery();
      isPaused.current = false;
    } catch { /* not paused */ }
  }, [sim]);

  const handleDrop = useCallback(() => {
    try { sim.dropNextMessage(); } catch { /* no messages */ }
  }, [sim]);

  const handleAdvance = useCallback(() => {
    try { sim.advanceTime(5001); } catch { /* ignore */ }
  }, [sim]);

  const handleDisconnect = useCallback(
    (peerId: string) => {
      try {
        sim.disconnectPeer(peerId as PeerId);
        disconnectedPeers.current.add(peerId);
      } catch { /* already disconnected */ }
    },
    [sim],
  );

  const handleReconnect = useCallback(
    (peerId: string) => {
      try {
        sim.reconnectPeer(peerId as PeerId);
        disconnectedPeers.current.delete(peerId);
      } catch { /* not disconnected */ }
    },
    [sim],
  );

  const handleReset = useCallback(() => {
    sim.reset();
    disconnectedPeers.current.clear();
    isPaused.current = false;
  }, [sim]);

  const handleScenarioPartition = useCallback(() => {
    handleReset();
    setTimeout(() => {
      sim.disconnectPeer('player-o');
      disconnectedPeers.current.add('player-o');
      sim.dispatch('player-x', {
        type: 'PLACE_MARK',
        payload: { cell: 4, player: 'X' },
      });
    }, 50);
  }, [sim, handleReset]);

  const handleScenarioTimeout = useCallback(() => {
    handleReset();
    setTimeout(() => {
      sim.disconnectPeer('player-o');
      sim.disconnectPeer('worker');
      disconnectedPeers.current.add('player-o');
      disconnectedPeers.current.add('worker');
      sim.dispatch('player-x', {
        type: 'PLACE_MARK',
        payload: { cell: 0, player: 'X' },
      });
      try { sim.advanceTime(5001); } catch { /* ignore */ }
    }, 50);
  }, [sim, handleReset]);

  const badActorIds = useMemo(() => {
    return new Set(sim.getBadActorLog().map((e) => e.peerId));
  }, [tick, sim]);

  const messageLog = sim.getMessageLog();
  const eventLog = sim.getEventLog('player-x');

  const { width } = useWindowDimensions();
  const columns = Math.max(1, Math.floor(width / PANEL_MIN_WIDTH));
  const panelWidth = columns > 1
    ? (width - 32 - (columns - 1) * 12) / columns
    : undefined;

  return (
    <ScrollView sx={{ flex: 1, px: 4, py: 3 }}>
      <Stack spacing={4} sx={{ pb: 8 }}>
        <Stack spacing={2}>
          <Text variant="heading">peer-store playground</Text>
          <Stack direction="horizontal" spacing={2} wrap>
            <Button
              title={isPaused.current ? 'Resume' : 'Pause'}
              variant="outlined"
              size="sm"
              onPress={isPaused.current ? handleResume : handlePause}
            />
            <Button title="Drop next" variant="outlined" size="sm" onPress={handleDrop} />
            <Button title="Advance 5s" variant="outlined" size="sm" onPress={handleAdvance} />
            <Button title="Reset" variant="outlined" size="sm" onPress={handleReset} />
            <Button title="Partition" variant="outlined" size="sm" onPress={handleScenarioPartition} />
            <Button title="Timeout" variant="outlined" size="sm" onPress={handleScenarioTimeout} />
          </Stack>
        </Stack>

        <Stack direction="horizontal" spacing={3} wrap justify="center">
          {PEERS.map((peerId) => {
            const player =
              peerId === 'player-x'
                ? ('X' as const)
                : peerId === 'player-o'
                  ? ('O' as const)
                  : null;
            return (
              <Box
                key={peerId}
                style={panelWidth ? { width: panelWidth } : undefined}
              >
                <PeerPanel
                  displayState={sim.getState(peerId)}
                  committedState={sim.getCommittedState(peerId)}
                  events={sim.getEventLog(peerId)}
                  isOnline={!disconnectedPeers.current.has(peerId)}
                  isBadActor={badActorIds.has(peerId)}
                  player={player}
                  onCellClick={
                    player
                      ? (cell) => handleDispatch(peerId, cell)
                      : undefined
                  }
                  onDisconnect={() => handleDisconnect(peerId)}
                  onReconnect={() => handleReconnect(peerId)}
                />
              </Box>
            );
          })}
        </Stack>

        <Collapsible title={`Message Log (${messageLog.length})`}>
          <MessageLog entries={messageLog} />
        </Collapsible>

        <Collapsible title={`Committed Events (${eventLog.length})`}>
          <EventLog events={eventLog} />
        </Collapsible>
      </Stack>
    </ScrollView>
  );
}
