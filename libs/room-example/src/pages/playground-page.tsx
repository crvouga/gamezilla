import { Collapsible, ScrollView, Stack, useTheme } from '@gamezilla/lib/ui';
import { useLingui } from '@lingui/react/macro';
import { useCallback } from 'react';
import { CryptoDiagnosticsSection } from '../components/crypto-diagnostics-section';
import { GameClockSection } from '../components/game-clock-section';
import { SimulatorLog } from '../components/simulator-log';
import { TrustElectionSection } from '../components/trust-election-section';
import { NetworkControlsSection } from './network-controls-section';
import { PeerGrid } from './peer-grid';
import { useCheatHandlers } from './use-cheat-handlers';
import { useDerivedState } from './use-derived-state';
import { useGameClock } from './use-game-clock';
import { useNetworkControls } from './use-network-controls';
import { usePeerActions } from './use-peer-actions';
import { usePeerHandlers } from './use-peer-handlers';
import { usePlaygroundSim } from './use-playground-sim';
import { useTrustElection } from './use-trust-election';

const PANEL_MIN_WIDTH = 280;

function computePanelWidth(width: number): number | undefined {
  const columns = Math.max(1, Math.floor(width / PANEL_MIN_WIDTH));
  if (columns <= 1) return undefined;
  return (width - 32 - (columns - 1) * 12) / columns;
}

export function PlaygroundPage() {
  const { t } = useLingui();
  const { layout } = useTheme();
  const { sim, tick } = usePlaygroundSim();
  const peerHandlers = usePeerHandlers(sim);
  const network = useNetworkControls(sim, peerHandlers.disconnectedPeers);
  const cheats = useCheatHandlers(sim);
  const clock = useGameClock(sim, tick);
  const peerActions = usePeerActions(sim, tick, peerHandlers.disconnectedPeers);
  const trustElection = useTrustElection(sim, tick);
  const { log, badActorIds, cheaterIds } = useDerivedState(sim, tick);

  const handleCopyLog = useCallback(() => {
    void tick;
    const text = sim.formatLogForClipboard();
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text).catch(() => {});
    }
  }, [sim, tick]);

  const panelWidth = computePanelWidth(layout.width);
  const logCount = log.length;

  return (
    <ScrollView sx={{ flex: 1, px: 4, py: 3 }}>
      <Stack spacing={4} sx={{ pb: 8 }}>
        <NetworkControlsSection network={network} cheats={cheats} />
        <GameClockSection clock={clock} />

        <PeerGrid
          sim={sim}
          handlers={peerHandlers}
          peerActions={peerActions}
          badActorIds={badActorIds}
          cheaterIds={cheaterIds}
          panelWidth={panelWidth}
        />

        <TrustElectionSection election={trustElection} />

        <CryptoDiagnosticsSection
          peers={sim.getPeerCryptoSummary()}
          authority={sim.getCurrentAuthorityLabel()}
          wireAuthFailures={sim.getWireAuthFailures()}
        />

        <Collapsible title={t`Log (${logCount})`} defaultOpen>
          <SimulatorLog entries={log} onCopy={handleCopyLog} />
        </Collapsible>
      </Stack>
    </ScrollView>
  );
}
