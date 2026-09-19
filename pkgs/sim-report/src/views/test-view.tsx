import type { HtmlReportTest, ReportSnapshotBlob } from '@pkgs/sim';
import { createMemo, For, Show } from 'solid-js';
import { useReport } from '../app/report-context';
import type { ReportNav } from '../app/use-report-nav';
import { DocStage } from '../components/doc-stage';
import { FailBanner } from '../components/fail-banner';
import { FrameCaption } from '../components/frame-caption';
import { PhoneStage } from '../components/phone-stage';
import { Scrubber } from '../components/scrubber';
import { StepTree } from '../components/step-tree';
import { Toolbar } from '../components/toolbar';
import { blobHeading, fileLabel, fmtMs, formatBlobBody } from '../lib/format';
import {
  frameHasUi,
  isUi,
  neighborFailure,
  selectedFrame,
  selectedNode,
  testFrames,
} from '../lib/frames';
import { showAside, viewMode } from '../lib/hash';

function SnapshotsAside(props: {
  test: HtmlReportTest;
  blobs: ReportSnapshotBlob[];
}) {
  return (
    <div class="sr-aside">
      <For each={props.blobs}>
        {(b) => (
          <>
            <h3>{blobHeading(b)}</h3>
            <pre>{formatBlobBody(props.test, b)}</pre>
          </>
        )}
      </For>
    </div>
  );
}

export function TestView(props: { nav: ReportNav }) {
  const report = useReport();
  const testId = createMemo(() => {
    const r = props.nav.route();
    return r.view === 'test' ? r.testId : '';
  });
  const test = createMemo(
    () =>
      report.data.tests.find((t) => t.report.meta.testId === testId()) ?? null
  );
  const frames = createMemo(() => {
    const t = test();
    return t ? testFrames(t) : [];
  });
  const sel = createMemo(() => selectedFrame(frames(), props.nav.route()));
  const hasUi = createMemo(() => frameHasUi(sel()));
  const asideBlobs = createMemo(
    () => sel()?.frame.snapshots.filter((b) => !isUi(b)) ?? []
  );
  const firstFailure = createMemo(() => neighborFailure(frames(), -1, 1));
  const showSnapshots = createMemo(
    () => hasUi() && showAside(props.nav.route()) && asideBlobs().length > 0
  );

  return (
    <Show
      when={test()}
      fallback={<div class="sr-empty">{`Unknown test: ${testId()}`}</div>}
    >
      {(t) => {
        const m = () => t().report.meta;
        return (
          <div class="sr-detail">
            <div class="sr-side">
              <div class="sr-testhead">
                <h2>
                  <span class={`sr-dot ${m().status}`} />
                  {m().title}
                </h2>
                <div class="sr-kv">
                  <span class="mono">{fileLabel(m().sourceFile)}</span>
                  <span class="mono">{m().testId}</span>
                  <span>{`seed ${m().seed}`}</span>
                  <span>{`${m().system} · ${m().runtime}`}</span>
                  <span>{fmtMs(m().durationMs)}</span>
                  <Show when={m().sourceFile}>
                    {(sf) => (
                      <span class="mono">
                        {sf()}
                        {m().sourceLine ? `:${m().sourceLine}` : ''}
                      </span>
                    )}
                  </Show>
                </div>
              </div>
              <StepTree
                test={t()}
                frames={frames()}
                selected={sel()}
                onSelect={(f) => props.nav.goFrame(f)}
              />
            </div>
            <div class="sr-main">
              <div class="sr-viewer">
                <FailBanner
                  error={m().error}
                  errorStack={m().errorStack}
                  failure={firstFailure()}
                  onJump={(f) => props.nav.goFrame(f)}
                />
                <Toolbar
                  nav={props.nav}
                  ui={hasUi()}
                  hasData={asideBlobs().length > 0}
                />
                <FrameCaption test={t()} frames={frames()} selected={sel()} />
                <div class="sr-stage-wrap">
                  <Show
                    when={hasUi()}
                    fallback={<DocStage test={t()} selected={sel()} />}
                  >
                    <PhoneStage
                      test={t()}
                      selected={sel()}
                      nav={props.nav}
                      mode={viewMode(props.nav.route())}
                      node={selectedNode(sel(), props.nav.route(), t())}
                    />
                  </Show>
                  <Show when={showSnapshots()}>
                    <SnapshotsAside test={t()} blobs={asideBlobs()} />
                  </Show>
                </div>
                <Scrubber frames={frames()} selected={sel()} nav={props.nav} />
              </div>
            </div>
          </div>
        );
      }}
    </Show>
  );
}
