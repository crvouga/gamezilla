import { scenarioAction } from '@libs/harness/system/actor-ui';
import type { ProductHarness } from '@libs/harness/system/harness';
import type {
  HtmlReportTest,
  ReportSnapshotBlob,
  ReportStep,
  RunReportMeta,
} from '@pkgs/harness';
import {
  createSnapshotHost,
  onReportKeyDown,
  orderedUiBlobs,
  paintSnapshotHost,
  parseHash,
  type Route,
  selectedFrame,
  stateFrameHtml,
  testFrames,
} from '@pkgs/harness-report/viewer';
import { tools } from './developer-tools-state';
export function reportMeta(
  title: string,
  status: 'passed' | 'failed' = 'passed'
): RunReportMeta {
  return {
    system: 'harness.app',
    runtime: 'in-process',
    seed: '1',
    startedAtMs: 0,
    endedAtMs: 300,
    durationMs: 300,
    status,
    runId: 'recorded-run',
    testId: title,
    title,
    actorIds: ['alice', 'bob'],
  };
}
export function recordedReport(kind: string): HtmlReportTest {
  const pictures: Readonly<Record<string, readonly number[]>> =
    kind === 'observations'
      ? {}
      : kind === 'future'
        ? { bob: [3] }
        : { alice: [2], bob: [1, 3] };
  const blobs: Record<string, import('@pkgs/harness').HtmlReportBlob> = {};
  const steps: ReportStep[] = [1, 2, 3].map((moment) => {
    const snapshots: ReportSnapshotBlob[] = [];
    for (const [actor, moments] of Object.entries(pictures)) {
      if (!moments.includes(moment)) continue;
      const file = `frames/${actor}-${moment}.html`;
      snapshots.push({ name: 'app', media: 'html', file, nodeId: actor });
      blobs[file] = {
        contentType: 'text/html',
        text: `<html><body><button data-testid="actual-control">${actor} at moment ${moment}</button></body></html>`,
      };
    }
    const file = `frames/observations-${moment}.txt`;
    snapshots.push({ name: 'observations', media: 'text', file });
    blobs[file] = {
      contentType: 'text/plain',
      text: `The invitation is waiting at moment ${moment}`,
    };
    return {
      index: moment - 1,
      kind: 'step',
      title: `Moment ${moment}`,
      status: kind === 'failed' && moment > 1 ? 'failed' : 'passed',
      startedAtMs: moment * 100,
      endedAtMs: moment * 100 + 1,
      durationMs: 1,
      frames: [
        {
          index: 0,
          capturedAtMs: moment * 100,
          durationMs: 1,
          snapshots,
          ...(kind === 'control' || kind === 'missing-control'
            ? {
                hit: {
                  path: [
                    kind === 'control' ? 'actual-control' : 'absent-control',
                  ],
                },
              }
            : {}),
        },
      ],
      steps: [],
    };
  });
  return {
    report: {
      meta: reportMeta(
        'Recorded investigation',
        kind === 'failed' ? 'failed' : 'passed'
      ),
      steps,
    },
    blobs,
  };
}
export const provideRecordedReport = scenarioAction({
  name: 'provideRecordedReport',
  act: (s, kind: string, initial?: number) => {
    const state = tools(s);
    state.report = recordedReport(kind);
    state.route = {
      view: 'test',
      testId: state.report.report.meta.testId,
      params: initial === undefined ? {} : { frame: String(initial) },
    };
  },
});
export const selectRecordedMoment = scenarioAction({
  name: 'selectRecordedMoment',
  act: (s, number?: number) => {
    const state = tools(s);
    if (state.report === null) throw new Error('Report missing');
    state.route = parseHash(
      number === undefined
        ? '#/test/Recorded%20investigation'
        : `#/test/Recorded%20investigation?frame=${number}`
    );
  },
});
export const moveRecordedMoment = scenarioAction({
  name: 'moveRecordedMoment',
  act: (s, key: string) => {
    const state = tools(s);
    const report = state.report;
    if (report === null) throw new Error('Report missing');
    onReportKeyDown(
      new KeyboardEvent('keydown', { key }),
      {
        title: 'Investigation',
        runId: 'recorded-run',
        status: report.report.meta.status,
        updatedAtMs: 300,
        tests: [report],
      },
      {
        route: () => state.route,
        goFrame: (frame) => {
          if (frame !== null)
            state.route = {
              ...state.route,
              params: { ...state.route.params, frame: String(frame.index + 1) },
            };
        },
        navigate: (route: Route) => {
          state.route = route;
        },
        setParam: (key, value) => {
          state.route = {
            ...state.route,
            params: { ...state.route.params, [key]: value },
          };
        },
        showHelp: () => false,
        showPalette: () => false,
        toggleHelp: () => {
          /* This fixture exercises recorded moment navigation without playback or overlays. */
        },
        togglePalette: () => {
          /* This fixture exercises recorded moment navigation without playback or overlays. */
        },
        stopPlay: () => {
          /* This fixture exercises recorded moment navigation without playback or overlays. */
        },
        togglePlay: () => {
          /* This fixture exercises recorded moment navigation without playback or overlays. */
        },
      }
    );
  },
});
export function shownMoment(s: ProductHarness) {
  const state = tools(s);
  return state.report === null
    ? null
    : selectedFrame(testFrames(state.report), state.route)?.index;
}
export function shownPicture(s: ProductHarness, actor: string) {
  const state = tools(s);
  const report = state.report;
  if (report === null) throw new Error('Report missing');
  const slot = orderedUiBlobs(
    selectedFrame(testFrames(report), state.route),
    report
  ).find((slot) => slot.nodeId === actor);
  return { file: slot?.blob?.file ?? null, earlier: slot?.stale ?? false };
}
export function shownObservations(s: ProductHarness) {
  const state = tools(s);
  const report = state.report;
  if (report === null) throw new Error('Report missing');
  const frame = selectedFrame(testFrames(report), state.route);
  if (frame === null) return null;
  const blob = frame.frame.snapshots.find(
    (blob) => blob.name === 'observations'
  );
  return stateFrameHtml(
    frame,
    blob === undefined
      ? []
      : [{ heading: 'Observations', body: report.blobs[blob.file]?.text ?? '' }]
  );
}
export const showRecordedControl = scenarioAction({
  name: 'showRecordedControl',
  act: (s) => {
    const state = tools(s);
    const report = state.report;
    if (report === null) throw new Error('Report missing');
    const frame = selectedFrame(testFrames(report), state.route);
    const picture = shownPicture(s, 'alice');
    if (frame === null || picture.file === null)
      throw new Error('Picture missing');
    const host = createSnapshotHost();
    document.body.appendChild(host);
    try {
      state.hit = paintSnapshotHost(
        host,
        {
          key: picture.file,
          html: report.blobs[picture.file]?.text ?? '',
          css: '',
        },
        frame.frame.hit ?? null
      );
    } finally {
      host.remove();
    }
  },
});
export const shownControlResult = (s: ProductHarness) => tools(s).hit;
