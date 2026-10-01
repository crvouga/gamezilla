# Infrastructure

Growth adds usage and cost. It does not add servers, a migration, or a new
shape of the system.

## Hard requirements

- **OpenTofu.** Every deployed resource is declared in
  [`libs/infra/tofu`](../libs/infra/tofu). Nothing else creates, updates, or
  deletes infrastructure: no TypeScript provisioner, no console clicks, no
  `wrangler` routes. `no-infra-outside-tofu.grit` fails `lint` on vendor
  admin endpoints in TypeScript.
- **Web scale.** The same architecture is the path to GitHub, YouTube, or
  Chess.com scale. Workers, the CDN, Durable Objects, R2, PlanetScale Neki,
  and AWS IoT Core each already run at that size.
- **Zero ops.** No servers, clusters, replicas, shards, or capacity to
  manage. There is no node to patch and no pool to size.
- **No scale events.** A bigger day is a bigger bill. It is not a reshard,
  a region add, or a broker upgrade.

## Stack

| Need | Service | Why |
| --- | --- | --- |
| API / compute | Cloudflare Workers | Globally distributed compute with no instances, regions, load balancers, or autoscaling. |
| CDN / frontend | Cloudflare CDN | Edge delivery. Traffic growth changes no frontend infrastructure. |
| Stateful realtime / games | Cloudflare Durable Objects | A game or room is one id. Cloudflare places it and scales it out. The app does not shard. |
| Object storage | Cloudflare R2 | Object storage with no disks, replicas, capacity, or egress fleet. |
| SQL | PlanetScale Neki (PostgreSQL) | Horizontally scalable Postgres. PlanetScale owns routing and resharding. |
| Global query invalidation | AWS IoT Core (MQTT) | Managed pub/sub. AWS owns connections, subscription routing, fan-out, brokers, and scaling. |

Grafana Cloud (traces) and Infisical (secrets) stay. They are not on the
request path.

The laptop stack is the exception those vendors force: PlanetScale and AWS
IoT have no local mode, so `bun run dev` uses embedded Postgres and a local
MQTT broker (Aedes or the EMQX sidecar). Deployed environments do not.

## Principle

Application code owns logical partitioning. Providers own physical scaling.

The application deals in `gameId`, `queryHash`, database partition keys, and
object keys. It never deals in servers, replicas, broker nodes, or physical
shards.

MQTT is a fast invalidation signal, not a source of truth. A missed message
is recovered by the sync engine, which refetches from Postgres. That is why
the broker's resources are replaceable, and why losing one does not lose a
game, a profile, or a file.

## Layout

