import type { HtmlReportTest } from '@pkgs/sim';

import type { FlatFrame } from '../lib/frames';
import { actorIds, frameHasUi, selectedFrame, testFrames } from '../lib/frames';
import {
  type Route,
  showAside,
  showPress,
  viewMode,
  zoomMode,
} from '../lib/hash';
import type { ReportData } from '../types';

export type KeyNavHandlers = {
  toggleHelp: () => void;
  showHelp: () => boolean;
  showPalette: () => boolean;
  togglePalette: () => void;
  stopPlay: () => void;
  navigate: (route: Route) => void;
  goFrame: (frame: FlatFrame | null, node?: string) => void;
  togglePlay: () => void;
  setParam: (key: string, value: string) => void;
  route: () => Route;
};

function neighborTest(
  data: ReportData,
  testId: string,
  delta: number
): string | null {
  const i = data.tests.findIndex((t) => t.report.meta.testId === testId);
  const n = i + delta;
  if (i < 0 || n < 0 || n >= data.tests.length) return null;
  return data.tests[n]?.report.meta.testId ?? null;
}

function scrubKeys(
  e: KeyboardEvent,
  frames: FlatFrame[],
  sel: FlatFrame | null,
  h: KeyNavHandlers
): void {
  const idx = sel ? sel.index : -1;
  if (e.key === 'ArrowLeft' && idx > 0) h.goFrame(frames[idx - 1] ?? null);
  if (e.key === 'ArrowRight' && idx >= 0 && idx < frames.length - 1) {
    h.goFrame(frames[idx + 1] ?? null);
  }
  if (e.key === 'Home' && frames.length) h.goFrame(frames[0] ?? null);
  if (e.key === 'End' && frames.length) {
    h.goFrame(frames[frames.length - 1] ?? null);
  }
  if (e.key === ' ') {
    e.preventDefault();
    h.togglePlay();
  }
}

function neighborKeys(
  e: KeyboardEvent,
  data: ReportData,
  testId: string,
  h: KeyNavHandlers
): void {
  if (e.key === '[') {
    const id = neighborTest(data, testId, -1);
    if (id) h.navigate({ view: 'test', testId: id, params: {} });
  }
  if (e.key === ']') {
    const id = neighborTest(data, testId, 1);
    if (id) h.navigate({ view: 'test', testId: id, params: {} });
  }
}

function uiToggleKeys(
  e: KeyboardEvent,
  r: Route & { view: 'test' },
  h: KeyNavHandlers,
  ui: boolean
): void {
  if (!ui) return;
  if (e.key === 'm' || e.key === 'M') {
    h.setParam('view', viewMode(r) === 'multi' ? 'single' : '');
  }
  if (e.key === 'a' || e.key === 'A') {
    h.setParam('aside', showAside(r) ? '0' : '');
  }
  if (e.key === 'p' || e.key === 'P') {
    h.setParam('press', showPress(r) ? '0' : '');
  }
  if (e.key === 'f' || e.key === 'F') {
    const order = ['fit', '50', '75', '100'];
    const cur = zoomMode(r);
    const next = order[(order.indexOf(cur) + 1) % order.length] ?? 'fit';
    h.setParam('zoom', next === 'fit' ? '' : next);
  }
}

function viewKeys(
  e: KeyboardEvent,
  ctx: {
    data: ReportData;
    test: HtmlReportTest;
    sel: FlatFrame | null;
    route: Route & { view: 'test' };
    h: KeyNavHandlers;
  }
): void {
  neighborKeys(e, ctx.data, ctx.route.testId, ctx.h);
  uiToggleKeys(e, ctx.route, ctx.h, frameHasUi(ctx.sel));
  if (/^[1-9]$/.test(e.key)) {
    const ids = actorIds(ctx.sel, ctx.test);
    const n = Number.parseInt(e.key, 10);
    if (n >= 1 && n <= ids.length) ctx.h.goFrame(ctx.sel, ids[n - 1] ?? '');
  }
}

export function onReportKeyDown(
  e: KeyboardEvent,
  data: ReportData,
  h: KeyNavHandlers
): void {
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
    e.preventDefault();
    h.togglePalette();
    return;
  }
  if (e.key === 'Escape' && h.showPalette()) {
    e.preventDefault();
    h.togglePalette();
    return;
  }
  if (h.showPalette()) return;
  const target = e.target as HTMLElement | null;
  const tag = target?.tagName;
  if (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    tag === 'BUTTON' ||
    tag === 'A' ||
    target?.isContentEditable
  ) {
    return;
  }
  if (e.key === '?' || (e.shiftKey && e.key === '/')) {
    h.toggleHelp();
    return;
  }
  if (e.key === 'Escape') {
    if (h.showHelp()) {
      h.toggleHelp();
      return;
    }
    h.stopPlay();
    h.navigate({ view: 'list', params: {} });
    return;
  }
  const r = h.route();
  if (r.view !== 'test') return;
  const test =
    data.tests.find((t) => t.report.meta.testId === r.testId) ?? null;
  if (!test) return;
  const frames = testFrames(test);
  const sel = selectedFrame(frames, r);
  scrubKeys(e, frames, sel, h);
  viewKeys(e, { data, test, sel, route: r, h });
}
