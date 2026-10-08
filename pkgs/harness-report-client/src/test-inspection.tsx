import { useLingui } from '@lingui/solid/macro';
import { fmtMs } from '@pkgs/harness-report-shared/format';
import {
  type FlatFrame,
  isUi,
  neighborFailure,
  selectedNode,
} from '@pkgs/harness-report-shared/frames';
import { showAside, viewMode } from '@pkgs/harness-report-shared/hash';
import type { HtmlReportTest } from '@pkgs/harness-root-shared/bundle';
import { InspectionWorkspace } from '@pkgs/ui-root-client/inspection-workspace';
import { createMemo } from 'solid-js';
import { FailBanner } from './fail-banner';
import { FrameCaption } from './frame-caption';
import { PerformancePanel } from './performance-panel';
import { PhoneStage } from './phone-stage';
import { ReportStatus } from './report-status';
import { ScenarioScript } from './scenario-script';
import { Scrubber } from './scrubber';
import { SnapshotsAside } from './snapshots-aside';
import { StepTree } from './step-tree';
import { Toolbar } from './toolbar';
import type { ReportNav } from './use-report-nav';

type InspectionProps = {
  readonly test: HtmlReportTest;
  readonly frames: FlatFrame[];
  readonly selected: FlatFrame | null;
  readonly nav: ReportNav;
};

export function TestInspection(props: InspectionProps) {
  const { t } = useLingui();
  const blobs = createMemo(
    () => props.selected?.frame.snapshots.filter((blob) => !isUi(blob)) ?? []
  );
  const timeline = <TestTimeline {...props} />;
  const state = <SnapshotsAside test={props.test} blobs={blobs()} />;
  const tools = () => [
    { key: 'timeline', label: t`Timeline`, content: timeline },
    ...(showAside(props.nav.route()) && blobs().length > 0
      ? [{ key: 'state', label: t`State`, content: state }]
      : []),
  ];
  return (
    <InspectionWorkspace
      primaryLabel={t`Replay`}
      toolsLabel={t`Inspect test`}
      selected={props.nav.route().params['inspect'] ?? 'primary'}
      onSelect={(key) =>
        props.nav.setParam('inspect', key === 'primary' ? '' : key)
      }
      tools={tools()}
      primary={<TestReplay {...props} hasData={blobs().length > 0} />}
    />
  );
}

function TestTimeline(props: InspectionProps) {
  const meta = () => props.test.report.meta;
  const { t } = useLingui();
  return (
    <div class="box gap-3 min-w-0">
      <h2 class="text textSubtitle">{meta().title}</h2>
      <ReportStatus status={meta().status} />
      <p class="text textCaption break-words">{`${meta().sourceFile ?? ''}${meta().sourceLine ? `:${meta().sourceLine}` : ''}`}</p>
      <p class="text textCaption break-words">{`${meta().system} · ${meta().runtime} · ${fmtMs(meta().durationMs)}`}</p>
      <p class="text textCaption break-words">{t`Seed ${meta().seed}`}</p>
      <ScenarioScript
        steps={props.test.report.steps}
        frames={props.frames}
        selected={props.selected}
        onSelect={(frame) => props.nav.goFrame(frame)}
      />
      <StepTree
        test={props.test}
        frames={props.frames}
        selected={props.selected}
        onSelect={(frame) => props.nav.goFrame(frame)}
      />
      <PerformancePanel
        report={props.test.report}
        frames={props.frames}
        onSelect={(frame) => props.nav.goFrame(frame)}
      />
    </div>
  );
}

function TestReplay(props: InspectionProps & { readonly hasData: boolean }) {
  const failure = createMemo(() => neighborFailure(props.frames, -1, 1));
  const meta = () => props.test.report.meta;
  return (
    <div class="box flex-1 min-h-0 min-w-0 overflow-hidden bg-surface rounded-card border border-border">
      <FailBanner
        error={meta().error}
        errorStack={meta().errorStack}
        failure={failure()}
        onJump={(frame) => props.nav.goFrame(frame)}
      />
      <Toolbar
        nav={props.nav}
        ui={props.frames.length > 0}
        hasData={props.hasData}
      />
      <FrameCaption
        test={props.test}
        frames={props.frames}
        selected={props.selected}
      />
      <div class="box flex-1 min-h-0 min-w-0">
        <PhoneStage
          test={props.test}
          selected={props.selected}
          nav={props.nav}
          mode={viewMode(props.nav.route())}
          node={selectedNode(props.selected, props.nav.route(), props.test)}
        />
      </div>
      <Scrubber
        frames={props.frames}
        selected={props.selected}
        nav={props.nav}
      />
    </div>
  );
}