```
libs/infra/
  tofu/
    global.tfvars.json  shared by every environment: project, state bucket,
                        secrets project, repository (+ its required checks),
                        PlanetScale organization + region, AWS region
    modules/        env-agnostic building blocks (variables in, outputs out)
      state/          the state bucket + its credential (stateful)
      ci-identity/    GitHub Actions' Infisical OIDC machine identity
      aws-ci-identity/ GitHub Actions' AWS role, assumed with the job's OIDC token
      repository/     GitHub repo settings, `main` protection, Actions variables
      naming/         physical names — patterns.json, shared with TypeScript
      object-store/   R2 bucket (stateful) + bucket-scoped S3 credential
      pubsub/         this env's AWS IoT data plane: authorizer, custom
                      domain, DNS, and the Worker publish key
      trace-stack/    the ONE Grafana Cloud stack (stateful; free plan = 1 stack)
      observability/  per-env access policies + tokens on that stack
      database/       this env's PlanetScale Neki database (branch `main`)
                      + Hyperdrive in front of its router, and
                      pg_stat_statements
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
                      (`bun check` publishes to it)
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
`global.tfvars.json`, then (foundation / edge) the environment's file. An
environment is one `envs/<env>.tfvars.json`: its name, name suffix,
hostnames, account ids, and the ids of pre-existing resources to adopt
(`imports`).

`planetscale.organization` is `gamezilla`, the same slug as the project
name. It has not been confirmed against the PlanetScale account. A wrong
slug fails the foundation apply with the organization's name. Region for
both Neki and IoT is `us-east-1`: one region, so growth is not a
multi-region project.

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

`bun check`, `bun health`, and `bun deploy` dispatch the three workflows
from a laptop ([`docs/CI.md`](CI.md)). Deploy ships `main` only.
`bun check` is the release gate.

### Hard cutover

The foundation apply points Hyperdrive and the broker hostname at Neki and
IoT before the new Worker code is deployed. Migrate runs in between, against
the new database. The new database is empty until that migrate. Until the
new Worker is up, an old Worker publish goes to IoT (or fails) and its SQL
goes to the new origin. That window is accepted.

Neon and the Railway project are forgotten, not destroyed (`removed` with
`destroy = false` in the foundation and fleet stacks). They remain in those
vendors until a person deletes them, after dev and production health are
green. An ordinary apply does not delete them. Production teardown is
refused.

## Environments are cattle; data is never lost by accident

Every environment is rebuilt from its env file alone, and a
`protection: "standard"` one can be torn down completely on purpose. What
can never happen is losing data by accident — through an ordinary apply, a
broken config, or anything touching production. Four independent layers:

1. **Global** stateful resources (state bucket and credential, the Grafana
   stack, the repository, the shared secrets environment) and **production's
   Neki branch** carry `lifecycle { prevent_destroy = true }`. No
   environment's teardown can reach them. IoT is not in this set: a missed
   invalidation is recovered from Postgres.
2. **Plan policy** — `scripts/tofu.ts` plans to a file, runs
   `policy/stateful.rego` on `tofu show -json`, and applies *that saved plan*
   only if nothing is denied. Deletion is **allow-listed**: only credential,
   DNS, routing, connection-config, and derived-secret types may be deleted
   or replaced by an ordinary apply. Neki branches and roles are protected.
   Any type not on the list is protected, including ones added later. In
   `protection: production` environments a plan deleting most of a type's
   instances is refused (mass-delete brake). The only way past it is a
   teardown (below), and the policy refuses every production teardown.
3. **Forget, never destroy** — to stop managing a stateful resource without
   tearing the environment down, use a
   `removed { from = … lifecycle { destroy = false } }` block.
4. **Assert-only** for what code must not create: the Cloudflare zone and
   human-entered secrets. The PlanetScale organization already exists; its
   slug is configuration. OpenTofu creates each environment's database
   inside it.

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
room Workers → empty the bucket → foundation (that env's Neki database,
Hyperdrive, bucket, IoT broker, trace tokens, secrets) → the env's fleet
entries (its secrets environment and shared import). A failed step is
resumed by rerunning.

The env file stays: the next Deploy (or `bun run infra:fleet &&
SECRETS_ENV=<env> bun run deploy:local`) rebuilds the environment from nothing.
Its database is a new empty Neki database plus migrations, not a copy of
production. To retire it, delete its env file and `envs.ts` entry in a PR —
deleting the file alone deletes nothing (the fleet plan's
secrets-environment delete is refused by the policy).

## State

S3 backend on the R2 bucket named in `global.tfvars.json` (`state.bucket`),
key `<stack>/<env>.tfstate` (`<stack>/global.tfstate` for bootstrap and
fleet), native lockfile, OpenTofu state + plan encryption (pbkdf2 → AES-GCM)
keyed by `TOFU_STATE_PASSPHRASE`. The bootstrap stack creates the bucket and
its credential (`TOFU_STATE_ACCESS_KEY_ID` / `TOFU_STATE_SECRET_ACCESS_KEY`)
and writes the credential once, to the shared secrets environment.

The child process's `AWS_ACCESS_KEY_ID` is that R2 state key. The AWS
provider does not read it. In GitHub Actions the wrapper assumes
`AWS_ROLE_ARN` (the bootstrap stack's GitHub OIDC role) with the job's OIDC
token and passes the temporary credentials as `TF_VAR_aws_access_key_id`,
`TF_VAR_aws_secret_access_key`, and `TF_VAR_aws_session_token`. On a laptop
it reads the AWS CLI's current login the same way. Long-lived
`AWS_ACCOUNT_ACCESS_KEY_ID` / `AWS_ACCOUNT_SECRET_ACCESS_KEY` still work
when no OIDC token and no CLI login are available; they are not stored.
PlanetScale reads `PLANETSCALE_SERVICE_TOKEN_ID` and
`PLANETSCALE_SERVICE_TOKEN` from the environment. The Worker's IoT publish
key (`IOT_ACCESS_KEY_ID`) is a different credential OpenTofu generates,
because a Worker cannot present a GitHub OIDC token.

## Secrets

`libs/infra/tofu/stacks/foundation/secrets.json` classifies every secret the
stack touches:

| Kind | Who writes it | Examples |
| --- | --- | --- |
| shared | a person, once, in the `shared` environment (`bun run secrets:seed`) | Google OAuth client, PlanetScale service token, `TOFU_STATE_PASSPHRASE` |
| human | a person, per environment (asserted present) | none today |
| generated | OpenTofu once; an existing value wins unless it is a committed placeholder (`secrets.json` `placeholders`) | `AUTH_SECRET`, `EMQX_JWT_SECRET` (the HMAC secret the API mints and the IoT authorizer checks) |
| derived | OpenTofu, from resource outputs | `DATABASE_URL`, `HYPERDRIVE_ID`, `EMQX_WSS_URL`, `IOT_*`, `S3_*`, `API_URL`, `OBSERVABILITY_*` |

Account-wide credentials live once in the `shared` Infisical environment
(created by bootstrap); the fleet stack gives every environment an import of
it, so a new environment inherits them and a rotation is one edit. A copy
held by an environment would shadow the import:
`libs/secrets/src/scripts/secrets-reconcile-shared.ts` (Deploy's
`deploy:fleet` job) promotes unanimous copies into `shared` and deletes the
rest, failing on any copy that disagrees. OpenTofu never deletes a human
secret, and unknown keys in the store are left alone.

`EMQX_API_URL`, `EMQX_API_KEY`, `EMQX_API_SECRET`, and
`EMQX_DASHBOARD_PASSWORD` are not deployed secrets. The laptop still writes
the API ones into `.dev.vars` for the local broker. Worker secret upload
never removes old names: after this cutover, delete the stale
`EMQX_API_*` bindings on the Workers once.

## What stays outside OpenTofu, and why

| Thing | Owner | Why not OpenTofu |
| --- | --- | --- |
| Worker code + Durable Object migrations | `wrangler deploy` in each app's `deploy` | The Cloudflare provider does not apply DO migrations reliably (cloudflare/terraform-provider-cloudflare#5701, #5898). Names come from `@libs/infra`; hostnames are the edge stack's. |
| Postgres tables | `@libs/runtime#migrate` | Application schema, versioned with the code. A new database starts empty. |
| Billing catalog (Stripe/Paddle products, prices, webhooks) | `@libs/billing#billing:sync` | Paddle has no provider, and the offer is product data the code reads. |
| The Cloudflare zone, the PlanetScale organization, shared secrets, `TOFU_STATE_PASSPHRASE` | a person, once | Must never be created (or rotated) by code; asserted or configured instead. |
| The Google OAuth client and its ONE redirect URI (`https://auth.gamezilla.app/api/auth/callback/google`) | a person, once | Google's console has no API. Every environment sends that callback and tags its OAuth state with its name; the global relay Worker (`apps/auth-relay`, hostname from the fleet stack) forwards each callback to its environment, so a new environment needs no console edit and no environment depends on another. |

