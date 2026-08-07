import type { LabSnapshot } from '../api';
import { EdgeControls } from './edge-controls';
import { NodeBox } from './node-box';

export function Bench(props: {
  readonly snap: LabSnapshot;
  readonly busy: boolean;
  readonly onCommand: (cmd: Record<string, unknown>) => void;
}) {
  const { snap } = props;
  const emptyEdge = {
    livePartitioned: false,
    syncPartitioned: false,
    liveHeld: false,
    syncHeld: false,
    faults: {
      oneWayDelayMeanMs: 0,
      oneWayDelayJitterMs: 0,
      packetLossProbability: 0,
      packetReplayProbability: 0,
      reorderWindow: 0,
      partitionProbability: 0,
      unpartitionProbability: 0,
    },
  };
  return (
    <div className="bench">
      <NodeBox
        title="Alice"
        subtitle={snap.alice?.actorId ?? 'client'}
        shapes={snap.alice?.shapes ?? []}
        client={snap.alice}
        busy={props.busy}
        onCommand={props.onCommand}
      />
      <EdgeControls
        clientId="alice"
        edge={snap.alice?.edge ?? emptyEdge}
        busy={props.busy}
        onCommand={props.onCommand}
      />
      <NodeBox
        title="Server"
        subtitle="authoritative"
        shapes={snap.serverShapes}
        server
        busy={props.busy}
        onCommand={props.onCommand}
      />
      <EdgeControls
        clientId="bob"
        edge={snap.bob?.edge ?? emptyEdge}
        busy={props.busy}
        onCommand={props.onCommand}
      />
      <NodeBox
        title="Bob"
        subtitle={snap.bob?.actorId ?? 'client'}
        shapes={snap.bob?.shapes ?? []}
        client={snap.bob}
        busy={props.busy}
        onCommand={props.onCommand}
      />
    </div>
  );
}
