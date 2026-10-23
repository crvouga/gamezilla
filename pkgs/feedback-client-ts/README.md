# Feedback

Behavior is defined in [feedback specs](../../specs/feedback/). This package is
a self-contained feedback capability: its shared model, browser client, HTTP
application, storage adapters and harness depend only on reusable `@pkgs/*`
ports. It does not know the host application's routes, accounts, database,
domain model or lifecycle. The ready-made browser adapter installs feedback
before starting an application; lower-level consumers can compose the same
controller and HTTP application directly.

## Public boundaries

- `@pkgs/feedback/shared` is the canonical report schema and domain ports.
- `@pkgs/feedback/client` is the port-driven controller and browser UI.
- `@pkgs/feedback/server` is the HTTP application and repository adapters.
- `@pkgs/feedback/browser` is an optional browser composition adapter.
- `@pkgs/feedback/context` is the narrow diagnostics-registration surface.
- `@pkgs/feedback/vite` and `@pkgs/feedback/harness` are development surfaces.

The browser adapter accepts the API endpoint, application starter, optional
standalone path, optional application-error event and storage namespace. The
HTTP application accepts an optional base path. These namespaces allow several
hosts or embedded contexts to coexist without route or storage collisions.

## Ports

`FeedbackRepository` owns create, list, read, update and remove. Its adapters are
`HttpIssueReporter`, `FakeIssueReporter`, `FileSystemIssueReporter` and
`ArchivedIssueReporter` with `GitHubIssueReporter`. Application code uses the
same controller and HTTP data port in every environment.

`FeedbackWorkspacePort` is a synchronous journal for documents, the active
selection, wizard stage, management filters, position and uncertain submissions.
The browser adapter uses namespaced local storage and imports older text drafts
before retiring their old key. Binary evidence goes through an injected
`ObjectStore`; the browser composition uses the same namespace for its Cache API
adapter. Writing and stopped recordings remain journalled independently of UI
mounting. Storage errors are visible and never cause the journal to be cleared.

Authorship is a persisted, unlisted device scope, independent of app accounts.
It filters management operations; it is not an authentication system. Sharing a
report's unlisted bundle address shares its evidence.

## Destinations

Local Vite middleware mounts `/api/feedback` before host middleware and uses
an ObjectStore rooted in the worktree's `.feedback/`. Tests substitute in-process
adapters. The hosted Worker requires the existing object-store credentials and
`FEEDBACK_GITHUB_TOKEN` / `FEEDBACK_GITHUB_REPOSITORY`. It archives the report,
creates a GitHub issue and persists the destination receipt. A vendor failure
retains the archive and the draft and is reported as a failed send.

Management uses `/api/feedback/items` through the same HTTP port. Updates change
the existing issue. Confirmed deletion uses GitHub's `deleteIssue` mutation and
keeps an archive tombstone. The GitHub token must permit these issue operations.
Local deletion also retains a tombstone rather than erasing an archive.

`report.json` is the authoritative `feedback.report/v2` document. Its
`body.source` preserves the author's Markdown verbatim and `body.sections`
provides the same content as ordered `{ heading, content }` objects for agents.
Markdown, diagnostics, ordered reproduction and the agent handoff are
best-effort companion files. Attachment metadata is resolved from stored
evidence rather than trusting submitted URLs. Readers canonicalize older
stored reports at the boundary; writers only produce v2.

## Evidence and isolation

Recording installs interaction listeners only while active. Password, email,
telephone, secret fields and feedback controls are excluded. Screen sharing is
requested explicitly and microphone audio is disabled. Recording ports can
supply video; action recording remains usable when video is unavailable.

`registerFeedbackContext` from `@pkgs/feedback/context` contributes bounded,
on-demand diagnostics. Clock, timers, IDs, HTTP, journals, video and binary
storage are injected at the independent browser and Worker composition roots.

```sh
bun feedback problem '## Observation\n\nThe board stops after a move' 'Board movement'
bun feedback --list
bun feedback --inspect <report-id>
```

`FEEDBACK_API_URL` overrides the CLI's local API address. The CLI list reads
archived reports directly, including reports whose companion writes failed.

Verification and release policy: [repository checks](../../README.md#correctness-machinery).
