import type { LabEdgeState } from '../api';

function TrafficToggle(props: {
  readonly label: string;
  readonly kind: 'live' | 'sync';
  readonly cut: boolean;
  readonly busy: boolean;
  readonly clientId: 'alice' | 'bob';
  readonly onCommand: (cmd: Record<string, unknown>) => void;
}) {
  const className =
    props.kind === 'live'
      ? `live${props.cut ? ' active danger' : ''}`
      : `sync${props.cut ? ' active danger' : ''}`;
  return (
    <button
      type="button"
      className={className}
      disabled={props.busy}
      onClick={() =>
        props.onCommand(
          props.cut
            ? {
                type: 'unpartition',
                clientId: props.clientId,
                traffic: props.kind,
              }
            : {
                type: 'partition',
                clientId: props.clientId,
                traffic: props.kind,
              }
        )
      }
    >
      {props.label} {props.cut ? 'cut' : 'ok'}
    </button>
  );
}

function HoldToggle(props: {
  readonly label: string;
  readonly traffic: 'live' | 'sync';
  readonly held: boolean;
  readonly busy: boolean;
  readonly clientId: 'alice' | 'bob';
  readonly onCommand: (cmd: Record<string, unknown>) => void;
}) {
  return (
    <button
      type="button"
      className={props.held ? 'active' : ''}
      disabled={props.busy}
      onClick={() =>
        props.onCommand({
          type: props.held ? 'release' : 'hold',
          clientId: props.clientId,
          traffic: props.traffic,
        })
      }
    >
      {props.label}
    </button>
  );
}

function FaultSliders(props: {
  readonly edge: LabEdgeState;
  readonly busy: boolean;
  readonly clientId: 'alice' | 'bob';
  readonly onCommand: (cmd: Record<string, unknown>) => void;
}) {
  return (
    <>
      <label className="fault-field">
        Loss
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(props.edge.faults.packetLossProbability * 100)}
          disabled={props.busy}
          onChange={(e) =>
            props.onCommand({
              type: 'setFaults',
              clientId: props.clientId,
              traffic: 'all',
              faults: {
                packetLossProbability: Number(e.target.value) / 100,
              },
            })
          }
        />
      </label>
      <label className="fault-field">
        Delay ms
        <input
          type="range"
          min={0}
          max={200}
          value={props.edge.faults.oneWayDelayMeanMs}
          disabled={props.busy}
          onChange={(e) =>
            props.onCommand({
              type: 'setFaults',
              clientId: props.clientId,
              traffic: 'all',
              faults: { oneWayDelayMeanMs: Number(e.target.value) },
            })
          }
        />
      </label>
      <button
        type="button"
        disabled={props.busy}
        onClick={() =>
          props.onCommand({ type: 'clearFaults', clientId: props.clientId })
        }
      >
        Clear faults
      </button>
    </>
  );
}

export function EdgeControls(props: {
  readonly clientId: 'alice' | 'bob';
  readonly edge: LabEdgeState;
  readonly busy: boolean;
  readonly onCommand: (cmd: Record<string, unknown>) => void;
}) {
  const { clientId, edge } = props;
  const broken = edge.livePartitioned || edge.syncPartitioned;
  return (
    <div className="edge">
      <div className={`edge-line${broken ? ' broken' : ''}`} />
      <div className="edge-panel">
        <div className="edge-label">{clientId} ↔ server</div>
        <div className="edge-row">
          <TrafficToggle
            label="Live"
            kind="live"
            cut={edge.livePartitioned}
            busy={props.busy}
            clientId={clientId}
            onCommand={props.onCommand}
          />
          <TrafficToggle
            label="Sync"
            kind="sync"
            cut={edge.syncPartitioned}
            busy={props.busy}
            clientId={clientId}
            onCommand={props.onCommand}
          />
        </div>
        <div className="edge-row">
          <HoldToggle
            label="Hold live"
            traffic="live"
            held={edge.liveHeld}
            busy={props.busy}
            clientId={clientId}
            onCommand={props.onCommand}
          />
          <HoldToggle
            label="Hold sync"
            traffic="sync"
            held={edge.syncHeld}
            busy={props.busy}
            clientId={clientId}
            onCommand={props.onCommand}
          />
        </div>
        <FaultSliders
          edge={edge}
          busy={props.busy}
          clientId={clientId}
          onCommand={props.onCommand}
        />
      </div>
      <div className={`edge-line${broken ? ' broken' : ''}`} />
    </div>
  );
}
