export type PlayMode = 'realtime' | 'fixed';
export type PlaySpeed = 0.5 | 1 | 2;

export type ReportNavState = {
  readonly bucketId: string | null;
  readonly runId: string | null;
  readonly testId: string | null;
  readonly step: number | null;
  readonly frame: number | null;
  readonly play: boolean;
  readonly mode: PlayMode;
  readonly speed: PlaySpeed;
};

const DEFAULT_NAV: ReportNavState = {
  bucketId: null,
  runId: null,
  testId: null,
  step: null,
  frame: null,
  play: false,
  mode: 'realtime',
  speed: 1,
};

/**
 * Paths:
 * - `/`
 * - `/b/:bucketId`
 * - `/b/:bucketId/r/:runId`
 * - `/b/:bucketId/r/:runId/t/:testId?step=&frame=&play=&mode=&speed=`
 */
export function parseReportNav(
  pathname: string,
  search: string
): ReportNavState {
  const params = new URLSearchParams(
    search.startsWith('?') ? search.slice(1) : search
  );
  const match = /^\/b\/([^/]+)(?:\/r\/([^/]+)(?:\/t\/([^/]+))?)?\/?$/.exec(
    pathname
  );
  const bucketId = match ? decodeURIComponent(match[1]!) : null;
  const runId = match?.[2] ? decodeURIComponent(match[2]) : null;
  const testId = match?.[3] ? decodeURIComponent(match[3]) : null;
  const speedRaw = Number(params.get('speed') ?? '1');
  const modeRaw = params.get('mode');
  const speed: PlaySpeed = speedRaw === 0.5 || speedRaw === 2 ? speedRaw : 1;
  const mode: PlayMode = modeRaw === 'fixed' ? 'fixed' : 'realtime';
  return {
    bucketId,
    runId,
    testId,
    step: parsePositiveInt(params.get('step')),
    frame: parsePositiveInt(params.get('frame')),
    play: params.get('play') === '1',
    mode,
    speed,
  };
}

function parsePositiveInt(raw: string | null): number | null {
  if (raw == null || raw === '') return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 1) return null;
  return Math.floor(n);
}

export type NavPatch = Partial<ReportNavState>;

function buildPathname(next: ReportNavState): string {
  if (!next.bucketId) return '/';
  let pathname = `/b/${encodeURIComponent(next.bucketId)}`;
  if (!next.runId) return pathname;
  pathname += `/r/${encodeURIComponent(next.runId)}`;
  if (next.testId) {
    pathname += `/t/${encodeURIComponent(next.testId)}`;
  }
  return pathname;
}

function buildPlayerSearch(
  next: ReportNavState,
  opts?: { readonly replacePlayDefaults?: boolean }
): string {
  if (!next.bucketId || !next.runId || !next.testId) return '';
  const params = new URLSearchParams();
  if (next.step != null) params.set('step', String(next.step));
  if (next.frame != null) params.set('frame', String(next.frame));
  if (next.play) params.set('play', '1');
  if (next.mode !== 'realtime' || opts?.replacePlayDefaults) {
    params.set('mode', next.mode);
  }
  if (next.speed !== 1 || opts?.replacePlayDefaults) {
    params.set('speed', String(next.speed));
  }
  const qs = params.toString();
  return qs ? `?${qs}` : '';
}

export function buildReportUrl(
  current: ReportNavState,
  patch: NavPatch,
  opts?: { readonly replacePlayDefaults?: boolean }
): { pathname: string; search: string } {
  const next: ReportNavState = { ...current, ...patch };
  return {
    pathname: buildPathname(next),
    search: buildPlayerSearch(next, opts),
  };
}

export function navigateReport(
  current: ReportNavState,
  patch: NavPatch,
  mode: 'push' | 'replace' = 'push'
): ReportNavState {
  const next = { ...current, ...patch };
  const { pathname, search } = buildReportUrl(current, patch);
  const url = pathname + search;
  if (mode === 'replace') {
    history.replaceState(null, '', url);
  } else {
    history.pushState(null, '', url);
  }
  return next;
}

export function readWindowNav(): ReportNavState {
  if (typeof window === 'undefined') return DEFAULT_NAV;
  return parseReportNav(window.location.pathname, window.location.search);
}

export function clearPlayerNav(patch: NavPatch = {}): NavPatch {
  return {
    testId: null,
    step: null,
    frame: null,
    play: false,
    ...patch,
  };
}
