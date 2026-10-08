import { useTimers } from '@pkgs/clock-client/solid';
import type { Timers } from '@pkgs/clock-shared/types';
import type { FlatFrame } from '@pkgs/harness-report-shared/frames';
import { selectedFrame, testFrames } from '@pkgs/harness-report-shared/frames';
import type { Route } from '@pkgs/harness-report-shared/hash';
import { buildHash, parseHash } from '@pkgs/harness-report-shared/hash';
import { onReportKeyDown } from '@pkgs/harness-report-shared/keyboard';
import type { ReportData } from '@pkgs/harness-report-shared/types';
import type { Accessor } from 'solid-js';
import { createEffect, createSignal, onCleanup } from 'solid-js';
import type { ReportNavigation } from './navigation';

export type ReportNav = {
  route: Accessor<Route>;
  showHelp: Accessor<boolean>;
  showPalette: Accessor<boolean>;
  playing: Accessor<boolean>;
  navigate: (route: Route, replace?: boolean) => void;
  /** Write the in-memory route to the URL now (end of a scrub drag). */
  commitHash: () => void;
  setParam: (key: string, value: string) => void;
  goFrame: (frame: FlatFrame | null, node?: string | undefined) => void;
  stepFrame: (delta: number) => void;
  toggleHelp: () => void;
  closeHelp: () => void;
  togglePalette: () => void;
  closePalette: () => void;
  togglePlay: () => void;
  stopPlay: () => void;
};

function advancePlay(
  data: ReportData,
  route: Accessor<Route>,
  navigate: ReportNav['navigate'],
  stopPlay: () => void
): void {
  const r = route();
  const test =
    r.view === 'test'
      ? (data.tests.find((t) => t.report.meta.testId === r.testId) ?? null)
      : null;
  if (r.view !== 'test' || !test) {
    stopPlay();
    return;
  }
  const frames = testFrames(test);
  const cur = selectedFrame(frames, r);
  const idx = cur ? cur.index : -1;
  const frame = frames[idx + 1];
  if (idx < 0 || !frame) {
    stopPlay();
    return;
  }
  navigate(
    {
      view: 'test',
      testId: r.testId,
      params: { ...r.params, frame: String(frame.index + 1) },
    },
    true
  );
}

function bindWindowListeners(opts: {
  data: ReportData;
  navigation: ReportNavigation;
  cancelHashWrite: () => void;
  route: Accessor<Route>;
  setRoute: (r: Route) => void;
  showHelp: Accessor<boolean>;
  setShowHelp: (v: boolean | ((p: boolean) => boolean)) => void;
  showPalette: Accessor<boolean>;
  togglePalette: () => void;
  stopPlay: () => void;
  navigate: (route: Route, replace?: boolean) => void;
  goFrame: ReportNav['goFrame'];
  togglePlay: () => void;
  setParam: ReportNav['setParam'];
}): void {
  onCleanup(
    opts.navigation.subscribeHash(() => {
      opts.cancelHashWrite();
      opts.stopPlay();
      opts.setRoute(parseHash(opts.navigation.readHash()));
    })
  );
  onCleanup(
    opts.navigation.subscribeKeys((e) =>
      onReportKeyDown(e, opts.data, {
        toggleHelp: () => opts.setShowHelp((p) => !p),
        showHelp: opts.showHelp,
        showPalette: opts.showPalette,
        togglePalette: opts.togglePalette,
        stopPlay: opts.stopPlay,
        navigate: (next) => opts.navigate(next),
        goFrame: opts.goFrame,
        togglePlay: opts.togglePlay,
        setParam: opts.setParam,
        route: opts.route,
      })
    )
  );

  createEffect(() => {
    const r = opts.route();
    const test =
      r.view === 'test'
        ? opts.data.tests.find((t) => t.report.meta.testId === r.testId)
        : null;
    opts.navigation.setTitle(
      (test ? `${test.report.meta.title} · ` : '') + opts.data.title
    );
  });
}

function makeReportNav(state: {
  readonly route: Accessor<Route>;
  readonly showHelp: Accessor<boolean>;
  readonly showPalette: Accessor<boolean>;
  readonly playing: Accessor<boolean>;
  readonly navigate: ReportNav['navigate'];
  readonly commitHash: ReportNav['commitHash'];
  readonly setParam: ReportNav['setParam'];
  readonly goFrame: ReportNav['goFrame'];
  readonly stepFrame: ReportNav['stepFrame'];
  readonly toggleHelp: ReportNav['toggleHelp'];
  readonly closeHelp: ReportNav['closeHelp'];
  readonly togglePalette: ReportNav['togglePalette'];
  readonly closePalette: ReportNav['closePalette'];
  readonly togglePlay: ReportNav['togglePlay'];
  readonly stopPlay: ReportNav['stopPlay'];
}): ReportNav {
  return state;
}

