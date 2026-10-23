import { ATTR } from './attributes';
import type { NarrateSpan } from './narrate';
import type { ActivityTrace, TraceVia } from './person-types';
import type {
  SearchOptions,
  TimeRange,
  TraceRef,
  TraceStore,
  TruncationNotice,
} from './types';

/** Sessions, and devices, followed from one account's traces. */
const PIVOT_CAP = 12;
const LOAD_BATCH = 8;

export type Gathered = {
  /** Traces left out because another account's user.id is on them. */
  readonly foreign: number;
  readonly notices: readonly TruncationNotice[];
  readonly traces: readonly ActivityTrace[];
};

type Candidate = {
  accounts: Set<string>;
  readonly ref: TraceRef;
  readonly via: TraceVia;
};

/**
 * Everything the accounts did in the range. Traces carrying the account's
 * `user.id` come first; the `session.id` and `app.device.id` seen on them
 * then pull in traces without a user.id (a crash before sign-in, a socket
 * frame, anonymous use on the same device). One trace appears once.
 */
export async function gatherActivity(
  store: TraceStore,
  userIds: readonly string[],
  scope: { readonly limit: number; readonly range: TimeRange }
): Promise<Gathered> {
  const notices: TruncationNotice[] = [];
  const search: SearchOptions = {
    limit: scope.limit,
    onTruncated: (notice) => notices.push(notice),
  };
  const found = new Map<string, Candidate>();
  for (const userId of userIds) {
    remember(found, await store.findByUser(userId, scope.range, search), {
      userId,
      via: 'user',
    });
  }
  const loaded = new Map<string, ActivityTrace>();
  await load(store, found, loaded);
  let foreign = 0;
  for (const userId of userIds) {
    const pivots = pivotValues(loaded, userId);
    if (pivots.dropped) notices.push(pivotNotice(userId));
    const pivoted = new Map<string, Candidate>();
    for (const sessionId of pivots.sessions) {
      remember(
        pivoted,
        await store.findBySession(sessionId, scope.range, search),
        { userId, via: 'session' }
      );
    }
    for (const deviceId of pivots.devices) {
      remember(
        pivoted,
        await store.findByDevice(deviceId, scope.range, search),
        { userId, via: 'device' }
      );
    }
    foreign += await load(store, pivoted, loaded, userId);
  }
  return { traces: [...loaded.values()], notices, foreign };
}

function remember(
  into: Map<string, Candidate>,
  refs: readonly TraceRef[],
  origin: { readonly userId: string; readonly via: TraceVia }
): void {
  for (const ref of refs) {
    const existing = into.get(ref.traceId);
    if (existing === undefined) {
      into.set(ref.traceId, {
        ref,
        via: origin.via,
        accounts: new Set([origin.userId]),
      });
    } else {
      existing.accounts.add(origin.userId);
    }
  }
}

/** Reads the candidates; a pivot trace of someone else's account is skipped. */
async function load(
  store: TraceStore,
  candidates: ReadonlyMap<string, Candidate>,
  into: Map<string, ActivityTrace>,
  pivotOf?: string
): Promise<number> {
  const pending = [...candidates.values()];
  let foreign = 0;
  for (let offset = 0; offset < pending.length; offset += LOAD_BATCH) {
    const batch = pending.slice(offset, offset + LOAD_BATCH);
    const traces = await Promise.all(
      batch.map((item) => store.getTrace(item.ref.traceId))
    );
    batch.forEach((item, index) => {
      const trace = traces[index];
      if (trace === null || trace === undefined) return;
      if (pivotOf !== undefined && belongsToOthers(trace.spans, pivotOf)) {
        foreign += 1;
        return;
      }
      const known = into.get(item.ref.traceId);
      const accounts = new Set([...(known?.accounts ?? []), ...item.accounts]);
      into.set(item.ref.traceId, {
        trace,
        ref: item.ref,
        via: known?.via ?? item.via,
        accounts: [...accounts].sort(),
      });
    });
  }
  return foreign;
}

/** The trace names users, and the account is not one of them. */
function belongsToOthers(
  spans: readonly NarrateSpan[],
  userId: string
): boolean {
  const named = spans.flatMap((span) => text(span.attributes[ATTR.USER_ID]));
  return named.length > 0 && !named.includes(userId);
}

function pivotValues(
  loaded: ReadonlyMap<string, ActivityTrace>,
  userId: string
): {
  readonly devices: string[];
  readonly dropped: boolean;
  readonly sessions: string[];
} {
  const sessions = new Set<string>();
  const devices = new Set<string>();
  for (const item of loaded.values()) {
    if (!item.accounts.includes(userId)) continue;
    for (const span of item.trace.spans) {
      const owner = text(span.attributes[ATTR.USER_ID])[0];
      if (owner !== undefined && owner !== userId) continue;
      for (const id of text(span.attributes[ATTR.SESSION_ID])) sessions.add(id);
      for (const id of text(span.attributes[ATTR.APP_DEVICE_ID]))
        devices.add(id);
    }
  }
  return {
    sessions: [...sessions].slice(0, PIVOT_CAP),
    devices: [...devices].slice(0, PIVOT_CAP),
    dropped: sessions.size > PIVOT_CAP || devices.size > PIVOT_CAP,
  };
}

function pivotNotice(userId: string): TruncationNotice {
  return {
    search: `session.id and app.device.id pivots of user.id ${userId}`,
    kept: PIVOT_CAP,
    reason: 'limit',
  };
}

function text(value: NarrateSpan['attributes'][string]): string[] {
  return typeof value === 'string' && value.length > 0 ? [value] : [];
}
