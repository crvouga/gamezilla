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

export interface TraceStore {
  readonly source: string;
  adjacent(window: TimeRange): Promise<AdjacentActivity>;
  recent(
    window: TimeRange,
    options?: { readonly errorsOnly?: boolean }
  ): Promise<readonly TraceRef[]>;
  findByUser(userId: string, window: TimeRange): Promise<readonly TraceRef[]>;
  findBySession(sessionId: string): Promise<readonly TraceRef[]>;
  findByMutation(mutationId: string): Promise<readonly TraceRef[]>;
  findByTest(testId: string): Promise<readonly TraceRef[]>;
  findByDevice(deviceId: string): Promise<readonly TraceRef[]>;
  find(anything: string, window: TimeRange): Promise<TraceMatch | null>;
  getTrace(traceId: string): Promise<Trace | null>;
  schema(): Promise<TraceSchema>;
}
