# Preview environments

Every pull request gets its own public URL serving that pull request's build of
the whole system. Nothing runs on a server: a Preview is static files, and the
system runs inside the visitor's browser tab.

```
https://preview.<domain>                   the main branch
https://pr-<number>.preview.<domain>       a pull request
https://storybook.<domain>                 the main branch's Storybook
https://pr-<number>.storybook.<domain>     a pull request's Storybook
```

- **The domain.** `preview.<domain>` is a custom domain of the preview Worker
  with Previews enabled (`apps/preview-ts/wrangler.toml`), so Cloudflare
  serves the Worker's own deployment there and each Preview under its name.
  A push to main deploys the Worker (`mise run preview:main`); that
  deployment is also what attaches the domain, so until the first one a pull
  request's deploy makes it once from its own bundle.
- **The fallback.** A pull request's URL is chosen before its bundle is built:
  the custom domain when `pr-<number>.preview.<domain>` already answers over
  HTTPS, and otherwise
  `https://pr-<number>-<namespace>-preview.<account>.workers.dev` — before the
  domain is attached, while its certificate is being issued, or if the
  account cannot issue one for a name two levels below the zone (Cloudflare's
  free certificates cover one level; deeper names can need Advanced
  Certificate Manager). The `## Preview` section always names the URL the
  bundle was built for.
- **Storybook.** `storybook.<domain>` is the Storybook site
  (`apps/storybook-ts`), which the Release workflow deploys from main; the
  preview commands never deploy it. Its hostname is a custom domain with
  Previews enabled (`renderStorybookWranglerConfig`), which that release
  deployment applies, so a pull request's Storybook is
  `pr-<number>.storybook.<domain>` once it answers, and
  `https://pr-<number>-<namespace>-storybook.<account>.workers.dev` until
  then. Storybook is not built for an origin, so its URL is chosen when it is
  uploaded.

## What a Preview is

- **Hosting.** One assets-only Cloudflare Worker (`apps/preview-ts/wrangler.toml`)
  with one [Worker Preview](https://developers.cloudflare.com/workers/previews/)
  per pull request, named `pr-<number>`. There is no Worker script, no Durable
  Object, no database, no bucket, no binding and no secret.
- **The system.** The harness (`apps/harness-ts`) is a site of its own, apart
  from the application: `bootProductHarnessSession` runs `APP_SYSTEM` with
  `runtime: 'in-process'` — the API server fleet behind its load balancer,
  Postgres, rooms, pub/sub and several client actors — in the tab. Everything
  external is a mockingbird emulator from `libs/harness-ts`: identity provider,
  billing, object store, LLM and the clock. These are the same abstractions the
  test suites drive; a Preview adds none of its own.
- **The seed.** A world nobody has opened before starts with two people,
  `alice` and `bob`, each signed in on their own device and already friends
  (`apps/harness-ts/src/product-harness-friends-seed.ts`): each walks the
  emulated identity provider's sign-in and the friendship is the ordinary
  request and its acceptance, sent to the in-tab API. A world restored from
  the browser's saved snapshot is left as it was.
- **The console.** The page shows one client's app at a time, edge to edge,
  with nothing around it, under one small button that floats over it and can
  be dragged out of the way. A tap on the button goes on to the next client's
  app; holding it (or a right click, or Down on the keyboard) opens the menu:
  every client and every node behind the apps by name (the load balancer with
  its routes, each API server with its SQL notebook and logs, pub/sub topics,
  rooms), adding a client, and the harness's own tools (nodes, snapshots, and
  commands for crashing, restarting and partitioning nodes and controlling the
  clock). Every client's app keeps running while another is on show, and
  which panel is on show is kept in the page address, so a link reopens it.
- **The build.** A Preview bundle is the built `apps/harness-ts`.
  `preview.json` in the bundle names the Preview and the commit it was built
  from. The harness is the one page at `/` and keeps its state in the query
  string, so it needs no single-page fallback (Cloudflare applies none to an
  assets-only Preview): anything else is a 404.
- **Storybook.** Each pull request also gets its build of the component
  library: a Preview, of the same name `pr-<number>`, of the Storybook site's
  own Worker (`apps/storybook-ts`). It serves a copy of the canonical
  Storybook build (`@pkgs/ui-root-harness-ts#storybook:build`, which Turborepo
  builds or restores while the harness uploads) plus its own
  `preview.json`. A Preview never changes what `storybook.<domain>` serves;
  only a release does. Built, gated, uploaded, checked, removed and swept
  together with the harness Preview: one deploy is both sites.

## Commands

The same commands run on a laptop, for an agent, and in the Preview workflow.
The pull request is `PREVIEW_PR=<number>`, or the one for the current branch.

| Command | What it does | Needs |
| --- | --- | --- |
| `mise run preview:url` | Print the Preview URL from the pull request description | `gh` |
| `mise run preview:test` | Check the deployed Preview and Storybook over HTTP | `gh` |
| `mise run preview:build` | Build the harness bundle and gate it | Cloudflare read, or `PREVIEW_URL` |
| `mise run preview:deploy` | Build, gate, upload, check | Cloudflare deploy credential |
| `mise run preview:main` | Build this checkout and deploy it as the main branch's | Cloudflare deploy credential |
| `mise run preview:destroy` | Delete the Preview; verify it is gone | Cloudflare deploy credential |
| `mise run preview:sweep` | Delete orphaned and expired Previews | Cloudflare deploy credential |

`mise.toml` pins the tools and names the tasks; each task is the root script of
the same name, which is a Turborepo run of
`apps/preview-ts/scripts/preview.ts`. Nothing is configured in a dashboard.

