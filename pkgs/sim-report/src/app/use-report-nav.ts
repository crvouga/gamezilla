import type { Accessor } from 'solid-js';
import { createEffect, createSignal } from 'solid-js';

import type { FlatFrame } from '../lib/frames';
import { selectedFrame, testFrames } from '../lib/frames';
import { buildHash, parseHash, type Route } from '../lib/hash';
import type { ReportData } from '../types';
import { startPlayTimer, stopPlayTimer } from '../wall';
import { onReportKeyDown } from './keyboard';

export type ReportNav = {
  route: Accessor<Route>;
  showHelp: Accessor<boolean>;
  playing: Accessor<boolean>;
  navigate: (route: Route, replace?: boolean) => void;
  setParam: (key: string, value: string) => void;
  goFrame: (frame: FlatFrame | null, node?: string | undefined) => void;
  stepFrame: (delta: number) => void;
  toggleHelp: () => void;
  togglePlay: () => void;
  stopPlay: () => void;
};

function advancePlay(
  data: ReportData,
  setRoute: (r: Route) => void,
  stopPlay: () => void
): void {
  const r = parseHash();
  if (r.view !== 'test') {
    stopPlay();
    return;
  }
  const test =
    data.tests.find((t) => t.report.meta.testId === r.testId) ?? null;
  if (!test) {
    stopPlay();
    return;
  }
  const frames = testFrames(test);
  const cur = selectedFrame(frames, r);
  const idx = cur ? cur.index : -1;
  if (idx < 0 || idx >= frames.length - 1) {
    stopPlay();
    setRoute(parseHash());
    return;
  }
  const frame = frames[idx + 1];
  if (!frame) return;
  const next: Route = {
    view: 'test',
    testId: r.testId,
    params: { ...r.params, frame: String(frame.index + 1) },
  };
  history.replaceState(null, '', buildHash(next));
  setRoute(next);
}

function bindWindowListeners(opts: {
  data: ReportData;
  route: Accessor<Route>;
  setRoute: (r: Route) => void;
  showHelp: Accessor<boolean>;
  setShowHelp: (v: boolean | ((p: boolean) => boolean)) => void;
  stopPlay: () => void;
  navigate: (route: Route, replace?: boolean) => void;
  goFrame: ReportNav['goFrame'];
  togglePlay: () => void;
  setParam: ReportNav['setParam'];
}): void {
  createEffect(() => {
    const onHash = () => {
      opts.stopPlay();
      opts.setRoute(parseHash());
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  });

  createEffect(() => {
    const onKey = (e: KeyboardEvent) =>
      onReportKeyDown(e, opts.data, {
        toggleHelp: () => opts.setShowHelp((p) => !p),
        showHelp: opts.showHelp,
        stopPlay: opts.stopPlay,
        navigate: (next) => opts.navigate(next),
        goFrame: opts.goFrame,
        togglePlay: opts.togglePlay,
        setParam: opts.setParam,
        route: opts.route,
      });
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  createEffect(() => {
    const r = opts.route();
    const test =
      r.view === 'test'
        ? opts.data.tests.find((t) => t.report.meta.testId === r.testId)
        : null;
    document.title =
      (test ? `${test.report.meta.title} · ` : '') + opts.data.title;
  });
}

export function useReportNav(data: ReportData): ReportNav {
  const [route, setRoute] = createSignal<Route>(parseHash());
  const [showHelp, setShowHelp] = createSignal(false);
  const [playing, setPlaying] = createSignal(false);

  const navigate = (next: Route, replace = false) => {
    const hash = buildHash(next);
    if (replace) {
      history.replaceState(null, '', hash);
      setRoute(next);
    } else {
      location.hash = hash;
    }
  };

  const stopPlay = () => {
    stopPlayTimer();
    setPlaying(false);
  };

  const goFrame = (frame: FlatFrame | null, node?: string) => {
    const r = route();
    if (r.view !== 'test') return;
    const params: Record<string, string> = {
      ...r.params,
      frame: frame ? String(frame.index + 1) : '',
    };
    if (node !== undefined) params['node'] = node || '';
    navigate({ view: 'test', testId: r.testId, params }, true);
  };

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

  const togglePlay = () => {
    if (playing()) {
      stopPlay();
      return;
    }
    setPlaying(true);
    startPlayTimer(() => advancePlay(data, setRoute, stopPlay));
  };

  bindWindowListeners({
    data,
    route,
    setRoute,
    showHelp,
    setShowHelp,
    stopPlay,
    navigate,
    goFrame,
    togglePlay,
    setParam,
  });

  return {
    route,
    showHelp,
    playing,
    navigate,
    setParam,
    goFrame,
    stepFrame,
    toggleHelp: () => setShowHelp(!showHelp()),
    togglePlay,
    stopPlay,
  };
}
