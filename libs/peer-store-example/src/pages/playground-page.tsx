import {
  Collapsible,
  ScrollView,
  Stack,
  useTheme,
} from '@gamezilla/lib/ui';
import { useCallback } from 'react';
import { SimulatorLog } from '../components/simulator-log';
import { NetworkControlsSection } from './network-controls-section';
import { PeerGrid } from './peer-grid';
import { useCheatHandlers } from './use-cheat-handlers';
import { useDerivedState } from './use-derived-state';
import { useNetworkControls } from './use-network-controls';
import { usePeerActions } from './use-peer-actions';
import { usePeerHandlers } from './use-peer-handlers';
import { usePlaygroundSim } from './use-playground-sim';

const PANEL_MIN_WIDTH = 280;

function computePanelWidth(width: number): number | undefined {
  const columns = Math.max(1, Math.floor(width / PANEL_MIN_WIDTH));
  if (columns <= 1) return undefined;
  return (width - 32 - (columns - 1) * 12) / columns;
}

export function PlaygroundPage() {
  const { layout } = useTheme();
  const { sim, tick } = usePlaygroundSim();
  const peerHandlers = usePeerHandlers(sim);
  const network = useNetworkControls(sim, peerHandlers.disconnectedPeers);
  const cheats = useCheatHandlers(sim);
  const peerActions = usePeerActions(sim, tick);
  const { log, badActorIds, cheaterIds } = useDerivedState(sim, tick);

  const handleCopyLog = useCallback(() => {
    const text = sim.formatLogForClipboard();
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(text).catch(() => {});
    }
  }, [sim, tick]);

  const panelWidth = computePanelWidth(layout.width);

  return (
    <ScrollView sx={{ flex: 1, px: 4, py: 3 }}>
      <Stack spacing={4} sx={{ pb: 8 }}>
        <NetworkControlsSection network={network} cheats={cheats} />

        <PeerGrid
          sim={sim}
          handlers={peerHandlers}
          peerActions={peerActions}
          badActorIds={badActorIds}
          cheaterIds={cheaterIds}
          panelWidth={panelWidth}
        />

        <Collapsible title={`Log (${log.length})`} defaultOpen>
          <SimulatorLog entries={log} onCopy={handleCopyLog} />
        </Collapsible>
      </Stack>
    </ScrollView>
  );
}
