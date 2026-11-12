import type { Command } from '@pkgs/ui-root-client-ts/types';
import type { BugReportController } from './controller';
import type { ShakeControl } from './shake';

export const BUG_REPORT_REQUEST_EVENT = 'bug-report:open';

/** Asks for the bug report from anywhere in the app, whatever state the app is in. */
export function requestBugReport(target: EventTarget = document): void {
  target.dispatchEvent(new Event(BUG_REPORT_REQUEST_EVENT));
}

export function bugReportCommand(labels: {
  title: string;
  category: string;
}): Command {
  return {
    id: 'bug-report-open',
    title: labels.title,
    category: labels.category,
    keywords: ['bug', 'report', 'problem', 'issue', 'feedback', 'broken'],
    run: () => requestBugReport(),
  };
}

/** What the app's own screens may show of bug reporting. */
export type BugReports = {
  readonly controller: BugReportController;
  readonly shake: ShakeControl;
};

const mounted = new WeakMap<Document, BugReports>();

export function registerBugReports(
  document: Document,
  bugReports: BugReports
): () => void {
  mounted.set(document, bugReports);
  return () => {
    if (mounted.get(document) === bugReports) mounted.delete(document);
  };
}

/** `null` where bug reporting is not running, such as a preview of one screen. */
export function bugReportsOf(target: Document = document): BugReports | null {
  return mounted.get(target) ?? null;
}
