import { Box, Text } from '@pkgs/ui';
import { For, type JSX, Match, Switch } from 'solid-js';
import type { DebuggerViewId } from '../shared/debugger-views';
import type { ReportApiClient } from './api-client';
import { DebuggerColumn, DebuggerColumns } from './debugger/debugger-columns';
import { useSimConsoleLayout } from './debugger/use-sim-console-layout';
import { EventsPane } from './events-pane';
import type { FlatFrame } from './frames';
import { resolveFrameForNode } from './frames';
import { HtmlPane } from './html-pane';
import { JsonPane } from './json-pane';
import type { TopologyNodeInfo } from './node-views';
import { SqlitePane } from './sqlite-pane';
import { emptySx, paneSx } from './tokens';

export function ReportKindPane(props: {
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
  readonly frames: readonly FlatFrame[];
  readonly selectedIdx: number;
}): JSX.Element {
  return (
    <Switch>
      <Match when={props.kind === 'client'}>
        <ReportClientPane {...props} />
      </Match>
      <Match when={props.view === 'events'}>
        <EventsPane
          api={props.api}
          bucketId={props.bucketId}
          runId={props.runId}
          testId={props.testId}
          frame={props.frame}
          nodeId={props.nodeId}
        />
      </Match>
      <Match when={props.kind === 'server' || props.kind === 'room'}>
        <JsonPane
          api={props.api}
          bucketId={props.bucketId}
          runId={props.runId}
          testId={props.testId}
          frame={props.frame}
          name="topology"
        />
      </Match>
      <Match when={true}>
        <SqlitePane
          bucketId={props.bucketId}
          runId={props.runId}
          testId={props.testId}
          frame={props.frame}
          nodeId={props.nodeId}
        />
      </Match>
    </Switch>
  );
}

function ReportClientPane(props: {
  readonly view: DebuggerViewId;
  readonly instances: readonly TopologyNodeInfo[];
  readonly selected: TopologyNodeInfo | null;
  readonly api: ReportApiClient;
  readonly bucketId: string;
  readonly runId: string;
  readonly testId: string;
  readonly frames: readonly FlatFrame[];
  readonly selectedIdx: number;
}): JSX.Element {
  const layout = useSimConsoleLayout();
  const visibleInstances = () =>
    visibleReportClients(
      props.instances,
      props.selected,
      layout.multiClientColumns
    );
  return (
    <Switch>
      <Match when={props.view === 'events'}>
        <DebuggerColumns>
          <For each={visibleInstances()}>
            {(node) => (
              <DebuggerColumn>
                <EventsPane
                  api={props.api}
                  bucketId={props.bucketId}
                  runId={props.runId}
                  testId={props.testId}
                  frame={resolveFrameForNode(
                    props.frames,
                    props.selectedIdx,
                    node.id
                  )}
                  nodeId={node.id}
                />
              </DebuggerColumn>
            )}
          </For>
        </DebuggerColumns>
      </Match>
      <Match when={props.view === 'db'}>
        <DebuggerColumns>
          <For each={visibleInstances()}>
            {(node) => (
              <DebuggerColumn>
                <SqlitePane
                  bucketId={props.bucketId}
                  runId={props.runId}
                  testId={props.testId}
                  frame={resolveFrameForNode(
                    props.frames,
                    props.selectedIdx,
                    node.id
                  )}
                  nodeId={node.id}
                />
              </DebuggerColumn>
            )}
          </For>
        </DebuggerColumns>
      </Match>
      <Match when={visibleInstances().length === 0}>
        <Box sx={paneSx}>
          <Text sx={emptySx}>No client nodes for this frame.</Text>
        </Box>
      </Match>
      <Match when={true}>
        <DebuggerColumns>
          <For each={visibleInstances()}>
            {(node) => (
              <DebuggerColumn>
                <Box sx={columnSx}>
                  <Text sx={columnLabelSx}>{node.id}</Text>
                  <Box sx={previewSx}>
                    <HtmlPane
                      api={props.api}
                      bucketId={props.bucketId}
                      runId={props.runId}
                      testId={props.testId}
                      frame={resolveFrameForNode(
                        props.frames,
                        props.selectedIdx,
                        node.id
                      )}
                      nodeId={node.id}
                      node={node}
                    />
                  </Box>
                </Box>
              </DebuggerColumn>
            )}
          </For>
        </DebuggerColumns>
      </Match>
    </Switch>
  );
}

function visibleReportClients(
  instances: readonly TopologyNodeInfo[],
  selected: TopologyNodeInfo | null,
  multiClientColumns: boolean
): readonly TopologyNodeInfo[] {
  if (multiClientColumns) return instances;
  if (selected !== null) return [selected];
  const first = instances[0];
  return first !== undefined ? [first] : [];
}

const columnSx = {
  flex: 1,
  flexDirection: 'column',
  minHeight: 0,
  minWidth: 0,
} as const;

const previewSx = {
  flex: 1,
  minHeight: 0,
  minWidth: 0,
} as const;

const columnLabelSx = {
  paddingHorizontal: 10,
  paddingVertical: 6,
  fontSize: 12,
  fontWeight: '600',
  color: 'textSecondary',
  borderBottomWidth: 'hairline',
  borderBottomColor: 'border',
} as const;
