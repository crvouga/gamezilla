import type { Timers } from '@pkgs/clock';
import type { HttpClient } from '@pkgs/http-client/types';
import type { BugReport, CreatedIssue, IssueReporter } from '../shared/types';

/** The client sees one domain API, never a filesystem path or vendor configuration. */
export class HttpIssueReporter implements IssueReporter {
  constructor(
    private readonly options: {
      readonly http: HttpClient;
      readonly endpoint: string;
      readonly timers: Timers;
    }
  ) {}

  async create(report: BugReport): Promise<CreatedIssue> {
    const controller = new AbortController();
    const handle = this.options.timers.setTimeout(
      () => controller.abort(),
      10_000
    );
    try {
      const response = await this.options.http.fetch(this.options.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'omit',
        body: JSON.stringify(report),
        signal: controller.signal,
      });
      if (!response.ok) throw new Error('Report could not be saved');
      const result: unknown = await response.json();
      if (
        typeof result !== 'object' ||
        result === null ||
        !('id' in result) ||
        typeof result.id !== 'string'
      )
        throw new Error('Invalid report receipt');
      return result as CreatedIssue;
    } finally {
      this.options.timers.clearTimeout(handle);
    }
  }
}
