import { Box, EmptyState, ErrorState, LoadingState, Text } from '@pkgs/ui';
import type { ReactNode } from 'react';
import { useSyncExternalStore } from 'react';
import type { DebuggerViewId } from '../shared/debugger-views';
import type { PlaygroundSession, SimConsolePorts } from '../shared/ports';
import type { ReportApiClient } from './api-client';
import { DebuggerColumn, DebuggerColumns } from './debugger/debugger-columns';
import { EventsPane } from './events-pane';
import type { FlatFrame } from './frames';
import type { TopologyNodeInfo } from './node-views';
import {
  ClientPlaygroundPanel,
  ServerPlaygroundPanel,
} from './playground/playground-panel';
import { SqlitePane } from './sqlite-pane';
import { emptySx, paneSx } from './tokens';
import type { ReportReplay } from './use-report-replay';

export function ReportKindPane(props: {
  readonly ports: SimConsolePorts;
  readonly replay: ReportReplay;
  readonly kind: 'client' | 'server' | 'events' | 'room';
  readonly view: DebuggerViewId;
  readonly instances: readonly TopologyNodeInfo[];
  readonly selected: TopologyNodeInfo | null;
  readonly nodeId: string | null;
  readonly api: ReportApiClient;
  readonly bucketId: string;
  readonly runId: string;
  readonly testId: string;
  readonly frame: FlatFrame | null;
}): ReactNode {
  if (props.kind === 'client') {
    return <ReportClientPane {...props} />;
  }
  if (props.view === 'events') {
    return (
      <EventsPane
        api={props.api}
        bucketId={props.bucketId}
        runId={props.runId}
        testId={props.testId}
        frame={props.frame}
        nodeId={props.nodeId}
      />
    );
  }
  if (props.kind === 'server' && props.view === 'db') {
    return <ReportApiDbPane {...props} />;
  }
  return (
    <SqlitePane
      bucketId={props.bucketId}
      runId={props.runId}
      testId={props.testId}
      frame={props.frame}
      nodeId={props.nodeId}
    />
  );
}

function ReportClientPane(props: {
  readonly ports: SimConsolePorts;
  readonly replay: ReportReplay;
  readonly view: DebuggerViewId;
  readonly instances: readonly TopologyNodeInfo[];
  readonly api: ReportApiClient;
  readonly bucketId: string;
  readonly runId: string;
  readonly testId: string;
  readonly frame: FlatFrame | null;
}): ReactNode {
  if (props.view === 'events') {
    return (
      <DebuggerColumns>
        {props.instances.map((node) => (
          <DebuggerColumn key={node.id} id={node.id} kind={node.kind}>
            <EventsPane
              api={props.api}
              bucketId={props.bucketId}
              runId={props.runId}
              testId={props.testId}
              frame={props.frame}
              nodeId={node.id}
            />
          </DebuggerColumn>
        ))}
      </DebuggerColumns>
    );
  }
  const gate = replayGate(props.replay, true);
  if (gate !== null) return gate;
  const session = props.replay.session;
  if (session == null) {
    return (
      <Box sx={paneSx}>
        <Text sx={emptySx}>Replay session is not ready.</Text>
      </Box>
    );
  }
  return (
    <LiveClientColumns
      ports={props.ports}
      session={session}
      view={props.view}
    />
  );
}

function ReportApiDbPane(props: {
  readonly replay: ReportReplay;
  readonly bucketId: string;
  readonly runId: string;
  readonly testId: string;
  readonly frame: FlatFrame | null;
  readonly nodeId: string | null;
}): ReactNode {
  const gate = replayGate(props.replay, false);
  if (gate !== null) return gate;
  const session = props.replay.session;
  if (session == null) {
    return (
      <SqlitePane
        bucketId={props.bucketId}
        runId={props.runId}
        testId={props.testId}
        frame={props.frame}
        nodeId={props.nodeId}
      />
    );
  }
  return (
    <ServerPlaygroundPanel session={session} node={session.server} view="db" />
  );
}

function LiveClientColumns(props: {
  readonly ports: SimConsolePorts;
  readonly session: PlaygroundSession;
  readonly view: string;
}): ReactNode {
  const session = props.session;
  const tick = useSyncExternalStore(
    session.subscribe,
    () => session.revision,
    () => session.revision
  );
  void tick;
  const clients = [...session.clients.values()];
  if (clients.length === 0) {
    return (
      <Box sx={paneSx}>
        <Text sx={emptySx}>No clients in this checkpoint.</Text>
      </Box>
    );
  }
  return (
    <DebuggerColumns>
      {clients.map((actor) => (
        <DebuggerColumn key={actor.id} id={actor.id} kind="client">
          <ClientPlaygroundPanel
            actor={actor}
            snapshotEpoch={props.session.snapshotEpoch}
            reloadToken={props.session.revision}
            view={props.view}
          />
        </DebuggerColumn>
      ))}
    </DebuggerColumns>
  );
}

function replayGate(
  replay: ReportReplay,
  requireReady: boolean
): ReactNode | null {
  if (replay.status === 'booting' || replay.status === 'hydrating') {
    return (
      <Box sx={paneSx}>
        <LoadingState caption="Hydrating checkpoint…" />
      </Box>
    );
  }
  if (replay.status === 'error') {
    return (
      <Box sx={paneSx}>
        <ErrorState title="Failed to hydrate frame" body={replay.error ?? ''} />
      </Box>
    );
  }
  if (replay.status === 'unrestorable') {
    return (
      <Box sx={centerSx}>
        <EmptyState
          variant="compact"
          title="Cannot hydrate this frame"
          body="Postgres / empty sqlite dumps cannot restore into the live playground."
        />
      </Box>
    );
  }
  if (requireReady && replay.session == null) {
    return (
      <Box sx={paneSx}>
        <Text sx={emptySx}>Replay session is not ready.</Text>
      </Box>
    );
  }
  return null;
}

const centerSx = {
  flex: 1,
  alignItems: 'center',
  justifyContent: 'center',
  padding: 4,
} as const;