There is no `seed`, `reset` or `inspect`. A Preview holds no state to seed or
wipe, and there is no server to inspect — see "State and reset".

## Lifecycle

`.github/workflows/preview.yml` runs one job per event:

| Event | Action |
| --- | --- |
| Pull request opened, reopened, new commit | build → gate → upload → check |
| Pull request closed or merged | delete the Preview, confirm it is gone |
| Every six hours, or manual dispatch | sweep |

- **Decided from now, not from the event.** `ci plan` reads the pull request as
  it is when the run starts (`decidePreviewAction`): a run for a commit that is
  no longer the head is skipped, and a run for a pull request that has since
  closed removes instead of deploying. The plan is taken again immediately
  before the upload.
- **Older never replaces newer.** Runs for one pull request share a concurrency
  group, and a newer commit cancels the run for the one before it, so the
  latest commit is what gets built, at once. With the re-read above, a run for
  an older commit that got as far as uploading skips instead.
- **Fast, every commit.** The checkout leaves out the reference screenshots
  (four fifths of the repository). The harness is built alone and uploaded
  while Storybook is built or restored from the Turborepo cache and uploaded
  beside it; the pull request says the harness is live the moment it is.
- **A failed deploy keeps the last working version.** The bundle is checked on
  disk with the same checks the deployed Preview must pass, before anything is
  uploaded. A commit that does not build or fails that gate is never uploaded,
  and the pull request shows the commit still serving beside the one attempted.
  The same checks run again against the deployed URL; if they fail there, the
  new commit is already serving and the pull request says `deployed, but
  failing its checks`.
- **Idempotent.** Deploying the same commit again uploads the same files;
  deleting a Preview that is gone succeeds.
- **Nothing accumulates.** Closing or merging a pull request deletes both of
  its Previews and its GitHub deployments, and each deploy deletes the
  deployments of the commits before it.
- **Orphans.** The sweep lists both Workers' Previews and deletes every `pr-<n>`
  whose pull request is not open, and every one whose pull request has had no
  activity for 7 days (`PREVIEW_RETENTION_MS`). An expired Preview comes back
  with the next commit or a reopen.

## On the pull request

The workflow owns one block of the description, between
`<!-- preview:start -->` and `<!-- preview:end -->`; the rest is returned byte
for byte. It carries the status, the URL, the Storybook URL, the deployed commit (and the
attempted one when they differ), the deploy run, and how to reset. Each deploy
is also a GitHub deployment in the transient `preview` environment, with
`in_progress`, `success` or `failure` and a link to the run; removal marks
them `inactive`.

The `preview` check is **advisory** (`required-checks/preview.json`):
`verify:end` waits for it and reports it, and never fails on it, so a
Cloudflare outage cannot block a merge.

## For agents

1. `mise run preview:url` — the URL, from pull request metadata. Open it.
2. Drive it with any browser automation: it is an ordinary public page, and a
   fresh browser context is a fresh system.
3. `mise run preview:test` — confirms which commit is deployed and that it
   serves.

No local dev server is involved. The same harness is what
`bun run dev:harness` serves, so what an agent sees is what the pull request
built.

## State and reset

All state lives in the visitor's browser, in the origin-private file system and
IndexedDB of the Preview's own origin. That gives each pull request its own
state (a browser never shares storage between origins), and each visitor their
own.

- **Reset:** clear the site data for the Preview URL, or use a fresh profile.
- **Cleanup:** deleting the Preview removes everything Cloudflare holds for it —
  its files. State in visitors' browsers was never on Cloudflare; it stays on
  their machines until they clear it, and is unreachable once the origin stops
  serving. This is the one thing `destroy` does not remove.

## Security

- **No secrets ship.** The bundle is built from public values only; the
  `no server` check fails any Preview where something answers an API route.
- **No path to production.** A Preview makes no network request to any backend;
  every vendor is an in-tab emulator. There is nothing server-side to
  misconfigure.
- **Forks never deploy.** The job is skipped for pull requests from forks, and
  `decidePreviewAction` refuses them again; GitHub withholds OIDC and secrets
  from fork runs regardless.
- **Credentials.** The job reads the `dev` secrets environment through OIDC,
  never production. Pull request code from this repository does build in a job
  holding the Cloudflare deploy credential, as it does in Verify PR; scope that
  token to Workers Scripts on the one account.
- **No admin surface.** There are no reset or diagnostic endpoints to protect.

## Cost and limits

| | Free | Paid ($5/mo) |
| --- | --- | --- |
| Static asset requests | free, unlimited | free, unlimited |
| Previews per Worker | 100 | 500 |
| Files per upload | 20,000 | 100,000 |
| File size | 25 MiB | 25 MiB |

The bundle is about 330 files and 26 MB, its largest file under 9 MB; Storybook
is about 900 files and 26 MB. There is
no compute, storage or egress charge at any traffic level, and nothing runs
while nobody is looking. The binding limit is open pull requests at once (100
on the free plan); the 7-day retention keeps well under it. GitHub Actions
time is the only recurring cost: one build per push.

## Limits of this design

- **Nothing is shared.** Two people opening the same Preview get two separate
  systems. Multiplayer is exercised between the harness's own client actors in
  one tab, not between visitors.
- **Emulated vendors only.** Real identity providers, payments and LLMs are not
  reachable, by design.
- **Vendors have no panels yet.** The console shows clients, servers, the load
  balancer, pub/sub and rooms; the identity, billing, storage and LLM emulators
  are running but not yet inspectable as nodes.
- **Remote checks are HTTP only.** `preview:test` proves what is served, not
  that the harness boots in a browser. Open it, or drive it with browser
  automation, for that.
