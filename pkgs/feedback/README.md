# Product feedback

Behavior: [feedback specs](../../specs/feedback/). The platform installs Support
before importing the product. The feedback UI has an independent Solid root,
using `@pkgs/ui` menus, fields, responsive surfaces and submission feedback. It
follows the app theme without owning the document theme. Product routing, sign-in,
sync and database startup are not dependencies.

Open **Support**, or **Ctrl/Cmd+Shift+B**. `/feedback` opens the same surface
without importing the product. A stopped reproduction remains available when the
surface is closed and reopened. Text drafts recover through browser storage when
it is available; recordings and selected files stay in memory until discarded or
the page closes. Save the video from its review before closing the page if needed.
A stopped renderer cannot execute JavaScript; open `/feedback` separately or use
the CLI from outside that page.

## Reproduction evidence

Recording starts only through an explicit action. It captures clicks, permitted
input values, navigation keys and pointer endpoints with stable control identifiers
and relative times. Password, email, telephone, secret/code fields and elements
marked `data-feedback-private` are excluded. No activity listeners are installed
outside a recording. Screen sharing is requested only by that action, with audio
disabled. Unsupported or declined video still permits action recording. Both the
steps and video are reviewable and discardable before sending.

Recordings stop at 90 seconds; action capture is bounded to 200 actions / 32 KB.
Video and image attachments have a 12 MB limit. Screen video is supported where
the browser supplies `getDisplayMedia` and `MediaRecorder`; elsewhere the person
can attach an existing recording or screenshot. No microphone capture is used.

`registerFeedbackContext` from `@pkgs/feedback/context` registers a named,
on-demand context provider with a cleanup function. Chess play and review provide
starting FEN, solution moves, current FEN, orientation, review position and hint
state. The browser adds page/device/build details, the bounded crash trail and
recent trace IDs. Providers have serialization/size isolation and a 500 ms
deadline, with missing evidence identified rather than blocking delivery.

## Local and hosted reports

The Vite plugin mounts `/api/feedback` ahead of product middleware. Local reports
use the filesystem ObjectStore rooted at this worktree's `.feedback/`, without
GitHub, internet, product API or database dependencies. Hosted reports use the
existing API object store with credentials required for durability. The platform
Worker handles this route before loading product bootstrap.

`report.json` is the authoritative normalized bundle, committed first. Companion
files are best effort, so interruption cannot erase a successfully saved report:

```text
.feedback/
  feedback-<id>/
    report.json
    report.md
    diagnostics.json
    reproduction.json
    AGENT_HANDOFF.md
  evidence/<attachment-id>
  evidence/<attachment-id>.json
  index/feedback-<id>.json
```

The bundle preserves observed and expected outcomes, reproduction steps, ordered
actions, initial/final context and attachment references. `AGENT_HANDOFF.md`
directs an agent to restore the starting state in the appropriate public harness,
write the expected product behavior in specs, demonstrate the reported failure,
and only then fix it. A video alone is not proof of a deterministic reproduction.

`GET /api/feedback/reports/<uuid>` returns the bundle; attachment URLs stream
stored bytes. UUID links are unguessable sharing links: anyone given a link can
read its evidence. Request origin, media type, upload size and attachment ownership
are checked. Attachment metadata is resolved from storage rather than trusted
client URLs. The browser uses injected HTTP and bounded deadlines throughout.

Optional backend-only `FEEDBACK_GITHUB_TOKEN` and `FEEDBACK_GITHUB_REPOSITORY`
(`owner/repository`) forward reports to GitHub with a bundle link. An absent token
or GitHub outage does not erase the durable report. Missing storage returns an
unavailable response; the browser keeps its draft and offers an emergency JSON
copy plus downloadable evidence. No external issue is created by checks.

```sh
bun feedback problem 'Board stops after a move' 'The move appears' 'Open the puzzle and drag e2 to e3'
bun feedback feature 'Finding recent puzzles is difficult' 'Show a recent puzzles list'
bun feedback --list
bun feedback --inspect <report-id>
```

The CLI uses the same API; `FEEDBACK_API_URL` overrides its default
`http://localhost:5173/api/feedback`. `--list` reads authoritative local reports,
including those whose companion writes were interrupted. Existing `.bugs/` data
is retained on disk; new reports use `.feedback/`.

Release policy: [repository checks](../../README.md#correctness-machinery).
