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
- **Clients and emulators.** The menu adds a client and removes one (the
  last stays). It also lists every vendor emulator (Google and Apple sign-in,
  payments, object storage, the language model): choosing one shows that
  Mockingbird emulator's own dashboard, with its state, journal, clock,
  latency and faults. The emulators run in the page, so a small service
  worker (`apps/harness-ts/public/emulator-gateway-sw.js`) gives each an
  address under `/__emulators/` and hands those requests to the page; it
  touches nothing else. The harness sends no email, SMS or push through an
  emulator yet, so there is no notification inbox to show.
- **The build.** A Preview bundle is the built `apps/harness-ts`, which
  depends on its sources alone: it names no commit and no address (the API is
  the page's own origin, read where the bundle runs), so Turborepo restores
  it for every commit that changes none of them. The deploy adds what does
  depend on the commit: a stamp in the page (`globalThis.__BUILD__`),
  `preview.json` (the Preview and its commit), and the compiled messages at
  `/messages.js`, which the bundle loads instead of carrying. The harness is
  the one page at `/` and keeps its state in the query string, so it needs no
  single-page fallback (Cloudflare applies none to an assets-only Preview):
  anything else is a 404.
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
| `mise run preview:build` | Build or restore the harness bundle, make it this Preview's and gate it (fatal only for main) | `gh` |
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
| Pull request opened, reopened, new commit | build or restore → gate (warns) → upload → check |
| Pull request closed or merged | delete the Preview, confirm it is gone |
| Every six hours, or manual dispatch | sweep |

- **Decided from now, not from the event.** The run reads the pull request as
  it is when it starts (`decidePreviewAction`): a run for a commit that is
  no longer the head is skipped, and a run for a pull request that has since
  closed removes instead of deploying. The pull request is read again before
  the upload, unless the bundle was ready within seconds of the first read.
- **Older never replaces newer.** Runs for one pull request share a concurrency
  group, and a newer commit cancels the run for the one before it, so the
  latest commit is what gets built, at once. With the re-read above, a run for
  an older commit that got as far as uploading skips instead.
- **Never broken by a change to the workflow.** GitHub runs the workflow of
  the pull request's merge with main, and the workflow runs a command of the
  commit it checks out. A head whose `preview.yml` differs from the one
  running is therefore built from that merge, where the two agree, and the
  run says so in a notice; every other head is built as it is.
- **Fast, every commit.** A commit is live about 25 seconds after it is
  pushed when it changes nothing a bundle reads, and about 30 to 35 when it
  does; five of those are GitHub starting the machine. Nothing waits for
  anything it does not need:
  - *One step, no action.* The checkout and the install start together. The
    checkout leaves out the reference screenshots (four fifths of the
    repository) and writes the package manifests first, which is all the
    install reads. The install is straight from the registry, runs no
    script, and runs none of the repository's postinstall generation.
  - *Secrets in half a second.* The command reads the three secrets a deploy
    uses over the run's own OIDC token, not the environment through an
    action. The Cloudflare credential never reaches a build.
  - *The build starts first.* A push almost always deploys, so the build
    starts before the pull request is read, and is stopped on the rare run
    that needs none. GitHub is told over HTTP, beside the work, never before
    it.
  - *A bundle is restored unless its sources changed* (above).
  - *A changed bundle is built from what did not change.* Most of a build is
    Babel over modules a pull request never touched; the build keeps what it
    made of each (`.cache/vite-transform`), the main branch's Preview serves
    that as `/transforms.bin`, and every run starts from it. The messages
    compile beside the bundle, not before it.
  - *Three round trips to deploy.* A site goes to its Preview through the
    Cloudflare API directly (`src/cloudflare-deploy.ts`): which files are
    missing, those files, the deployment. Only the Worker itself, on a push
    to main, is deployed with `wrangler`.
  - *Storybook beside it.* The harness is uploaded while Storybook is built
    or restored and uploaded; the pull request says the harness is live the
    moment it is.
- **Best effort: whatever builds is deployed.** The bundle is checked on disk
  with the same checks the deployed Preview must pass, before it is uploaded.
  For a pull request a failing check is a warning, not a stop: the bundle is
  uploaded anyway, so the Preview always shows the latest commit that built,
  and failing pull request checks never hold it back. The same checks run
  again against the deployed URL. If either run failed, the new commit is
  serving and the pull request says `deployed, but failing its checks` with
  the reasons; the GitHub deployment is marked failed and the run ends red,
  after the upload. Storybook follows the same rule, and never holds the
  harness Preview back.
- **Nothing built keeps the last working version.** Only a commit that does
  not build (the Vite build fails) has nothing to upload; the Preview keeps
  serving its previous commit and the pull request shows it beside the one
  attempted.
- **The main branch's Preview is strict.** `preview.<domain>` is deployed only
  from a commit that passes the gate, so it keeps its last working version.
- **Idempotent.** Deploying the same commit again uploads the same files;
  deleting a Preview that is gone succeeds.
- **Nothing accumulates.** Closing or merging a pull request deletes both of
  its Previews and its GitHub deployments, and each deploy deletes the
  deployments of the commits before it.
- **Orphans.** The sweep lists both Workers' Previews and deletes every `pr-<n>`
  whose pull request is not open, and every one whose pull request has had no
  activity for 7 days (`PREVIEW_RETENTION_MS`). Past 80 Previews at once
  (`PREVIEW_CAPACITY`, under the free plan's 100) it also removes those of
  the pull requests longest without a change. An expired Preview comes back
  with the next commit or a reopen.

## On the pull request

The workflow owns one block of the description, between
`<!-- preview:start -->` and `<!-- preview:end -->`, and keeps it at the very
top: put there when missing, moved there when found elsewhere. Its first line
is the status and the links to the Preview and its Storybook, so they are one
glance away on every pull request; a failure's reason is said under it; the
commits, the deploy run and how to use a Preview are folded below. The
author's text follows the block as written. Each deploy is also a GitHub
deployment in the transient `preview` environment, with `in_progress`,
`success` or `failure` and a link to the run; removal deletes them.

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
- **Credentials.** The job reads three secrets of the `dev` environment
  (Cloudflare's account and token, the Turborepo cache token) through OIDC,
  never production, and only after the install has ended. Pull request code
  from this repository builds in that job, and a build is given the cache
  token alone: the Cloudflare and GitHub tokens stay with the process that
  deploys. Scope the Cloudflare token to Workers Scripts on the one account.
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
on the free plan); the 7-day retention and the sweep's capacity keep under
it. GitHub Actions time is one build per push, on standard runners, which
cost a public repository nothing.

Previews stay on the free plan by construction (`apps/preview-ts/src/free-plan.ts`):

- **Static files only.** A deploy refuses a Worker config that declares
  anything else (a Worker script, a binding, a Durable Object, a variable, any
  setting not known to be free), for both sites.
- **Within the free limits.** The `free plan` check of the gate fails a built
  site with more files, or a larger file, than one free upload takes, so the
  answer to a bundle that grew is a smaller bundle, never a paid plan.
- **Never more Previews than the plan holds.** The sweep's capacity, above.

## Limits of this design

- **Nothing is shared.** Two people opening the same Preview get two separate
  systems. Multiplayer is exercised between the harness's own client actors in
  one tab, not between visitors.
- **Emulated vendors only.** Real identity providers, payments and LLMs are not
  reachable, by design.
- **Remote checks are HTTP only.** `preview:test` proves what is served, not
  that the harness boots in a browser. Open it, or drive it with browser
  automation, for that.
