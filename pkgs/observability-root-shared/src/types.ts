import type { NarrateSpan } from './narrate';

export type TimeRange = {
  readonly startMs: number;
  readonly endMs: number;
};

export type TraceRef = {
  readonly traceId: string;
  readonly startedAtMs: number;
  readonly durationMs: number;
  readonly spanCount: number;
  readonly errorCount: number;
  readonly rootName: string;
};

export type Trace = {
  readonly traceId: string;
  readonly spans: readonly NarrateSpan[];
};

export type TraceIdentifierKind =
  | 'trace'
  | 'session'
  | 'mutation'
  | 'test'
  | 'user'
  | 'device';

export type TraceMatch = {
  readonly kind: TraceIdentifierKind;
  readonly value: string;
  readonly traces: readonly TraceRef[];
};

export type TraceSchema = {
  readonly attributeNames: readonly string[];
  readonly eventNames: readonly string[];
  readonly spanNames: readonly string[];
};

export type AdjacentActivity = {
  readonly after?: TraceRef;
  readonly before?: TraceRef;
  readonly nearby?: TraceRef;
};

/**
 * A search stopped before it saw every match. The caller says so; a short
 * result must never read as a complete one.
 */
export type TruncationNotice = {
  /** Matches kept. */
  readonly kept: number;
  /** `limit`: the cap was reached. `range`: one second still held too many. */
  readonly reason: 'limit' | 'range';
  /** The query that was cut short. */
  readonly search: string;
};

export type SearchOptions = {
  /** Most traces to return. Stores apply their own default when absent. */
  readonly limit?: number;
  /** `newest` keeps the latest traces when the limit cuts; default `newest`. */
  readonly order?: 'newest' | 'oldest';
  readonly onTruncated?: (notice: TruncationNotice) => void;
};

export type RecentOptions = SearchOptions & { readonly errorsOnly?: boolean };

export interface TraceStore {
  readonly source: string;
  adjacent(window: TimeRange): Promise<AdjacentActivity>;
  /** Errors first, then the newest activity; the same answer every time. */
  recent(
    window: TimeRange,
    options?: RecentOptions
  ): Promise<readonly TraceRef[]>;
  findByUser(
    userId: string,
    window: TimeRange,
    options?: SearchOptions
  ): Promise<readonly TraceRef[]>;
  findBySession(
    sessionId: string,
    window: TimeRange,
    options?: SearchOptions
  ): Promise<readonly TraceRef[]>;
  findByMutation(mutationId: string): Promise<readonly TraceRef[]>;
  findByTest(testId: string): Promise<readonly TraceRef[]>;
  findByDevice(
    deviceId: string,
    window: TimeRange,
    options?: SearchOptions
  ): Promise<readonly TraceRef[]>;
  find(anything: string, window: TimeRange): Promise<TraceMatch | null>;
  getTrace(traceId: string): Promise<Trace | null>;
  schema(): Promise<TraceSchema>;
}
