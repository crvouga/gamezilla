import type { ResolvedIdentity } from './identity-resolver';
import type { Trace, TraceRef } from './types';

/** Version of the `--json` structure of `bun obs person`. */
export const PERSON_SCHEMA = 'obs.person/v1';

/** How a trace reached the person. */
export type TraceVia = 'user' | 'session' | 'device';

/** One trace of the person's activity, with the accounts it is attributed to. */
export type ActivityTrace = {
  readonly accounts: readonly string[];
  readonly ref: TraceRef;
  readonly trace: Trace;
  readonly via: TraceVia;
};

export type PlaceFit = 'not asked' | 'city' | 'region' | 'none' | 'unrecorded';

export type PersonAccount = {
  /** Place the account's own traces recorded, when any did. */
  readonly recordedPlace?: string;
  readonly matchedAs: ResolvedIdentity['matchedAs'];
  readonly place: PlaceFit;
  /** Why the account is shown or left out. */
  readonly reason: string;
  readonly shown: boolean;
  readonly traces: number;
  readonly userId: string;
};

export type ProblemSeverity = 'crash' | 'failure' | 'rejection' | 'handled';

export type PersonProblem = {
  readonly atLocal: string;
  readonly atUtc: string;
  readonly drill: { readonly span: string; readonly trace: string };
  readonly message: string;
  readonly name: string;
  readonly rank: number;
  readonly severity: ProblemSeverity;
  readonly spanId: string;
  readonly traceId: string;
};

export type TimelineKind =
  | 'route'
  | 'interaction'
  | 'timing'
  | 'request'
  | 'mutation'
  | 'rejection'
  | 'room'
  | 'error'
  | 'slow';

/** One timeline row; identical consecutive rows are collapsed into `repeat`. */
export type TimelineRow = {
  readonly atMs: number;
  readonly durationMs: number;
  readonly failed: boolean;
  readonly kind: TimelineKind;
  readonly repeat: number;
  readonly spanId: string;
  readonly text: string;
  readonly traceId: string;
  readonly untilMs: number;
};

export type TimelineRowData = {
  readonly atLocal: string;
  readonly atUtc: string;
  readonly durationMs: number;
  readonly failed: boolean;
  readonly kind: TimelineKind;
  readonly repeat: number;
  readonly spanId: string;
  readonly summary: string;
  readonly traceId: string;
  readonly untilUtc?: string;
};

/** Marks where rows were cut from the timeline. */
export type TimelineGapData = {
  readonly elided: number;
  readonly kind: 'elided';
};

export type PersonTraceSummary = {
  readonly accounts: readonly string[];
  readonly dbMs: number;
  readonly dbQueries: number;
  readonly errorCount: number;
  readonly rootName: string;
  readonly spanCount: number;
  readonly startedAtUtc: string;
  readonly traceId: string;
  readonly via: TraceVia;
};

export type PersonSummary = {
  readonly builds: readonly string[];
  readonly connection?: string;
  readonly deviceClock?: string;
  readonly devices: readonly string[];
  readonly errors: number;
  readonly mutations: number;
  readonly rejected: number;
  readonly requests: number;
  readonly sessions: readonly string[];
  readonly traces: number;
};

export type SeenAt = {
  readonly atLocal: string;
  readonly atUtc: string;
  /** Milliseconds from the asked instant; negative before it. */
  readonly offsetMs: number;
  readonly rerun: string;
  readonly traceId: string;
  readonly userId: string;
};

export type PersonStatus =
  | 'trouble'
  | 'activity'
  | 'quiet'
  | 'account-not-found'
  | 'invalid-clock';

/**
 * The stable `--json` structure. Times are ISO strings: `*Utc` in UTC,
 * `*Local` on the clock the person gave. `truncations` is empty exactly when
 * every search read all of its matches and no rows were cut.
 */
export type PersonData = {
  readonly accounts: readonly PersonAccount[];
  readonly clock?: {
    readonly instantUtc: string;
    readonly label: string;
    readonly offsetMinutes: number;
    readonly zone: string;
    readonly zoneLabel: string;
  };
  readonly next: readonly string[];
  /** Why some activity is not here, when it is not a truncation. */
  readonly notes: readonly string[];
  readonly problems: readonly PersonProblem[];
  readonly question: {
    readonly at: string;
    readonly name: string;
    readonly place?: string;
    readonly windowMs: number;
  };
  readonly schema: typeof PERSON_SCHEMA;
  readonly seen?: { readonly last?: SeenAt; readonly next?: SeenAt };
  readonly source: string;
  readonly status: PersonStatus;
  readonly summary?: PersonSummary;
  readonly timeline: {
    /** Rows cut to fit the cap. */
    readonly elided: number;
    readonly rows: readonly (TimelineRowData | TimelineGapData)[];
    /** Rows before the cap, after collapsing repeats. */
    readonly total: number;
  };
  readonly traces: readonly PersonTraceSummary[];
  readonly truncations: readonly string[];
  readonly window?: { readonly endUtc: string; readonly startUtc: string };
};
