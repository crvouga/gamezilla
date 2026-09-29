# `@pkgs/harness-report`

Reports of `@pkgs/harness` runs, object store → API → client: a shared store
keyed by commit, the read side an API serves from it as Server-Sent Events,
and the SolidJS + TailwindCSS viewer that renders the stream as it lands.

## Flow

```ts
// CI, after a suite ran (`@pkgs/harness-report/remote/publish`):
await openCommit(store, { sha, branch, runUrl, frames, startedAtMs, frameCss });
await publishSource(store, { sha, packageDir: 'libs/chess', bucket: 'part-0', local });
await closeCommit(store, { sha, endedAtMs });

// An API (`@pkgs/harness-report`): encode each event with `encodeSseEvent`.
listCommits(store, { limit, cursor });
commitEvents(store, sha, { clock, timers, pollMs, tailMs }); // commit, then sources
testEvents(store, { sha, source, testId }); // a test, then its frame files

// The browser (`@pkgs/harness-report/client`):
<RemoteReportsApp http={http} timers={timers} apiBase={apiBase} sha={sha} onOpen={open} />
```

`store` is any `ObjectStore` scoped to `REPORTS_ROOT_PREFIX`; `local` is the
bucket a `bun test` run wrote (`runs/latest/tests/<testId>/…`). A source's
tests are written before its record, so a reader that sees the record can read
every test it names. A running commit's stream re-lists its sources and sends
each new one as it lands; a reconnect passes the sources it holds and never
gets them again. The key layout is in `src/remote/keys.ts`.

The list fills in source by source; a test's steps and frame files stream in
the first time it is opened (`ReportTestLoader`), so a commit's reports never
have to fit in one download.

## Viewer

The viewer is keyboard-first: `Ctrl/Cmd-K` opens a searchable command palette,
`←` / `→` step frames, `↑` / `↓` jump between steps, `N` / `Shift+N` cycle
failures, `Home` / `End` and `Space` (play) cover the rest. The timeline is a
native range control with coalesced drag updates and failure / press markers;
the URL hash follows on a trailing debounce.

Each client panel keeps **one** sandboxed (`allow-same-origin`, no scripts)
iframe for the whole session: `frameCss` and fonts load once, and every frame
swaps the parsed snapshot DOM in place (`lib/snapshot-surface.ts`), so
scrubbing never flashes. Panels are keyed by actor id; a client without a
snapshot in the current frame shows its latest earlier one, dimmed.

Press highlights come from `ReportFrame.hit`, set only on the frame captured
right before a UI step acts. The viewer resolves `hit.path` against that
snapshot with the driver's chained first-match semantics and draws a single
overlay from real layout; if the target is absent it says so instead of
guessing.

UI suites (`html` / `png`) get phone panels + press overlays; headless suites
(`json` / `text` / `bytes`) get a document stage.

## Entries

| Import | Surface |
| ------ | ------- |
| `@pkgs/harness-report` | key layout, wire protocol + SSE codec, read side (Worker-safe) |
| `@pkgs/harness-report/remote/publish` | `openCommit` / `publishSource` / `closeCommit` (CI) |
| `@pkgs/harness-report/client` | `RemoteReportsApp`, `createRemoteReport`, `HarnessReportApp` |

## Layout

```
src/
  remote/        store keys, protocol, read + publish sides, streamed client
  app/           Solid root + hash routing + keyboard
  components/    header, steps, toolbar, scrubber, phone/doc stages
  views/         test list, one test
  lib/           pure helpers (frames, format, hash, phone)
```
