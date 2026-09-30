# Infrastructure

Every deployed resource is declared in **[`libs/infra/tofu`](../libs/infra/tofu)**
and changed only by **OpenTofu** (MPL-licensed, Linux Foundation). Nothing else
creates, updates or deletes infrastructure: no TypeScript provisioner, no
console clicks, no `wrangler` routes. The Biome rule
`no-infra-outside-tofu.grit` fails `lint` on vendor admin endpoints in
TypeScript.

## Layout

```
libs/infra/
  tofu/
    global.tfvars.json  what every environment shares: project, state bucket,
                        secrets project, repository (+ its required checks),
                        the Railway broker project + service ids
    modules/        env-agnostic building blocks (variables in, outputs out)
      state/          the state bucket + its credential (stateful)
      ci-identity/    GitHub Actions' Infisical OIDC machine identity
      repository/     GitHub repo settings, `main` protection, Actions variables
      naming/         physical names — patterns.json, shared with TypeScript
      object-store/   R2 bucket (stateful) + bucket-scoped S3 credential
      pubsub-project/ the ONE Railway project + shared EMQX service/volume
                      (stateful, global)
      pubsub/         the env's Railway environment of that project (stateful),
                      broker variables, custom domain, Cloudflare DNS
      trace-stack/    the ONE Grafana Cloud stack (stateful; free plan = 1 stack)
      observability/  per-env access policies + tokens on that stack
      database/       Neon: the env's branch of the one project (production
                      runs on the root branch) + its read-write endpoint →
                      DATABASE_URL, the Hyperdrive config the API Worker
                      connects through, and the pg_stat_statements extension
      secrets/        Infisical: asserts human secrets, keeps generated ones,
                      writes derived ones
      edge/           public hostnames → Workers (custom domains)
    stacks/
      bootstrap/      global, applied by a person: state, the shared secrets
                      environment, CI identity, repository
      fleet/          global, applied by Deploy: every env file's secrets
                      environment + its import of the shared one, the
                      OAuth relay's hostname (auth.<zone>), the private
                      spec-report bucket every env's API reads
                      (`bun check` publishes to it), and the Railway
                      broker project + service every env shares
      foundation/     everything before Worker code ships (+ secrets.json)
      edge/           custom domains, after the Workers exist
    envs/
      prd.tfvars.json the ONLY env-specific values
      dev.tfvars.json
  policy/stateful.rego  plan gate (conftest)
  scripts/tofu.ts       the only way tofu runs: plan | apply | drift | destroy
  scripts/destroy-env.ts  tears one standard environment down (infra:destroy)
apps/auth-relay/        the global OAuth callback relay Worker (auth.<zone>)
```

Modules and stacks never name an environment. Every stack reads
`global.tfvars.json`, then (foundation / edge) the environment's file. An environment is one
`envs/<env>.tfvars.json`: its name, name suffix, hostnames, account / project
ids and the ids of pre-existing resources to adopt (`imports`).

## Deploy chain

```
deploy:fleet   @apps/auth-relay#deploy → @libs/infra#apply:fleet   (global, once)
deploy:<env>   @libs/infra#apply:foundation  → @libs/runtime#migrate
  → @apps/room-server#deploy → @apps/server#deploy → @apps/product#deploy
  → @libs/infra#apply:edge → @libs/billing#billing:sync → health
```

Worker **code** (and Durable Object migrations) ships with `wrangler deploy`:
the Cloudflare provider's `cloudflare_workers_script` does not apply DO
migrations reliably. `wrangler.toml` is env-agnostic; `@libs/infra/public/wrangler`
renders it per environment (name, DO `script_name`) and refuses any
`deleted_classes`. Hostnames are the edge stack's, never wrangler's.

## Environments are cattle; data is never lost by accident

Every environment is rebuilt from its env file alone, and a
`protection: "standard"` one can be torn down completely on purpose. What
can never happen is losing data *by accident* — through an ordinary apply, a
broken config, or anything touching production. Four independent layers:

1. **Global** stateful resources (state bucket and credential, the Grafana
   stack, the repository, the shared secrets environment, the Railway broker
   project and its service) carry
   `lifecycle { prevent_destroy = true }`: no environment's teardown can
   reach them.
2. **Plan policy** — `scripts/tofu.ts` plans to a file, runs
   `policy/stateful.rego` on `tofu show -json`, and applies *that saved plan*
   only if nothing is denied. Deletion is **allow-listed**: only credential,
   DNS, routing, connection-config and derived-secret types may be deleted
   or replaced by an ordinary apply; any other type — including ones added
   later — is protected by default. In `protection: production` environments
   a plan deleting most of a type's instances is refused (mass-delete brake).
   The only way past it is a teardown (below), and the policy refuses every
   production teardown.