## Postgres through Hyperdrive

Each environment is its own Neki database, named `<project>-<suffix>`
(`gamezilla-production`, `gamezilla-development`), branch `main`, no parent,
region `us-east-1`. Creating the branch creates the database. A development
branch of a parent would start empty and is not used: environments do not
share rows. Destroying the last branch destroys that database, which is why
only a standard teardown may do it. Production's branch is
`deletion_protected` and `prevent_destroy`.

Three roles, each inheriting a Neki role rather than holding grants of its
own:

| Role | Inherits | Used by |
| --- | --- | --- |
| `migrate` | `postgres` | `DATABASE_URL`. Migrations and the `postgresql` provider. DDL. |
| `app` | `pg_read_all_data`, `pg_write_all_data` | Hyperdrive, and therefore the API Worker. Rows, not tables. |
| `obs_read` | `pg_read_all_data`, `pg_monitor` | `OBS_READONLY_DATABASE_URL` (`bun obs`). |

Connect to the router host parsed from the role's `access_host_url`, port
`5432`, database `postgres`, `sslmode=verify-full`. Passwords are
URL-encoded. There is no `channel_binding` parameter.

The API Worker never dials Neki itself. Workers have no connection pool.
`modules/database` creates one Cloudflare Hyperdrive config per environment
on the **app** role's router and writes its id to the secrets store as
`HYPERDRIVE_ID`. `@apps/server#deploy` renders it into the Worker as the
`HYPERDRIVE` binding, and the Worker opens Postgres on
`env.HYPERDRIVE.connectionString` (`postgresConnectionString` in
`@libs/server-app/config/env`). Hyperdrive is Cloudflare's pool in front of
the Neki router. It is not a second database and it is not an
application-managed shard. Query caching is **off**: sync hydration must
read its own writes. `DATABASE_URL` stays the database's identity —
migrations and tooling connect with it, and the non-production URL policy
always checks it. `wrangler dev` and the localhost stack have no binding and
connect to embedded Postgres.

