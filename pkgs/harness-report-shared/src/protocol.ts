/**
 * What the shared reports store holds and what a reports API streams from it.
 * Types only plus a Server-Sent Events codec: safe in a Worker, a CLI and a
 * browser alike.
 */

import type { HtmlReportBlob } from '@pkgs/harness-root-shared/bundle';
import type {
  ReportTestStatus,
  RunReport,
  RunReportMeta,
} from '@pkgs/harness-root-shared/report-types';

/** `running` until the run that publishes the commit closes it. */
export type CommitState = 'running' | 'complete';

/** `commits/<sha>/commit.json`: one published run of every spec of a commit. */
export type CommitRecord = {
  readonly sha: string;
  readonly branch: string;
  readonly runUrl: string | null;
  readonly state: CommitState;
  readonly startedAtMs: number;
  readonly endedAtMs: number | null;
  /** Worst status over every source; null while running. */
  readonly status: ReportTestStatus | null;
};

/** `commits/<sha>/sources/<source>.json`: one package bucket's tests. */
export type SourceRecord = {
  readonly source: string;
  /** Repo-relative package dir (`libs/chess`). */
  readonly packageDir: string;
  /** The bucket under the package's report dir (`part-2`, `all`). */
  readonly bucket: string;
  readonly status: ReportTestStatus;
  readonly updatedAtMs: number;
  /** Each test's meta, test-runner outcomes already applied. */
  readonly tests: readonly RunReportMeta[];
};

export type CommitPage = {
  readonly commits: readonly CommitRecord[];
  /** Pass back as `?cursor=` for the next, older page; null on the last. */
  readonly cursor: string | null;
};

/** `GET …/:sha/events`: the commit, then each source as it is read. */
export type CommitEvent =
  | { readonly type: 'commit'; readonly commit: CommitRecord | null }
  | { readonly type: 'source'; readonly source: SourceRecord }
  | { readonly type: 'end'; readonly state: CommitState | 'missing' };

/** `GET …/:sha/tests/:source/:testId/events`: a test, then its frame files. */
export type TestEvent =
  | { readonly type: 'report'; readonly report: RunReport }
  | {
      readonly type: 'blob';
      readonly file: string;
      readonly blob: HtmlReportBlob;
    }
  | { readonly type: 'end'; readonly found: boolean };

export const EVENT_STREAM_CONTENT_TYPE = 'text/event-stream; charset=utf-8';

/** One SSE message: `event:` is the event's `type`, `data:` its JSON. */
export function encodeSseEvent(event: CommitEvent | TestEvent): string {
  return `event: ${event.type}\ndata: ${JSON.stringify(event)}\n\n`;
}

/**
 * Incremental SSE decoder: feed it text as it arrives, get back each
 * complete message's parsed `data`. Only `data:` lines matter here (every
 * event repeats its type in its JSON); comments and other fields are skipped.
 */
export class SseDecoder<T> {
  #buffer = '';

  push(chunk: string): T[] {
    this.#buffer += chunk.replace(/\r\n?/g, '\n');
    const out: T[] = [];
    for (;;) {
      const end = this.#buffer.indexOf('\n\n');
      if (end < 0) return out;
      const message = this.#buffer.slice(0, end);
      this.#buffer = this.#buffer.slice(end + 2);
      const data = message
        .split('\n')
        .filter((line) => line.startsWith('data:'))
        .map((line) => line.slice(line.startsWith('data: ') ? 6 : 5))
        .join('\n');
      if (data.length > 0) out.push(JSON.parse(data) as T);
    }
  }
}
