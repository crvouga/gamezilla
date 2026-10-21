import type { Timers } from '@pkgs/clock-shared-ts/types';
import type {
  CreatedIssue,
  FeedbackReport,
  FeedbackRepository,
} from '@pkgs/feedback-shared-ts/types';
import type { HttpClient } from '@pkgs/http-client-shared-ts/types';

/** The client sees one domain API, never a filesystem path or vendor configuration. */
export class HttpIssueReporter implements FeedbackRepository {
  constructor(
    private readonly options: {
      readonly http: HttpClient;
      readonly endpoint: string;
      readonly timers: Timers;
    }
  ) {}

  create(report: FeedbackReport): Promise<CreatedIssue> {
    return this.request('', 'POST', report);
  }
  list(authorId: string): Promise<readonly FeedbackReport[]> {
    return this.request('/items', 'GET', undefined, authorId);
  }
  read(id: string, authorId: string): Promise<FeedbackReport | null> {
    return this.request(
      `/items/${encodeURIComponent(id)}`,
      'GET',
      undefined,
      authorId
    );
  }
  update(report: FeedbackReport): Promise<CreatedIssue> {
    return this.request(
      `/items/${encodeURIComponent(report.id)}`,
      'PATCH',
      report,
      report.authorId
    );
  }
  async remove(id: string, authorId: string): Promise<void> {
    await this.request(
      `/items/${encodeURIComponent(id)}`,
      'DELETE',
      undefined,
      authorId
    );
  }
  private async request<T>(
    path: string,
    method: string,
    body?: FeedbackReport,
    author?: string
  ): Promise<T> {
    const controller = new AbortController();
    let handle: unknown;
    const deadline = new Promise<never>((_, reject) => {
      handle = this.options.timers.setTimeout(() => {
        reject(new Error('Report destination timed out'));
        controller.abort();
      }, 10_000);
    });
    try {
      return await Promise.race([
        this.send<T>({ path, method, body, author, signal: controller.signal }),
        deadline,
      ]);
    } finally {
      if (handle !== undefined) this.options.timers.clearTimeout(handle);
    }
  }

  private async send<T>(input: {
    path: string;
    method: string;
    body: FeedbackReport | undefined;
    author: string | undefined;
    signal: AbortSignal;
  }): Promise<T> {
    const response = await this.options.http.fetch(
      `${this.options.endpoint}${input.path}`,
      {
        method: input.method,
        headers: {
          'Content-Type': 'application/json',
          ...(input.author ? { 'X-Feedback-Author': input.author } : {}),
        },
        credentials: 'omit',
        ...(input.body ? { body: JSON.stringify(input.body) } : {}),
        signal: input.signal,
      }
    );
    if (!response.ok) throw new Error('Report could not be saved or changed');
    const result: unknown = await response.json();
    if (input.method === 'POST' || input.method === 'PATCH') {
      if (
        typeof result !== 'object' ||
        result === null ||
        !('id' in result) ||
        typeof result.id !== 'string'
      )
        throw new Error('Invalid report receipt');
    }
    return result as T;
  }
}