3. **Forget, never destroy** — to stop managing a stateful resource without
   tearing the environment down, use a
   `removed { from = … lifecycle { destroy = false } }` block.
4. **Assert-only** for what code must not create: the Neon project and its
   branches (one project, one branch per environment; the `database` module
   fails the plan unless `DATABASE_URL` points at an endpoint of the env's own
   branch), the Cloudflare zone and human-entered secrets.

Before every apply the encrypted state object is copied to
`backups/<stack>/<env>/<timestamp>.tfstate` in the state bucket.

`libs/infra/tests` pins all of it: the policy matches an independent model on
generated plans (teardowns included), every resource type in `tofu/modules`
is classified as deletable or protected, env files never share a stateful
identity, a standard env file adopts nothing (so it can be rebuilt), and the
secrets OpenTofu writes are exactly the registry's `managedBy: 'tofu'` ones.

## Tearing an environment down

```sh
bun run infra:destroy -- --env <env> --confirm <env>
```

`scripts/destroy-env.ts` refuses any env whose file says `protection:
"production"`, then runs the deploy in reverse, each step through
`scripts/tofu.ts destroy` (plan → policy with `teardown` → state backup →
apply that plan): edge custom domains → `wrangler delete` the api, web and
room Workers → empty the bucket → foundation (Neon branch and endpoint,
Hyperdrive, bucket, the env's Railway environment — its broker instance and
volume — trace tokens, secrets) → the env's fleet entries
(its secrets environment and shared import). A failed step is resumed by
rerunning.

