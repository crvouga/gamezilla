import type { Clock, Timers } from '@pkgs/clock';
import type { CreateId } from '@pkgs/uuid';
import { collectDiagnostics } from './diagnostics';
import { createFeedbackBody, resolveFeedbackTitle } from './report-body';
import type {
  CreatedIssue,
  DiagnosticProvider,
  FeedbackAttachment,
  FeedbackDraft,
  FeedbackReport,
  IssueReporter,
  ReproductionRecording,
} from './types';
import { validateFeedback } from './validation';

export type FeedbackReportingOptions = {
  readonly reporter: IssueReporter;
  readonly clock: Clock;
  readonly timers: Timers;
  readonly createId: CreateId;
  readonly authorId?: string;
  readonly providers?: readonly DiagnosticProvider[];
  readonly deadlineMs?: number;
};

export type SubmittedFeedback = {
  readonly issue: CreatedIssue;
  readonly report: FeedbackReport;
  /** Basic report is already persisted. Optional enrichment never rejects. */
  readonly enriched: Promise<FeedbackReport>;
};

export function createFeedbackReporting(options: FeedbackReportingOptions) {
  let emergencySequence = 0;
  function baseline(
    input: FeedbackDraft & {
      recording?: ReproductionRecording | null;
      attachments?: readonly FeedbackAttachment[];
    }
  ): FeedbackReport {
    validateFeedback(input);
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
      schema: 'feedback.report/v2',
      id,
      title: resolveFeedbackTitle(input),
      kind: input.kind,
      body: createFeedbackBody(input.body),
      authorId: options.authorId ?? 'local',
      recording: input.recording ?? null,
      attachments: input.attachments ?? [],
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
      readonly kind: FeedbackDraft['kind'];
      readonly body: string;
      readonly title: string;
      readonly recording?: ReproductionRecording | null;
      readonly attachments?: readonly FeedbackAttachment[];
    }): Promise<SubmittedFeedback> {
      const report = baseline(input);
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
