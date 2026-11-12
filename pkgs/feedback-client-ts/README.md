# Bug reports

Behavior is defined in the [feedback specs](../../specs/feedback/). A person
says what went wrong, the app adds a screenshot and the last five minutes of
debug info, and the report becomes one GitHub issue an agent can reproduce
from.

Four packages, none of which knows the host application's routes, accounts or
domain model:

| Package | Holds |
| --- | --- |
| `@pkgs/feedback-shared-ts` | The report shape, its limits, the debug-info buffer and the diagnostics registry. |
| `@pkgs/feedback-client-ts` | The controller, the bug report surface, shake detection and the browser adapter. |
| `@pkgs/feedback-server-ts` | The HTTP application, the intake rules and the GitHub and local issue reporters. |
| `@pkgs/feedback-harness-ts` | The example app and device the specs run against. |

## On the device

`bootBrowserBugReports` (`wall.ts`) installs bug reporting before the
application starts, so a report can be sent from an app that crashed or never
signed in. It mounts one surface in its own island and answers three ways of
asking for it:

- `requestBugReport()`, which the host calls from its own "Report a bug" option;
- Ctrl/Cmd+Shift+B, registered through `bugReportCommand`;
- shaking the device, on by default where the device allows it without asking.
  Where the device asks first (iPhone), the person turns on "Shake to report a
  bug" once; `bugReportsOf(document).shake` is the setting the host renders.

Opening takes a screenshot of the app before the surface covers it. The person
can remove it and add up to `MAX_SCREENSHOTS - 1` more. Pictures are recognised
by their bytes, never by the name or type a file claims.

Debug info is always recording into a rolling five-minute buffer
(`debug-recording.ts`): where the person went, what they chose, troubles the
app ran into, connection changes, the device and the app version. It records
the name of a control, never what was typed into it. Other packages add
facts through `registerFeedbackContext` and `recordFeedbackTrace` in
`@pkgs/feedback-shared-ts/context`.

A report that cannot be sent is kept on the device (`storage.ts`) and retried
with backoff and when the connection returns; the draft survives closing the
app. Sending the same report twice creates one issue.

## On the server

`createBugReportHttpApp({ reporter, store, clock, allowedOrigin })` serves
`POST /api/bug-reports` and the archived reports under
`/api/bug-reports/reports/`. Intake (`bug-report-intake.ts`) refuses anything
that is not a description with at most four pictures of at most 5 MB each,
allows `DAILY_BUG_REPORT_LIMIT` reports a day per device and
`DAILY_BUG_REPORT_CEILING` a day in total, archives the report, then asks the
`IssueReporter` for an issue.

- `GitHubIssueReporter` opens the issue. It needs `FEEDBACK_GITHUB_TOKEN` and
  `FEEDBACK_GITHUB_REPOSITORY`; without them the server answers 503 and
  devices keep their reports until it can receive them.
- `localIssueReporter` is development: the archive under `.feedback/` is the
  issue. `bun feedback --list` and `bun feedback --inspect <id>` read it.

## Ports

Everything nondeterministic is injected (`ports.ts`): `ScreenshotPort`,
`MotionPort`, `ConnectionPort`, `HttpClient`, `Clock`, `Timers`, an object
store and `createId`. Wall implementations live only in `wall.ts` and
`wall-screenshot.ts`.

## Stories

`Product/Bug report` and `Product/Shake to report` in the Storybook host
(`pkgs/ui-root-harness-ts`) cover every state of the surface and the setting.
