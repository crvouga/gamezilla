# Bug reporting

Behavior: [`specs/feedback/`](../specs/feedback/). The platform
entrypoints install reporting and crash capture before importing the product.
The reporting form has its own DOM root and isolated styles; it uses no product
providers, router, authentication, sync engine, database, or feature flags.

Use **Support**, or **Ctrl/Cmd+Shift+B**. `/report-bug` opens reporting alone
without importing the product. A static link also opens that page in another tab.
A synchronous infinite loop or a terminated renderer cannot execute any in-page
JavaScript; use the standalone page or the CLI from outside that failed page.

## Local reports

`bun dev` and `bun dev:client` mount `POST /api/feedback` before product
middleware. The endpoint writes directly to the current working repository's
`.feedback/` through the injected filesystem ObjectStore. No GitHub credentials,
internet connection, product API server, database, or external service is needed.
The browser always uses HTTP; it knows no destination adapter.

```text
.feedback/
  index/
    bug-<id>.json
  bug-<id>/
    report.md
    report.json
    diagnostics.json
```

`report.md` is the human entrypoint; `report.json` is the authoritative normalized
report. Each file is replaced by same-directory atomic rename, with JSON committed
first. Index entries are separate immutable files so concurrent reporters cannot
lose another report through a shared-index rewrite. If interrupted after the JSON
commit, a report remains recoverable even if its Markdown, diagnostics, or index
companion was not written. This protects against process interruption, not disk
loss or an unflushed filesystem after power failure.

`bun feedback 'Board freezes' 'The board stopped after my move'` calls the same root HTTP API. It defaults to the development endpoint at
`http://localhost:5173/api/feedback`; set `FEEDBACK_API_URL` for another
port or a hosted endpoint. The reporting backend must remain reachable.
`bun feedback --list` enumerates authoritative reports, including reports whose index
write was interrupted. Both operate on this worktree's `.feedback/`.

## Ports and adapters

`@pkgs/feedback/shared` owns the model and `IssueReporter` port. It has no
filesystem, UI framework, vendor SDK, or HTTP framework dependency. The local
adapter receives an ObjectStore; its wall filesystem is wired only at a backend
composition root. The fake adapter and GitHub adapter implement the same port.

The client calls one bounded HTTP API through a transport captured before the
product can replace or instrument global fetch. Optional diagnostics have a
500 ms deadline, size limits, serialization isolation and an unavailable marker.
Available page details and the bounded crash trail are captured automatically.
Telemetry is read lazily; automatic screenshots are currently unavailable and
recorded as such. No screenshot permission prompt blocks a basic report.

Reporting saves text as a recoverable draft before submission. If HTTP fails,
the form shows an emergency JSON copy and keeps the draft when browser storage
is available. It never claims a backend report was saved without a receipt.
A completely disconnected hosted browser cannot create a remote issue until it
can reach the backend; local reporting needs only its loopback HTTP endpoint.

## Hosted destination

The API Worker's platform entrypoint dispatches feedback reports before loading the
product server or its observability, auth, billing and database bootstrap.
Production uses the GitHub adapter through injected HTTP. Configure the existing
secret registry with `FEEDBACK_GITHUB_TOKEN` (a fine-grained token scoped to
Issues write on the destination repository) and `FEEDBACK_GITHUB_REPOSITORY`
(`owner/repository`). They are backend-only and included in the existing secret
push workflow. Missing credentials return an explicit unavailable response;
the client retains the emergency copy. No GitHub issue is created during checks.

The endpoint checks the configured web origin, accepts JSON only, caps streamed
request bytes, and normalizes text and diagnostics. It does not rely on a working
account. Future destinations replace the backend reporter port without changing
the client, diagnostic collection, crash handling or behavioral specs.

Validation uses the executable specs, adapter properties and existing filesystem
atomic-write checks; release policy is [`README.md`](../README.md#correctness-machinery).
