import { createEffect, createMemo, Match, Show, Switch } from 'solid-js';
import { type TestLoad, useReport } from '../app/report-context';
import type { ReportNav } from '../app/use-report-nav';
import { FailBanner } from '../components/fail-banner';
import { FrameCaption } from '../components/frame-caption';
import { PhoneStage } from '../components/phone-stage';
import { ScenarioScript } from '../components/scenario-script';
import { Scrubber } from '../components/scrubber';
import { SnapshotsAside } from '../components/snapshots-aside';
import { StepTree } from '../components/step-tree';
import { TestNav } from '../components/test-nav';
import { Toolbar } from '../components/toolbar';
import { fileLabel, fmtMs } from '../lib/format';
import {
  frameFilesNear,
  frameHasUi,
  isUi,
  neighborFailure,
  selectedFrame,
  selectedNode,
  testFrames,
} from '../lib/frames';
import { showAside, viewMode } from '../lib/hash';

/** Opens the timeline at once. Frame files stream into the phones as they arrive. */
export function TestView(props: { nav: ReportNav }) {
  const report = useReport();
  const testId = createMemo(() => {
    const r = props.nav.route();
    return r.view === 'test' ? r.testId : '';
  });
  createEffect(() => {
    const id = testId();
    if (id !== '') report.loader?.load(id);
  });
  const load = createMemo(
    (): TestLoad => report.loader?.state(testId()) ?? { kind: 'ready' }
  );
  const known = createMemo(
    () =>
      report.data.tests.find((t) => t.report.meta.testId === testId()) ?? null
  );
  const failure = createMemo(() => {
    const l = load();
    return l.kind === 'error' ? l.message : null;
  });
  return (
    <Switch fallback={<div class="sr-note">{`Waiting for ${testId()}…`}</div>}>
      <Match when={known()}>
        <LoadedTestView nav={props.nav} testId={testId()} />
      </Match>
      <Match when={load().kind === 'missing'}>
        <div class="sr-note">{`Unknown test: ${testId()}`}</div>
      </Match>
      <Match when={failure()}>
        {(message) => (
          <div class="sr-note">{`Could not load ${testId()}: ${message()}`}</div>
        )}
      </Match>
    </Switch>
  );
}

function LoadedTestView(props: { nav: ReportNav; testId: string }) {
  const report = useReport();
  const testId = () => props.testId;
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
  createEffect(() => {
    const selected = sel();
    const ensure = report.loader?.ensureBlob;
    if (!selected || !ensure) return;
    for (const file of frameFilesNear(frames(), selected.index, 8)) {
      ensure(testId(), file);
    }
  });

  return (
    <Show
      when={test()}
      fallback={<div class="sr-empty">{`Unknown test: ${testId()}`}</div>}
    >
      {(t) => {
        const m = () => t().report.meta;
        return (
          <div class="sr-test">
            <TestNav nav={props.nav} testId={testId()} />
            <ScenarioScript
              steps={t().report.steps}
              frames={frames()}
              selected={sel()}
              onSelect={(frame) => props.nav.goFrame(frame)}
            />
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
                    ui={frames().length > 0}
                    hasData={asideBlobs().length > 0}
                  />
                  <FrameCaption test={t()} frames={frames()} selected={sel()} />
                  <div class="sr-stage-wrap">
                    <PhoneStage
                      test={t()}
                      selected={sel()}
                      nav={props.nav}
                      mode={viewMode(props.nav.route())}
                      node={selectedNode(sel(), props.nav.route(), t())}
                    />
                    <Show when={showSnapshots()}>
                      <SnapshotsAside test={t()} blobs={asideBlobs()} />
                    </Show>
                  </div>
                  <Scrubber
                    frames={frames()}
                    selected={sel()}
                    nav={props.nav}
                  />
                </div>
              </div>
            </div>
          </div>
        );
      }}
    </Show>
  );
}
