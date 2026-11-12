import { bugReportTitle } from '@pkgs/feedback-shared-ts/bug-report';
import type { BugReport, Diagnostic } from '@pkgs/feedback-shared-ts/types';

/** GitHub refuses an issue body longer than this. */
const MAX_ISSUE_BODY = 65_536;
const MAX_EVENTS_TEXT = 30_000;
const MAX_DETAILS_TEXT = 20_000;

/**
 * Text a person or their app wrote is only ever shown inside a fence longer
 * than any run of backticks it holds, so it can neither mention people nor
 * break out into the rest of the issue.
 */
function fenced(text: string, language: string): string {
  const longest = Math.max(
    0,
    ...(text.match(/`+/g) ?? []).map((run) => run.length)
  );
  const fence = '`'.repeat(Math.max(3, longest + 1));
  return `${fence}${language}\n${text}\n${fence}`;
}

/** Keeps the newest lines: what happened last is closest to the bug. */
function newestWithin(lines: readonly string[], budget: number): string {
  const kept: string[] = [];
  let size = 0;
  for (const line of [...lines].reverse()) {
    size += line.length + 1;
    if (size > budget) break;
    kept.unshift(line);
  }
  return kept.length < lines.length
    ? [`(${lines.length - kept.length} earlier lines left out)`, ...kept].join(
        '\n'
      )
    : kept.join('\n');
}

function detailsText(details: readonly Diagnostic[]): string {
  const available = Object.fromEntries(
    details.flatMap((detail) =>
      detail.status === 'available' ? [[detail.name, detail.value]] : []
    )
  );
  const text = JSON.stringify(available, null, 2);
  return text.length > MAX_DETAILS_TEXT
    ? `${text.slice(0, MAX_DETAILS_TEXT)}\n(cut short)`
    : text;
}

function missingDebugInfo(details: readonly Diagnostic[]): string[] {
  const missing = details.flatMap((detail) =>
    detail.status === 'unavailable' ? [`${detail.name}: ${detail.reason}`] : []
  );
  return missing.length
    ? ['**Missing debug info**', '', fenced(missing.join('\n'), 'text'), '']
    : [];
}

/** The issue the team reads: the person's words, their pictures, and the debug info. */
export function bugReportIssue(
  report: BugReport,
  options: { readonly reportUrl?: string } = {}
): { readonly title: string; readonly body: string } {
  const events = report.debugInfo.events.map(
    (event) => `${event.at} ${event.kind.padEnd(10)} ${event.text}`
  );
  const body = [
    '**What happened**',
    '',
    fenced(report.description, 'text'),
    '',
    `**Screenshots** (${report.screenshots.length})`,
    '',
    ...report.screenshots.map(
      (screenshot, index) =>
        `![Screenshot ${index + 1}](${encodeURI(screenshot.url)})`
    ),
    '',
    ...missingDebugInfo(report.debugInfo.details),
    `<details><summary>What led up to it (${events.length} events)</summary>`,
    '',
    fenced(newestWithin(events, MAX_EVENTS_TEXT), 'text'),
    '',
    '</details>',
    '',
    '<details><summary>Device and app</summary>',
    '',
    fenced(detailsText(report.debugInfo.details), 'json'),
    '',
    '</details>',
    '',
    `Bug report \`${report.id}\` from reporter \`${report.reporterId}\` at ${report.createdAt}.`,
    ...(options.reportUrl
      ? ['', `Full report for reproducing: ${options.reportUrl}`]
      : []),
  ].join('\n');
  return {
    title: `Bug report: ${bugReportTitle(report.description)}`,
    body: body.slice(0, MAX_ISSUE_BODY),
  };
}
