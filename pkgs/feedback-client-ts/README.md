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
signed in. It mounts one surface in its own island and answers five ways of
asking for it:

- `requestBugReport()`, which the host calls from its own "Report a bug" option;
- Ctrl/Cmd+Shift+B, registered through `bugReportCommand`;
- a three-finger press: three fingers held still on the app for one second
  (`three-finger-press.ts`), with no setting and nothing to allow;
- shaking the device, on by default where the device allows it without asking.
  Where the device asks first (iPhone), the person turns on "Shake to report a
  bug" once; `bugReportsOf(document).shake` is the setting the host renders.
- "Report a bug about this" in the app's own right-click menu on a computer
  (`context-menu.ts`). The bug report then carries a `subject`: the thing's
  `data-testid` chain, `data-component`, `data-screen`, accessible name, role,
  box and the window size in CSS px, the pointer and any words selected on the
  page — never what was typed into a field. The screenshot is drawn with that
  box marked, and the issue says what the report is about.

The right-click menu replaces the browser's for a mouse only (a finger or a pen
keeps its long press) and offers what the browser's own does that a page may
do: copy, search the web and select all for selected words; undo, redo, cut,
copy, paste and select all in a field; open, open in a new tab and copy the
address of a link; open, copy and save a picture; back, forward, reload, copy
the page link and print on the page itself. The ContextMenu key and Shift+F10
open it at the focused thing. Shift+right-click, a second right-click while it
is open, a right-click the page already handled (`preventDefault`, as the chess
board does for its arrows) and anything inside `data-native-context-menu` get
the browser's own menu. Everything it does to the browser goes through
`BrowserPort` (`wall-browser.ts`).

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

`createBugReportHttpApp({ reporter, store, clock, allowedOrigins })` serves
`POST /api/bug-reports` and the archived reports under
`/api/bug-reports/reports/`. Intake (`bug-report-intake.ts`) refuses anything
that is not a description with at most four pictures of at most 5 MB each,
allows `DAILY_BUG_REPORT_LIMIT` reports a day per device and
`DAILY_BUG_REPORT_CEILING` a day in total, archives the report, then asks the
`IssueReporter` for an issue.

- `GitHubIssueReporter` opens the issue, labelled `bug` and `bug-report`. It
  needs `FEEDBACK_GITHUB_TOKEN` and `FEEDBACK_GITHUB_REPOSITORY`, both required
  account-wide secrets whose validation asks GitHub whether the token may
  open issues there; without them the server answers 503 with the reason and
  devices keep their reports until it can receive them. `GET /api/bug-reports/health` says whether a report
  sent now would become an issue, and production's health run asks it
  ([`receiving-bug-reports.feature`](../../specs/feedback/receiving-bug-reports.feature)).
- The issue is written for whoever fixes the bug (`issue-body.ts`): the one
  thing it is about, where it happened and the commit, the timeline with the `data-testid` of each choice,
  every stack and failed request, the device and session, and the link to the
  full report as JSON.
- `localIssueReporter` is development: the archive under `.feedback/` is the
  issue. `bun feedback --list` and `bun feedback --inspect <id>` read it.

## Ports

Everything nondeterministic is injected (`ports.ts`): `ScreenshotPort`,
`MotionPort`, `ConnectionPort`, `BrowserPort`, `HttpClient`, `Clock`, `Timers`,
an object store and `createId`. Wall implementations live only in `wall.ts`,
`wall-screenshot.ts` and `wall-browser.ts`.

## Stories

`Product/Bug report` and `Product/Shake to report` in the Storybook host
(`pkgs/ui-root-harness-ts`) cover every state of the surface and the setting.
