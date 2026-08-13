import type {
  RunSummary,
  SimulationReportData,
  SimulationReportEvent,
  SimulationReportTopology,
  SuiteTestSummary,
} from '../types';
import type { BucketInfo } from './api-client';
import { EventStrip, type EventStripFilter } from './event-strip';
import type { FlatFrame } from './frames';
import { NodeWorkspace } from './node-workspace';
import { PlayerBottomStrip } from './player-bottom-strip';
import { PlayerChrome } from './player-chrome';
import type { ReportNavState } from './router';
import type { PlayerActions } from './test-player-hooks';
import { useTestPlayerModel } from './test-player-model';
import { styles } from './theme';

export function TestPlayer(props: {
  readonly data: SimulationReportData;
  readonly nav: ReportNavState;
  readonly bucketId: string;
  readonly runId: string;
  readonly buckets: readonly BucketInfo[];
  readonly runs: readonly RunSummary[];
  readonly tests: readonly SuiteTestSummary[];
  readonly onNav: (nav: ReportNavState) => void;
}) {
  const model = useTestPlayerModel(props);
  return (
    <PlayerShell
      data={props.data}
      testId={model.testId}
      bucketId={props.bucketId}
      runId={props.runId}
      buckets={props.buckets}
      runs={props.runs}
      tests={props.tests}
      frames={model.frames}
      nav={props.nav}
      actions={model.actions}
      selectedFrameIdx={model.selectedFrameIdx}
      hoverFrameIdx={model.hoverFrameIdx}
      playheadIdx={model.playheadIdx}
      previewIdx={model.previewIdx}
      previewFrame={model.previewFrame}
      prevFrame={model.prevFrame}
      holdRemainingMs={model.holdRemainingMs}
      nodeId={model.nodeId}
      topology={model.topology}
      events={model.events}
      eventFilter={model.eventFilter}
      selectedEventId={model.selectedEventId}
      registerCopyAction={model.registerCopyAction}
      onNav={props.onNav}
      onHover={model.onHover}
      onSelectNode={model.selectNode}
      onSelectAttr={model.selectAttr}
      onEventFilter={model.setEventFilter}
      onSelectEvent={model.selectEvent}
    />
  );
}

function PlayerShell(props: {
  readonly data: SimulationReportData;
  readonly testId: string;
  readonly bucketId: string;
  readonly runId: string;
  readonly buckets: readonly BucketInfo[];
  readonly runs: readonly RunSummary[];
  readonly tests: readonly SuiteTestSummary[];
  readonly frames: readonly FlatFrame[];
  readonly nav: ReportNavState;
  readonly actions: PlayerActions;
  readonly selectedFrameIdx: number | null;
  readonly hoverFrameIdx: number | null;
  readonly playheadIdx: number;
  readonly previewIdx: number;
  readonly previewFrame: FlatFrame | null;
  readonly prevFrame: FlatFrame | null;
  readonly holdRemainingMs: number | null;
  readonly nodeId: string | null;
  readonly topology: SimulationReportTopology | null;
  readonly events: readonly SimulationReportEvent[];
  readonly eventFilter: EventStripFilter;
  readonly selectedEventId: string | null;
  readonly registerCopyAction: (run: () => void) => void;
  readonly onNav: (nav: ReportNavState) => void;
  readonly onHover: (idx: number | null) => void;
  readonly onSelectNode: (nodeId: string | null) => void;
  readonly onSelectAttr: (attr: string) => void;
  readonly onEventFilter: (filter: EventStripFilter) => void;
  readonly onSelectEvent: (event: SimulationReportEvent) => void;
}) {
  return (
    <div style={styles.appShell}>
      <PlayerChrome
        data={props.data}
        bucketId={props.bucketId}
        runId={props.runId}
        nav={props.nav}
        buckets={props.buckets}
        runs={props.runs}
        tests={props.tests}
        frames={props.frames}
        selectedFrameIdx={props.selectedFrameIdx}
        playheadIdx={props.playheadIdx}
        previewIdx={props.previewIdx}
        registerCopyAction={props.registerCopyAction}
        onNav={props.onNav}
      >
        <div style={styles.playerEditorLayout}>
          <NodeWorkspace
            data={props.data}
            bucketId={props.bucketId}
            runId={props.runId}
            testId={props.testId}
            frame={props.previewFrame}
            prevFrame={props.prevFrame}
            nodeId={props.nodeId}
            attr={props.nav.attr}
            topology={props.topology}
            events={props.events}
            onSelectNode={props.onSelectNode}
            onSelectAttr={props.onSelectAttr}
            onSelectEvent={props.onSelectEvent}
          />
          <EventStrip
            events={props.events}
            filter={props.eventFilter}
            onFilter={props.onEventFilter}
            selectedId={props.selectedEventId}
            onSelect={props.onSelectEvent}
          />
          <PlayerBottomStrip
            nav={props.nav}
            frames={props.frames}
            selectedFrameIdx={props.selectedFrameIdx}
            hoverFrameIdx={props.hoverFrameIdx}
            playheadIdx={props.playheadIdx}
            previewIdx={props.previewIdx}
            previewFrame={props.previewFrame}
            holdRemainingMs={props.holdRemainingMs}
            actions={props.actions}
            onHover={props.onHover}
          />
        </div>
      </PlayerChrome>
    </div>
  );
}