The env file stays: the next Deploy (or `bun run infra:fleet &&
SECRETS_ENV=<env> bun run deploy`) rebuilds the environment from nothing, its
database a fresh branch of production's. To retire it, delete its env file and
`envs.ts` entry in a PR — deleting the file alone deletes nothing (the fleet
plan's secrets-environment delete is refused by the policy).

## State

S3 backend on the R2 bucket named in `global.tfvars.json` (`state.bucket`),
key `<stack>/<env>.tfstate` (`<stack>/global.tfstate` for bootstrap and
fleet), native lockfile, OpenTofu state + plan encryption (pbkdf2 → AES-GCM)
keyed by `TOFU_STATE_PASSPHRASE`. The bootstrap stack creates the bucket and
its credential (`TOFU_STATE_ACCESS_KEY_ID` / `TOFU_STATE_SECRET_ACCESS_KEY`)
and writes the credential once, to the shared secrets environment.

## Secrets

`libs/infra/tofu/stacks/foundation/secrets.json` classifies every secret the
stack touches:

| Kind | Who writes it | Examples |
|---|---|---|
| shared | a person, once, in the `shared` environment (`bun run secrets:seed`) | Google OAuth client, provider API tokens, `TOFU_STATE_PASSPHRASE` |
| human | a person, per environment (asserted present) | none today |
| generated | OpenTofu once; an existing value wins unless it is a committed placeholder (`secrets.json` `placeholders`) | `AUTH_SECRET`, EMQX credentials |
| derived | OpenTofu, from resource outputs | `DATABASE_URL`, `HYPERDRIVE_ID`, `S3_*`, `API_URL`, `OBSERVABILITY_*` |

Account-wide credentials live once in the `shared` Infisical environment
(created by bootstrap); the fleet stack gives every environment an import of
it, so a new environment inherits them and a rotation is one edit. A copy
held by an environment would shadow the import:
`libs/secrets/src/scripts/secrets-reconcile-shared.ts` (Deploy's
`deploy:fleet` job) promotes unanimous copies into `shared` and deletes the
rest, failing on any copy that disagrees. OpenTofu never deletes a human
secret, and unknown keys in the store are left alone.

## What stays outside OpenTofu, and why

| Thing | Owner | Why not OpenTofu |
|---|---|---|
| Worker code + Durable Object migrations | `wrangler deploy` in each app's `deploy` | The Cloudflare provider does not apply DO migrations reliably (cloudflare/terraform-provider-cloudflare#5701, #5898). Names come from `@libs/infra`; hostnames are the edge stack's. |
| Postgres tables | `@libs/runtime#migrate` | Application schema, versioned with the code. |
| Billing catalog (Stripe/Paddle products, prices, webhooks) | `@libs/billing#billing:sync` | Paddle has no provider, and the offer is product data the code reads. |
| The Neon project (and its root branch), the Cloudflare zone, shared secrets, `TOFU_STATE_PASSPHRASE` | a person, once | Must never be created (or rotated) by code; asserted instead. |
| The Google OAuth client and its ONE redirect URI (`https://auth.gamezilla.app/api/auth/callback/google`) | a person, once | Google's console has no API. Every environment sends that callback and tags its OAuth state with its name; the global relay Worker (`apps/auth-relay`, hostname from the fleet stack) forwards each callback to its environment, so a new environment needs no console edit and no environment depends on another. |

## Postgres through Hyperdrive

The API Worker never dials Neon itself. `modules/database` creates one
Cloudflare Hyperdrive config per environment on the branch's direct
(unpooled) endpoint and writes its id to the secrets store as `HYPERDRIVE_ID`;
`@apps/server#deploy` renders it into the Worker as the `HYPERDRIVE` binding
(`@libs/infra/public/wrangler`), and the Worker opens Postgres on
`env.HYPERDRIVE.connectionString` (`postgresConnectionString` in
`@libs/server-app/config/env`). Hyperdrive keeps warm, pooled connections next
to the database, so a request skips the TLS and auth handshake. Query caching
is **off**: sync hydration must read its own writes. `DATABASE_URL` stays the
database's identity — migrations and tooling connect with it, and the
non-production URL policy always checks it. `wrangler dev` and the localhost
stack have no binding and connect directly.

## MQTT broker (Railway)

One Railway project (`global.tfvars.json` `railway.project_id`) runs every
environment's EMQX broker. The fleet stack owns the project and its one
`emqx` service (`modules/pubsub-project`: source repo, root directory,
region, volume), always adopting them by the ids in the global file. Each
environment is a **Railway environment** of that project, named after its
env file's `suffix` — production is the project's default `production`
environment — created by its foundation stack (`modules/pubsub`) along with
the service's variables (its broker credentials) and custom domain in that
environment. Only a **duplicate** of an environment holds an instance of the
service (build, region, its own volume): the provider's `railway_environment`
makes an empty one, whose custom domain fails with "ServiceInstance not
found". So every non-production environment is created by duplicating
`production` (`modules/pubsub/clone-environment.sh`, run by a `terraform_data`
provisioner; it reads the clone's id back with a read-only `http` data source
and deletes the clone on teardown). An existing environment of that name with
no service instance — one the provider made — is deleted and cloned afresh;
production and the clone source never are. Drop the script once the provider can
clone (terraform-provider-railway PR #83).

Environments share the service's configuration, never its data: variables,
volume contents and hostnames are per Railway environment. Tearing a
standard environment down deletes only its Railway environment.

Environments used to own a Railway project each. The foundation stack now
forgets those (`removed`, never a delete); production's project became the
shared one. A standard environment that had its own project (dev's
`gamezilla-dev`) moves on its next deploy: its broker variables and custom
domain are replaced into its new Railway environment of the shared project.
Before that deploy, delete dev's empty `development` environment in the
Railway dashboard (an earlier attempt made it; the clone script refuses to
reuse it), and delete the old project, no longer managed, once by hand after
the deploy is healthy.

## Object storage

Blob storage (the TTS audio cache, …) is S3-compatible through
`@pkgs/object-store-s3`. The API Worker reads `S3_ACCESS_KEY_ID` /
`S3_SECRET_ACCESS_KEY` / `S3_BUCKET` / `S3_ENDPOINT` / `S3_REGION` at boot and
injects a store that always prefixes keys with the product namespace
(`PRODUCT_CONFIG.objectStore.namespace`, e.g. `gamezilla/`) before any feature
prefix; the transport rejects any key outside it. Without S3 secrets the
Worker falls back to an in-memory store. Each environment's R2 bucket and
bucket-scoped credential come from `modules/object-store` (endpoint
`https://<accountid>.r2.cloudflarestorage.com`, region `auto`). Worker
secrets upload with the version (`wrangler deploy --secrets-file`), which
never removes old names: after renaming a Worker secret, delete the stale
binding once. Every secret the app needs is declared in
`libs/secrets/src/shared/secrets/registry.ts`; `bun health` validates each
one live.

## Commands

```sh
bun run infra:bootstrap                         # global stack; a person, rarely
bun run infra:fleet                             # global; Deploy runs it first
bun run --filter @libs/infra plan:foundation   # SECRETS_ENV picks the env
bun run --filter @libs/infra plan:edge
bun run --filter @libs/infra apply:foundation  # deploy runs these; CI only
bun run --filter @libs/infra health            # drift: live == declared
bun run infra:destroy -- --env <env> --confirm <env>   # standard envs only
```

Run through `secrets-run` (the root `deploy` does) so provider credentials
are in the environment.

## Adding an environment (staging, a replica, …)

1. Create `libs/infra/tofu/envs/<env>.tfvars.json` (copy `dev`, drop its
   `imports`): a new `env`, `display_name` and `suffix`, `protection:
   "standard"`, hostnames one level under the zone (Universal SSL). Register
   it in `libs/infra/src/public/envs.ts`.
2. Merge. Nothing else — no console, no seeding:
   - `deploy:fleet` creates the env's Infisical environment and its import of
     the shared credentials;
   - `deploy:<env>` (foundation) creates its Neon branch of production's
     root branch (a copy of production's data) and endpoint, derives
     `DATABASE_URL`, mints its generated secrets, R2 bucket, its Railway
     environment of the broker project (named after its `suffix`) and trace
     tokens, then migrates, ships the Workers, binds the hostnames and runs
     `health`;
   - Google sign-in works immediately: `deploy:fleet` redeploys the OAuth
     relay with the new env as a target before any env deploys, and the
     env's API Worker is rendered with the relay's callback and its own state
     tag.
   No workflow edit: Deploy and Health read the env files
   (`scripts/workflow-env-matrix.ts`). Deploy runs every `protection:
   "standard"` env in parallel, then — only if all succeeded — every
   `"production"` env; Health probes every env hourly.

To rehearse before merging: `bun run infra:fleet`, then
`SECRETS_ENV=<env> bun run deploy` ([CI.md](CI.md#workflows)). Tear it down
again with `bun run infra:destroy` ([above](#tearing-an-environment-down)).

## First deployment (adopting what already exists)

Everything that existed before OpenTofu is **adopted, never recreated**: the
env files' `imports` (and `global.tfvars.json` `global_imports`) name every
existing bucket, Railway project/service/environment/domain, DNS record, custom domain,
Infisical environment, GitHub setting and stored secret. An `import` of a
resource already in state is a no-op; once a standard env's first apply has
adopted everything, delete its `imports` — a stale id would break its rebuild
after a teardown (`tests/env-files.test.ts` requires standard envs to have
none).

The chicken-and-egg problems and how each is broken:

| Problem | Resolution |
|---|---|
| State needs a bucket; the bucket is a resource | The bootstrap stack's first apply uses a local backend, creates the bucket and its credential, writes the credential to the shared secrets environment, then migrates its own state into the bucket (`scripts/bootstrap-backend.ts`). Detected by `TOFU_STATE_ACCESS_KEY_ID` being absent. |
| State is encrypted; the key cannot come from state | `TOFU_STATE_PASSPHRASE` is a human secret, seeded before anything runs. |
| CI authenticates to Infisical with the identity the bootstrap stack manages | Bootstrap is applied by a person with their own credentials, never by CI. It creates a new OIDC identity (the provider cannot import an existing OIDC binding) and repoints `SECRETS_IDENTITY_ID`; runs in flight keep using the old identity, which a person deletes afterwards. |
| Generated secrets already exist | A stored value wins over the generator, so adopting never rotates `AUTH_SECRET` or broker credentials. Two exceptions are minted fresh: `secrets.regenerate` lists names whose value was copied from another environment (dev's broker credentials came from prd), and `stacks/foundation/secrets.json` `placeholders` lists the values committed to git for local sidecars (the EMQX sidecar's keys), which are public and must never reach a deployed broker. `specs/spaces/live-updates.feature` re-reads the store before probing, so a rotation lands in the same deploy. |
| Secrets OpenTofu writes already exist | Imported (`imports.foundation.secrets`), so the first apply updates rather than colliding with "already exists". |
| Custom domains need their Worker | Edge runs after the Worker deploys; wrangler (with no `routes`) never touches existing custom domains in between. |
| A new broker / stack takes minutes to come up | The broker and traces synthetic checks (`specs/spaces/live-updates.feature`, `specs/runtime/request-records.feature`) poll through a warm-up window. |

Health checks for the human-managed settings (`bun health`, every
environment, hourly): `specs/auth/sign-in.feature` asks Google
whether it accepts the one shared OAuth callback and, if not, names the exact
redirect URI to add, and every environment proves the relay returns each
other environment's callbacks home; `specs/runtime/declared-environment.feature` plans every stack and fails on
drift or on a missing / inactive Grafana stack.

Runbook:

1. Seed human secrets in every environment: `TOFU_STATE_PASSPHRASE` (same
   value everywhere), `NEON_API_KEY`, `GRAFANA_CLOUD_API_TOKEN`,
   `RAILWAY_TOKEN`, `GITHUB_ADMIN_TOKEN` (prd) — `bun run secrets:seed -- --env <env>`.
   Set `global.tfvars.json` `neon_project.project_id` and each env file's
   `neon.branch_id`.
2. `bun run infra:bootstrap` (logged in with `infisical login`).
3. Review, read-only, per environment:
   `SECRETS_ENV=prd bun run libs/secrets/src/scripts/secrets-run.ts -- bun run --filter @libs/infra plan:foundation`
   (and `plan:edge`, and `SECRETS_ENV=dev`). Expect imports and updates, **0 to destroy**; the policy
   gate refuses anything else anyway.
4. Merge. The Deploy workflow applies every standard env (dev, a new replica) and then prd.