`pg_stat_statements` is created by the `postgresql` provider as the migrate
role, at `module.database.postgresql_extension.pg_stat_statements`. Neki's
default configuration profile is created with the branch and cannot be
adopted in the same apply (the provider's create always posts). If the first
apply fails because the profile does not list the extension, a follow-up
updates the profile named `default`. Do not add a second profile resource.

Roles are not `prevent_destroy`: a standard teardown must be able to delete
them. The Neki login name may carry a generated suffix. The obs grant looks
up `obs_read` exactly and skips when that name is absent; `pg_read_all_data`
still covers `SELECT`.

## Query invalidation (AWS IoT Core)

One IoT data plane per environment, in the same AWS account, region
`us-east-1`. Clients keep the hostnames they already have:
`emqx.gamezilla.app` (production) and `emqx-dev.gamezilla.app` (dev). The
synced `client_config` key stays `emqx_wss_url`, and the secret stays
`EMQX_WSS_URL`, value `wss://<hostname>/mqtt`.

DNS is a DNS-only CNAME (`proxied = false`) from that hostname to the
account's ATS IoT endpoint. TLS is an ACM certificate, validated by DNS in
the Cloudflare zone. The domain configuration is `DATA` / `MQTT_WSS` /
`CUSTOM_AUTH`, with the custom authorizer as the default, so browsers do
not pass an authorizer query parameter.

The authorizer is a Node 22 Lambda
(`libs/infra/tofu/modules/pubsub/authorizer/index.mjs`). Signing is off:
browsers do not hold a signing key. It checks the same HMAC JWT the API
already mints (`EMQX_JWT_SECRET`) and turns the token's `acl` claim into an
IoT session policy: connect on the client id, subscribe and receive on the
allowed topics, publish on the allowed topics. Invalid tokens are
unauthenticated and get no policy. Caching is off.

Topics in the app use `:`, as in `user:actor1`. IoT topic ARNs split on
`:`, so the wire topic uses `/` (`user/actor1`). That mapping lives at the
IoT boundary only. `wss:` clients map when they subscribe, publish, and
dispatch. Loopback `ws:` brokers (the laptop) keep colon topics. The Lambda
repeats the same one-line replacement so `libs/infra` does not import
`@pkgs/pubsub`. Both sides are tested on the same examples.

The Worker publishes with SigV4 (`service` `iotdata`) to
`https://<data-endpoint>/topics/<wire-topic>?qos=1`. The body is the same
payload bytes the local broker publishes, not an envelope. Workers cannot
assume an instance role, so OpenTofu creates an IAM user whose only action
is `iot:Publish` on `topic/*` and writes `IOT_DATA_ENDPOINT`,
`IOT_ACCESS_KEY_ID`, `IOT_SECRET_ACCESS_KEY`, and `IOT_REGION`. When all
four are present, the API uses IoT. When they are absent (the laptop), it
uses the local EMQX HTTP API. There is no deployed EMQX path.

MQTT 5 is what `wss:` clients speak. If IoT rejects MQTT 5, the client
selects protocol 4 for that host. That branch is not in yet.

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
are in the environment. Do not `tofu apply` from a laptop against
production.

## Adding an environment (staging, a replica, …)

1. Create `libs/infra/tofu/envs/<env>.tfvars.json` (copy `dev`, drop its
   `imports`): a new `env`, `display_name` and `suffix`, `protection:
   "standard"`, hostnames one level under the zone (Universal SSL). Register
   it in `libs/infra/src/public/envs.ts`.
2. Merge. Nothing else — no console, no seeding:
   - `deploy:fleet` creates the env's Infisical environment and its import of
     the shared credentials;
   - `deploy:<env>` (foundation) creates its own empty Neki database and
     derives `DATABASE_URL`, mints its generated secrets, R2 bucket, its IoT
     data plane (hostname from the env file) and trace tokens, then migrates
     (the schema; no production rows), ships the Workers, binds the
     hostnames and runs `health`;
   - Google sign-in works immediately: `deploy:fleet` redeploys the OAuth
     relay with the new env as a target before any env deploys, and the
     env's API Worker is rendered with the relay's callback and its own state
     tag.
   No workflow edit: Deploy and Health read the env files
   (`scripts/workflow-env-matrix.ts`). Deploy runs every `protection:
   "standard"` env in parallel, then — only if all succeeded — every
   `"production"` env; Health probes every env hourly.

To rehearse before merging: `bun run infra:fleet`, then
`SECRETS_ENV=<env> bun run deploy:local` ([CI.md](CI.md#workflows)). Tear it down
again with `bun run infra:destroy` ([above](#tearing-an-environment-down)).

## First deployment of this cutover

Resources that already exist and are staying (R2 buckets, the broker CNAME,
Infisical secrets that still exist) are **adopted, never recreated**. The
env files' `imports` name them. An `import` of a resource already in state
is a no-op; once a standard env's first apply has adopted everything, delete
its `imports` — a stale id would break its rebuild after a teardown
(`tests/env-files.test.ts` requires standard envs to have none).

Neon branches, endpoints, and roles, and every Railway project, service,
environment, variable, and domain, are `removed` with `destroy = false`.
The next foundation apply forgets them and creates Neki and IoT. It does
not delete the old databases or the old broker. A person deletes those in
Neon and Railway after health is green.

The chicken-and-egg problems and how each is broken:

| Problem | Resolution |
| --- | --- |
| State needs a bucket; the bucket is a resource | The bootstrap stack's first apply uses a local backend, creates the bucket and its credential, writes the credential to the shared secrets environment, then migrates its own state into the bucket (`scripts/bootstrap-backend.ts`). Detected by `TOFU_STATE_ACCESS_KEY_ID` being absent. |
| State is encrypted; the key cannot come from state | `TOFU_STATE_PASSPHRASE` is a human secret, seeded before anything runs. |
| CI authenticates to Infisical with the identity the bootstrap stack manages | Bootstrap is applied by a person with their own credentials, never by CI. It creates a new OIDC identity (the provider cannot import an existing OIDC binding) and repoints `SECRETS_IDENTITY_ID`; runs in flight keep using the old identity, which a person deletes afterwards. |
| Generated secrets already exist | A stored value wins over the generator, so adopting never rotates `AUTH_SECRET` or `EMQX_JWT_SECRET`. Two exceptions are minted fresh: `secrets.regenerate` lists names whose value was copied from another environment, and `stacks/foundation/secrets.json` `placeholders` lists the values committed to git for the local sidecar, which are public and must never reach a deployed authorizer. `specs/health/live-updates.feature` re-reads the store before probing, so a rotation lands in the same deploy. |
| Secrets OpenTofu writes already exist | Imported (`imports.foundation.secrets`), so the first apply updates rather than colliding with "already exists". New `IOT_*` secrets are created, not imported. |
| Custom domains need their Worker | Edge runs after the Worker deploys; wrangler (with no `routes`) never touches existing custom domains in between. |
| The IoT custom domain's certificate | ACM DNS validation runs inside the foundation apply, before migrate and the Worker deploy. Health then expects an unsigned request to the data plane to be refused (`403`), which is the data plane answering. |
| `pg_stat_statements` on a brand-new branch | The default profile cannot be imported in the same apply as the branch. If create-extension fails, update profile `default` in a follow-up. Do not declare a second profile. |

Health checks for the human-managed settings (`bun health`, every
environment, hourly): `specs/health/sign-in.feature` asks Google
whether it accepts the one shared OAuth callback and, if not, names the exact
redirect URI to add, and every environment proves the relay returns each
other environment's callbacks home; `specs/health/declared-environment.feature` plans every stack and fails on
drift or on a missing / inactive Grafana stack.

Runbook for a person applying this for the first time:

1. Seed the shared secrets: `TOFU_STATE_PASSPHRASE` (same value everywhere),
   `PLANETSCALE_SERVICE_TOKEN_ID`, `PLANETSCALE_SERVICE_TOKEN`,
   `GRAFANA_CLOUD_API_TOKEN`, `GITHUB_ADMIN_TOKEN` (prd) —
   `bun run secrets:seed -- --env <env>`. Confirm
   `global.tfvars.json` `planetscale.organization` is the account's slug
   (`gamezilla` until someone confirms it).
2. `bun run infra:bootstrap` (logged in with `infisical login` and the AWS
   CLI), if it has not already been applied. That apply creates the GitHub
   OIDC role and writes `AWS_ROLE_ARN`. It is the one step that needs an
   AWS login; deploys after it assume the role and do not.
3. Review, read-only, per environment:
   `SECRETS_ENV=prd bun run libs/secrets/src/scripts/secrets-run.ts -- bun run --filter @libs/infra plan:foundation`
   (and `plan:edge`, and `SECRETS_ENV=dev`). Expect the new Neki and IoT
   resources, updates to Hyperdrive and the broker CNAME, and **no destroy**
   of Neon or Railway. The `removed` blocks drop them from state only. The
   policy gate refuses a real delete of protected types.
4. Merge. The Deploy workflow applies every standard env (dev, a new
   replica) and then prd. After health is green, a person deletes the old
   Neon project and the Railway project in those vendors.
