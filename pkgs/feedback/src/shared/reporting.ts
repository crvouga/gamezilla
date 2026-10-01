import type { Clock, Timers } from '@pkgs/clock';
import type { CreateId } from '@pkgs/uuid';
import { collectDiagnostics } from './diagnostics';
import type {
  FeedbackReport,
  CreatedIssue,
  DiagnosticProvider,
  IssueReporter,
} from './types';

export interface FeedbackReportingOptions {
  readonly reporter: IssueReporter;
  readonly clock: Clock;
  readonly timers: Timers;
  readonly createId: CreateId;
  readonly providers?: readonly DiagnosticProvider[];
  readonly deadlineMs?: number;
}

export interface SubmittedFeedback {
  readonly issue: CreatedIssue;
  readonly report: FeedbackReport;
  /** Basic report is already persisted. Optional enrichment never rejects. */
  readonly enriched: Promise<FeedbackReport>;
}

export function createFeedbackReporting(options: FeedbackReportingOptions) {
  let emergencySequence = 0;
  function baseline(title: string, description: string): FeedbackReport {
    let id: string;
    let createdAt: string;
    try {
      id = options.createId();
    } catch {
      id = `emergency-${++emergencySequence}`;
    }
    try {
      createdAt = new Date(options.clock.now()).toISOString();
    } catch {
      createdAt = 'unknown';
    }
    return {
      version: 1,
      id,
      title: title.trim().slice(0, 240) || 'Emergency feedback report',
      description: description.slice(0, 32_000),
      createdAt,
      status: 'open',
      diagnostics: [],
    };
  }
  async function enrich(
    issue: CreatedIssue,
    report: FeedbackReport
  ): Promise<FeedbackReport> {
    try {
      const diagnostics = await collectDiagnostics(
        options.providers ?? [],
        options.timers,
        options.deadlineMs ?? 500
      );
      const enriched = { ...report, diagnostics };
      await options.reporter.enrich?.(issue, enriched);
      return enriched;
    } catch {
      return report;
    }
  }
  return {
    async submit(input: {
      readonly title: string;
      readonly description: string;
    }): Promise<SubmittedFeedback> {
      const report = baseline(input.title, input.description);
      if (options.reporter.enrich === undefined) {
        const diagnostics = await collectDiagnostics(
          options.providers ?? [],
          options.timers,
          options.deadlineMs ?? 500
        );
        const complete = { ...report, diagnostics };
        const issue = await options.reporter.create(complete);
        return { issue, report: complete, enriched: Promise.resolve(complete) };
      }
      const issue = await options.reporter.create(report);
      return { issue, report, enriched: enrich(issue, report) };
    },
  };
}
