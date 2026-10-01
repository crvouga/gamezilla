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
listSourceRecords(store, sha); // cacheable once the commit is complete
readTestReport(store, { sha, source, testId }); // timeline, no frame files
readFrameBody(store, { sha, source, testId, file }); // one frame file

// The browser (`@pkgs/harness-report/client`):
<RemoteReportsApp
  http={http}
  timers={timers}
  apiBase={apiBase}
  sha={sha}
  cache={cache}
  onOpen={open}
/>
```

`store` is any `ObjectStore` scoped to `REPORTS_ROOT_PREFIX`; `local` is the
bucket a `bun test` run wrote (`runs/latest/tests/<testId>/…`). A source's
tests are written before its record, so a reader that sees the record can read
every test it names. A running commit's stream re-lists its sources and sends
each new one as it lands; a reconnect passes the sources it holds and never
gets them again. The key layout is in `src/remote/keys.ts`.

The list fills in source by source. Opening a test fetches its timeline only;
each frame file is fetched when that frame is shown, and the ones just beside
it, so a commit's reports never have to fit in one download. Commits, sources,
timelines and the snapshot stylesheet go through a TanStack Query cache that
persists across visits. Frame bytes live in a separate cache (IndexedDB in the
product, a map in tests) and are not written into that document. A finished
commit's JSON and frame files are immutable; a running commit is `no-store`.

## Viewer

The viewer is keyboard-first: `Ctrl/Cmd-K` opens a searchable command palette,
`←` / `→` step frames, `↑` / `↓` jump between steps, `N` / `Shift+N` cycle
failures, `Home` / `End` and `Space` (play) cover the rest. The timeline is a
native range control with coalesced drag updates and failure / press markers;
the URL hash follows on a trailing debounce.

Each client panel keeps **one** shadow tree for the whole session (no iframe):
`frameCss` loads once, and every frame swaps the parsed snapshot DOM in place
(`lib/snapshot-surface.ts`), so scrubbing never flashes. Panels are keyed by
actor id; a client without a snapshot in the current frame shows its latest
earlier one, dimmed.

Press highlights come from `ReportFrame.hit`, set only on the frame captured
right before a UI step acts. The viewer resolves `hit.path` against that
snapshot with the driver's chained first-match semantics and draws a single
overlay from real layout; if the target is absent it says so instead of
guessing.

Every frame paints in a phone panel. A UI snapshot (`html` / `png`) is that
panel; a press overlay is drawn on the HTML. A frame with no UI snapshot —
including a Quint step, which also keeps a model card beside any UI it
captured — is painted from the step's recorded state (`name = value` as a
table, plus the step and frame durations). Other captured blobs stay in the
aside. The test list and the commit list share one catalog: search, status,
group and sort, with duration on each row.

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
  components/    header, steps, toolbar, scrubber, phone stage, catalog
  views/         test list, one test
  lib/           pure helpers (frames, format, hash, phone)
```