function navigateFrame(args: {
  readonly route: Route;
  readonly navigate: ReportNav['navigate'];
  readonly frame: FlatFrame | null;
  readonly node?: string;
}): void {
  if (args.route.view !== 'test') return;
  const params: Record<string, string> = {
    ...args.route.params,
    frame: args.frame ? String(args.frame.index + 1) : '',
  };
  if (args.node !== undefined) params['node'] = args.node || '';
  args.navigate({ view: 'test', testId: args.route.testId, params }, true);
}

/**
 * Route signal backed by the URL hash. Replace-navigation (scrub, play,
 * toggles) updates the in-memory route at once and writes the URL on a
 * trailing debounce: rendering never waits on history, and rapid scrubbing
 * cannot trip replaceState rate limits.
 */
function createHashRoute(navigation: ReportNavigation, timers: Timers) {
  const [route, setRoute] = createSignal<Route>(
    parseHash(navigation.readHash())
  );
  let hashTimer: ReturnType<Timers['setTimeout']> | null = null;
  const cancelHashWrite = () => {
    if (hashTimer !== null) timers.clearTimeout(hashTimer);
    hashTimer = null;
  };
  const commitHash = () => {
    cancelHashWrite();
    navigation.writeHash(buildHash(route()), true);
  };
  const navigate = (next: Route, replace = false) => {
    cancelHashWrite();
    setRoute(next);
    if (replace) hashTimer = timers.setTimeout(commitHash, 200);
    else navigation.writeHash(buildHash(next), false);
  };
  onCleanup(cancelHashWrite);
  return { route, setRoute, commitHash, navigate, cancelHashWrite };
}

export function useReportNav(
  data: ReportData,
  navigation: ReportNavigation
): ReportNav {
  const timers = useTimers();
  const { route, setRoute, commitHash, navigate, cancelHashWrite } =
    createHashRoute(navigation, timers);
  const [showHelp, setShowHelp] = createSignal(false);
  const [showPalette, setShowPalette] = createSignal(false);
  const { playing, stopPlay, togglePlay } = createPlayback(
    data,
    route,
    navigate,
    timers
  );

  const goFrame = (frame: FlatFrame | null, node?: string) =>
    navigateFrame({
      route: route(),
      navigate,
      frame,
      ...(node !== undefined ? { node } : {}),
    });

  const setParam = (key: string, value: string) => {
    const r = route();
    if (r.view !== 'test') return;
    navigate(
      { view: 'test', testId: r.testId, params: { ...r.params, [key]: value } },
      true
    );
  };

  const stepFrame = (delta: number) => {
    const r = route();
    if (r.view !== 'test') return;
    const test =
      data.tests.find((t) => t.report.meta.testId === r.testId) ?? null;
    if (!test) return;
    const frames = testFrames(test);
    const sel = selectedFrame(frames, r);
    const next = (sel ? sel.index : -1) + delta;
    if (next < 0 || next >= frames.length) return;
    goFrame(frames[next] ?? null);
  };

  bindWindowListeners({
    data,
    navigation,
    cancelHashWrite,
    route,
    setRoute,
    showHelp,
    setShowHelp,
    showPalette,
    togglePalette: () => setShowPalette((open) => !open),
    stopPlay,
    navigate,
    goFrame,
    togglePlay,
    setParam,
  });

  return makeReportNav({
    route,
    showHelp,
    showPalette,
    playing,
    navigate,
    commitHash,
    setParam,
    goFrame,
    stepFrame,
    toggleHelp: () => setShowHelp(!showHelp()),
    closeHelp: () => setShowHelp(false),
    togglePalette: () => setShowPalette((open) => !open),
    closePalette: () => setShowPalette(false),
    togglePlay,
    stopPlay,
  });
}

function createPlayback(
  data: ReportData,
  route: Accessor<Route>,
  navigate: ReportNav['navigate'],
  timers: Timers
) {
  let timer: ReturnType<Timers['setInterval']> | null = null;
  const [playing, setPlaying] = createSignal(false);
  const stopPlay = () => {
    if (timer !== null) timers.clearInterval(timer);
    timer = null;
    setPlaying(false);
  };
  const togglePlay = () => {
    if (playing()) {
      stopPlay();
      return;
    }
    setPlaying(true);
    timer = timers.setInterval(
      () => advancePlay(data, route, navigate, stopPlay),
      700
    );
  };
  onCleanup(stopPlay);
  return { playing, stopPlay, togglePlay };
}
