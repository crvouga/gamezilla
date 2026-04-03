import {
  Box,
  Button,
  Collapsible,
  ScrollView,
  Stack,
  Text,
} from '@gamezilla/shared/ui';
import { useCallback, useMemo, useRef, useSyncExternalStore } from 'react';
import { useWindowDimensions } from 'react-native';
import { PeerPanel, type PeerAction } from '../components/peer-panel';
import { SimulatorLog } from '../components/simulator-log';
import {
  PEERS,
  PlaygroundSimulator,
  type PeerId,
} from '../simulator/playground';

const PANEL_MIN_WIDTH = 280;

function peerRole(peerId: PeerId): string {
  switch (peerId) {
    case 'player-x':
      return 'Player X';
    case 'player-o':
      return 'Player O';
    case 'server':
      return 'Server';
    case 'observer':
      return 'Observer';
  }
}

function peerPlayer(peerId: PeerId): 'X' | 'O' | null {
  if (peerId === 'player-x') return 'X';
  if (peerId === 'player-o') return 'O';
  return null;
}

export function PlaygroundPage() {
  const simRef = useRef<PlaygroundSimulator | null>(null);
  if (!simRef.current) {
    simRef.current = new PlaygroundSimulator();
  }
  const sim = simRef.current;

  const versionRef = useRef(0);
  const tick = useSyncExternalStore(
    useCallback(
      (cb) =>
        sim.subscribe(() => {
          versionRef.current += 1;
          cb();
        }),
      [sim]
    ),
    useCallback(() => versionRef.current, [])
  );
  void tick;

  const disconnectedPeers = useRef(new Set<string>());
  const isPaused = useRef(false);

  // ─── Per-peer handlers ────────────────────────────────────────

  const handleDispatch = useCallback(
    (peerId: PeerId, cell: number) => {
      const player = peerId === 'player-x' ? 'X' : 'O';
      try {
        sim.dispatchWithSpoof(peerId, {
          type: 'PLACE_MARK',
          payload: { cell, player },
        });
      } catch {
        /* error logged via onError callback */
      }
    },
    [sim]
  );

  const handleDisconnect = useCallback(
    (peerId: string) => {
      try {
        sim.disconnectPeer(peerId as PeerId);
        disconnectedPeers.current.add(peerId);
      } catch {
        /* already disconnected */
      }
    },
    [sim]
  );

  const handleReconnect = useCallback(
    (peerId: string) => {
      try {
        sim.reconnectPeer(peerId as PeerId);
        disconnectedPeers.current.delete(peerId);
      } catch {
        /* not disconnected */
      }
    },
    [sim]
  );

  // ─── Global controls ─────────────────────────────────────────

  const handlePause = useCallback(() => {
    try {
      sim.pauseDelivery();
      isPaused.current = true;
    } catch {
      /* already paused */
    }
  }, [sim]);

  const handleResume = useCallback(() => {
    try {
      sim.resumeDelivery();
      isPaused.current = false;
    } catch {
      /* not paused */
    }
  }, [sim]);

  const handleDrop = useCallback(() => {
    try {
      sim.dropNextMessage();
    } catch {
      /* no messages */
    }
  }, [sim]);

  const handleAdvance = useCallback(() => {
    try {
      sim.advanceTime(5001);
    } catch {
      /* ignore */
    }
  }, [sim]);

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
      sim.disconnectPeer('server');
      disconnectedPeers.current.add('server');
      sim.dispatch('player-x', {
        type: 'PLACE_MARK',
        payload: { cell: 0, player: 'X' },
      });
      try {
        sim.advanceTime(5001);
      } catch {
        /* ignore */
      }
    }, 50);
  }, [sim, handleReset]);

  // ─── Wire-level cheat handlers ───────────────────────────────

  const handleCheatFabricate = useCallback(() => {
    try {
      sim.cheatFabricateCommit();
    } catch {
      /* logged */
    }
  }, [sim]);

  const handleCheatReplay = useCallback(() => {
    try {
      sim.cheatReplay();
    } catch {
      /* logged */
    }
  }, [sim]);

  const handleCheatTamper = useCallback(() => {
    try {
      sim.cheatTamperEvents();
    } catch {
      /* logged */
    }
  }, [sim]);

  const handleCheatClearTamper = useCallback(() => {
    try {
      sim.cheatClearInterceptor();
    } catch {
      /* logged */
    }
  }, [sim]);

  // ─── Per-peer action builders ─────────────────────────────────

  const peerActions = useMemo((): Record<PeerId, PeerAction[]> => {
    const spoofAction = (peerId: PeerId): PeerAction => {
      const other = peerId === 'player-x' ? 'O' : 'X';
      return {
        label: sim.isSpoofing(peerId) ? `Spoofing ${other}` : `Spoof as ${other}`,
        color: 'destructive',
        active: sim.isSpoofing(peerId),
        onPress: () => sim.toggleSpoof(peerId),
      };
    };

    return {
      'player-x': [
        {
          label: 'Flood',
          color: 'destructive',
          onPress: () => {
            try { sim.cheatFlood('player-x'); } catch { /* logged */ }
          },
        },
        spoofAction('player-x'),
      ],
      'player-o': [
        {
          label: 'Flood',
          color: 'destructive',
          onPress: () => {
            try { sim.cheatFlood('player-o'); } catch { /* logged */ }
          },
        },
        spoofAction('player-o'),
      ],
      server: [],
      observer: [],
    };
  }, [sim, tick]);

  // ─── Derived state ───────────────────────────────────────────

  const badActorIds = useMemo(() => {
    return new Set(sim.getBadActorLog().map((e) => e.peerId));
  }, [tick, sim]);

  const log = sim.getLog();
  const cheaterIds = useMemo(() => {
    const ids = new Set<string>();
    for (const entry of log) {
      if (entry.kind === 'cheat' && !entry.detected && entry.peerId && entry.peerId !== 'wire') {
        ids.add(entry.peerId);
      }
    }
    return ids;
  }, [log]);

  const handleCopyLog = useCallback(() => {
    const text = sim.formatLogForClipboard();
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text).catch(() => {});
    }
  }, [sim, tick]);

  const { width } = useWindowDimensions();
  const columns = Math.max(1, Math.floor(width / PANEL_MIN_WIDTH));
  const panelWidth =
    columns > 1 ? (width - 32 - (columns - 1) * 12) / columns : undefined;

  return (
    <ScrollView sx={{ flex: 1, px: 4, py: 3 }}>
      <Stack spacing={4} sx={{ pb: 8 }}>
        <Stack spacing={2}>
          <Text variant="heading">peer-store playground</Text>

          <Text variant="label">Network Controls</Text>
          <Stack direction="horizontal" spacing={2} wrap>
            <Button
              title={isPaused.current ? 'Resume' : 'Pause'}
              variant="outlined"
              size="sm"
              onPress={isPaused.current ? handleResume : handlePause}
            />
            <Button
              title="Drop next"
              variant="outlined"
              size="sm"
              onPress={handleDrop}
            />
            <Button
              title="Advance 5s"
              variant="outlined"
              size="sm"
              onPress={handleAdvance}
            />
            <Button
              title="Reset"
              variant="outlined"
              size="sm"
              onPress={handleReset}
            />
            <Button
              title="Partition"
              variant="outlined"
              size="sm"
              onPress={handleScenarioPartition}
            />
            <Button
              title="Timeout"
              variant="outlined"
              size="sm"
              onPress={handleScenarioTimeout}
            />
          </Stack>

          <Text variant="label">Wire Attacks (MITM)</Text>
          <Stack direction="horizontal" spacing={2} wrap>
            <Button
              title="Fabricate Commit"
              variant="outlined"
              size="sm"
              color="destructive"
              onPress={handleCheatFabricate}
            />
            <Button
              title="Replay Events"
              variant="outlined"
              size="sm"
              color="destructive"
              onPress={handleCheatReplay}
            />
            <Button
              title="Tamper Events"
              variant="outlined"
              size="sm"
              color="destructive"
              onPress={handleCheatTamper}
            />
            <Button
              title="Clear Tamper"
              variant="outlined"
              size="sm"
              onPress={handleCheatClearTamper}
            />
          </Stack>
        </Stack>

        <Stack direction="horizontal" spacing={3} wrap justify="center" align="stretch">
          {PEERS.map((peerId) => {
            const player = peerPlayer(peerId);
            return (
              <Box
                key={peerId}
                style={panelWidth ? { width: panelWidth } : undefined}
              >
                <PeerPanel
                  peerId={peerId}
                  role={peerRole(peerId)}
                  displayState={sim.getState(peerId)}
                  committedState={sim.getCommittedState(peerId)}
                  events={sim.getEventLog(peerId)}
                  isOnline={!disconnectedPeers.current.has(peerId)}
                  isBadActor={badActorIds.has(peerId)}
                  isCheater={cheaterIds.has(peerId)}
                  player={player}
                  actions={peerActions[peerId]}
                  onCellClick={
                    player ? (cell) => handleDispatch(peerId, cell) : undefined
                  }
                  onDisconnect={() => handleDisconnect(peerId)}
                  onReconnect={() => handleReconnect(peerId)}
                />
              </Box>
            );
          })}
        </Stack>

        <Collapsible title={`Log (${log.length})`} defaultOpen>
          <SimulatorLog entries={log} onCopy={handleCopyLog} />
        </Collapsible>
      </Stack>
    </ScrollView>
  );
}
