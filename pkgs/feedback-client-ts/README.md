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
signed in. It mounts one surface in its own island and answers four ways of
asking for it:

- `requestBugReport()`, which the host calls from its own "Report a bug" option;
- Ctrl/Cmd+Shift+B, registered through `bugReportCommand`;
- a three-finger press: three fingers held still on the app for one second
  (`three-finger-press.ts`), with no setting and nothing to allow;
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

`createBugReportHttpApp({ store, clock, allowedOrigins })` serves
`POST /api/bug-reports` and the archived reports under
`/api/bug-reports/reports/`. Intake (`bug-report-intake.ts`) refuses anything
that is not a description with at most four pictures of at most 5 MB each,
allows `DAILY_BUG_REPORT_LIMIT` reports a day per device and
`DAILY_BUG_REPORT_CEILING` a day in total, keeps the report's files, then
records it.

Where reports go is behind one port, `BugReportStore` in
`@pkgs/feedback-shared-ts/types`: `records` (`BugReportRecords`: find a report
by id and the device that sent it, count a day's reports per device and in
total, record one, and say whether one could be recorded now) and
`attachments` (`BugReportAttachments`: keep and serve the full report JSON and
its pictures). A database-backed adapter would be one more implementation of
the same two types; the intake and the HTTP app never change.

- `GitHubBugReportRecords` makes GitHub the record: each report is an issue
  labelled `bug`, `bug-report` and `env:<environment>` (`env:prd`, `env:dev`),
  whose body opens with a hidden marker naming the report and its device. A
  report sent again is found by that marker (the newest issues, then issue
  search), and a day's counts come from the newest issues of that environment.
  The API Worker uses the repository admin token, `GITHUB_ADMIN_TOKEN`, as is
  (GitHub mints no narrower token without a GitHub App), and
  `FEEDBACK_GITHUB_REPOSITORY` is the repository `tofu/global.tfvars.json`
  names. The secrets check asks GitHub whether the token may open issues
  there; without either the server answers 503 with the reason and devices
  keep their reports until it can receive them.
- `objectStoreBugReportAttachments` keeps the files in the environment's
  object store: GitHub has no API to attach a picture to an issue, and the
  bucket already serves them at an unlisted address.
- `GET /api/bug-reports/health` asks both whether a report sent now would be
  recorded, and names what is not ready; production's health run asks it
  ([`receiving-bug-reports.feature`](../../specs/feedback/receiving-bug-reports.feature)).
- The issue is written for whoever fixes the bug (`issue-body.ts`): where it
  happened and the commit, the timeline with the `data-testid` of each choice,
  every stack and failed request, the device and session, and the link to the
  full report as JSON.
- `objectStoreBugReportStore` is development and tests: records and files in
  one object store, the archive under `.feedback/` standing in for the issue.
  `bun feedback --list` and `bun feedback --inspect <id>` read it.

## Ports

Everything nondeterministic is injected (`ports.ts`): `ScreenshotPort`,
`MotionPort`, `ConnectionPort`, `HttpClient`, `Clock`, `Timers`, an object
store and `createId`. Wall implementations live only in `wall.ts` and
`wall-screenshot.ts`.

## Stories

`Product/Bug report` and `Product/Shake to report` in the Storybook host
(`pkgs/ui-root-harness-ts`) cover every state of the surface and the setting.
