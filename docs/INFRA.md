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
                        secrets project, repository (+ its required checks)
    modules/        env-agnostic building blocks (variables in, outputs out)
      state/          the state bucket + its credential (stateful)
      ci-identity/    GitHub Actions' Infisical OIDC machine identity
      repository/     GitHub repo settings, `main` protection, Actions variables
      naming/         physical names — patterns.json, shared with TypeScript
      object-store/   R2 bucket (stateful) + bucket-scoped S3 credential
      pubsub/         Railway project + EMQX service/volume (stateful), variables,
                      custom domain, Cloudflare DNS
      trace-stack/    the ONE Grafana Cloud stack (stateful; free plan = 1 stack)
      observability/  per-env access policies + tokens on that stack
      database/       Neon: ASSERT-ONLY (one project, a branch per env) +
                      the pg_stat_statements extension
      secrets/        Infisical: asserts human secrets, keeps generated ones,
                      writes derived ones
      edge/           public hostnames → Workers (custom domains)
    stacks/
      bootstrap/      global, applied by a person: state, secrets environments,
                      CI identity, repository
      foundation/     everything before Worker code ships (+ secrets.json)
      edge/           custom domains, after the Workers exist
    envs/
      prd.tfvars.json the ONLY env-specific values
      dev.tfvars.json
  policy/stateful.rego  plan gate (conftest)
  scripts/tofu.ts       the only way tofu runs: plan | apply | drift
```

Modules and stacks never name an environment. Every stack reads
`global.tfvars.json`, then (foundation / edge) the environment's file. An environment is one
`envs/<env>.tfvars.json`: its name, name suffix, hostnames, account / project
ids and the ids of pre-existing resources to adopt (`imports`).

## Deploy chain

```
@libs/infra#apply:foundation  → @libs/runtime#migrate
  → @apps/room-server#deploy → @apps/server#deploy → @apps/product#deploy
  → @libs/infra#apply:edge → @libs/billing#billing:sync → health
```

Worker **code** (and Durable Object migrations) ships with `wrangler deploy`:
the Cloudflare provider's `cloudflare_workers_script` does not apply DO
migrations reliably. `wrangler.toml` is env-agnostic; `@libs/infra/public/wrangler`
renders it per environment (name, DO `script_name`) and refuses any
`deleted_classes`. Hostnames are the edge stack's, never wrangler's.

## Stateful resources can never be destroyed

Four independent layers:

1. `lifecycle { prevent_destroy = true }` on every stateful resource (R2
   bucket, Railway project and service/volume, Grafana stack, generated
   secrets).
2. **Plan policy** — `scripts/tofu.ts` plans to a file, runs
   `policy/stateful.rego` on `tofu show -json`, and applies *that saved plan*
   only if nothing is denied. Deletion is **allow-listed**: only credential,
   DNS, routing and derived-secret types may ever be deleted or replaced;
   any other type — including ones added later — is protected by default. In
   `protection: production` environments a plan deleting most of a type's
   instances is refused (mass-delete brake). There is no `destroy` command.
3. **Forget, never destroy** — to stop managing a stateful resource, use a
   `removed { from = … lifecycle { destroy = false } }` block.
4. **Assert-only** for what code must not create: the Neon project and its
   branches (one project, one branch per environment; the `database` module
   fails the plan unless `DATABASE_URL` points at an endpoint of the env's own
   branch), the Cloudflare zone and human-entered secrets.

Before every apply the encrypted state object is copied to
`backups/<stack>/<env>/<timestamp>.tfstate` in the state bucket.

`libs/infra/tests` pins all of it: the policy matches an independent model on
generated plans, every resource type in `tofu/modules` is classified as
deletable or protected, env files never share a stateful identity, and the
secrets OpenTofu writes are exactly the registry's `managedBy: 'tofu'` ones.

## State

S3 backend on the R2 bucket named in the env file (`state.bucket`), key
`<stack>/<env>.tfstate`, native lockfile, OpenTofu state + plan encryption
(pbkdf2 → AES-GCM) keyed by `TOFU_STATE_PASSPHRASE`. The bucket and its
credentials (`TOFU_STATE_ACCESS_KEY_ID` / `TOFU_STATE_SECRET_ACCESS_KEY`) are
created by hand once and never managed by the stack.

## Secrets

`libs/infra/tofu/stacks/foundation/secrets.json` classifies every secret the
stack touches:

| Kind | Who writes it | Examples |
|---|---|---|
| human | a person, `bun run secrets:seed` (asserted present) | `DATABASE_URL`, Google OAuth, provider API tokens |
| generated | OpenTofu once; an existing value always wins | `AUTH_SECRET`, EMQX credentials |
| derived | OpenTofu, from resource outputs | `S3_*`, `API_URL`, `OBSERVABILITY_*` |

OpenTofu never deletes a human secret, and unknown keys in the store are left
alone.

## What stays outside OpenTofu, and why

| Thing | Owner | Why not OpenTofu |
|---|---|---|
| Worker code + Durable Object migrations | `wrangler deploy` in each app's `deploy` | The Cloudflare provider does not apply DO migrations reliably (cloudflare/terraform-provider-cloudflare#5701, #5898). Names come from `@libs/infra`; hostnames are the edge stack's. |
| Postgres tables | `@libs/runtime#migrate` | Application schema, versioned with the code. |
| Billing catalog (Stripe/Paddle products, prices, webhooks) | `@libs/billing#billing:sync` | Paddle has no provider, and the offer is product data the code reads. |
| The Neon project and its branches, the Cloudflare zone, human secrets, `TOFU_STATE_PASSPHRASE` | a person | Must never be created (or rotated) by code; asserted instead. |

## Commands

```sh
bun run infra:bootstrap                         # global stack; a person, rarely
bun run --filter @libs/infra plan:foundation   # SECRETS_ENV picks the env
bun run --filter @libs/infra plan:edge
bun run --filter @libs/infra apply:foundation  # deploy runs these; CI only
bun run --filter @libs/infra health            # drift: live == declared
```

Run through `secrets-run` (the root `deploy` does) so provider credentials
are in the environment.

## Adding an environment (staging, a replica, …)

1. Create `libs/infra/tofu/envs/<env>.tfvars.json` (copy `dev`): a new
   `suffix`, hostnames one level under the zone (Universal SSL), a new
   Railway project name, the env's Neon branch id. (All environments share
   one Grafana stack; spans carry `deployment.environment.name`.)
   Register it in `libs/infra/src/public/envs.ts`.
2. `bun run infra:bootstrap` creates the environment's Infisical environment
   and its state credential. By hand, create what code never creates: a Neon
   branch of the project (and its `DATABASE_URL`), Google OAuth redirect URIs
   for the new API host. Seed human secrets with
   `bun run secrets:seed -- --env <env>`.
3. `bun check` proves the new file is valid and isolated from every other
   environment; the first deploy with `SECRETS_ENV=<env>` creates the rest.

## First deployment (adopting what already exists)

Everything that existed before OpenTofu is **adopted, never recreated**: the
env files' `imports` (and `global.tfvars.json` `global_imports`) name every
existing bucket, Railway project/service/domain, DNS record, custom domain,
Infisical environment, GitHub setting and stored secret. An `import` of a
resource already in state is a no-op, so those entries may stay.

The chicken-and-egg problems and how each is broken:

| Problem | Resolution |
|---|---|
| State needs a bucket; the bucket is a resource | The bootstrap stack's first apply uses a local backend, creates the bucket and its credential, writes the credential to every environment's secrets, then migrates its own state into the bucket (`scripts/bootstrap-backend.ts`). Detected by `TOFU_STATE_ACCESS_KEY_ID` being absent. |
| State is encrypted; the key cannot come from state | `TOFU_STATE_PASSPHRASE` is a human secret, seeded before anything runs. |
| CI authenticates to Infisical with the identity the bootstrap stack manages | Bootstrap is applied by a person with their own credentials, never by CI. It creates a new OIDC identity (the provider cannot import an existing OIDC binding) and repoints `SECRETS_IDENTITY_ID`; runs in flight keep using the old identity, which a person deletes afterwards. |
| Generated secrets already exist | A stored value always wins over the generator, so adopting never rotates `AUTH_SECRET` or broker credentials. `secrets.regenerate` lists values that were copied from another environment (dev's broker credentials came from prd) and must be minted fresh. |
| Secrets OpenTofu writes already exist | Imported (`imports.foundation.secrets`), so the first apply updates rather than colliding with "already exists". |
| Custom domains need their Worker | Edge runs after the Worker deploys; wrangler (with no `routes`) never touches existing custom domains in between. |
| A new broker / stack takes minutes to come up | The EMQX and Grafana health probes poll through a warm-up window. |

Health checks for the human-managed settings (`bun health`, every
environment, hourly): `apps/server/health/google-oauth.health.ts` asks Google
whether it accepts the environment's OAuth callback and, if not, names the
exact redirect URI to add; `@libs/infra#health` plans every stack and fails on
drift or on a missing / inactive Grafana stack or Neon branch.

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
4. Merge. The Deploy workflow applies dev (a new replica) and then prd.

Bootstrap adopts the shared Grafana stack (`shortawning2091`, the org's one free-plan stack); the first prd apply creates prd's
trace tokens and a new S3 credential
(Workers pick it up in the same deploy; the old token keeps working until a
person deletes it) and re-sends the broker's Railway variables with their
current values, which redeploys the broker once (MQTT clients reconnect).

Leftovers from the imperative era, safe to delete by hand once prd is on
OpenTofu: account tokens `gamezilla-s3-prd`, `gamezilla-s3-dev`,
`gamezilla-r2-teardown-gamezilla-development`; the TXT record
`_cf-probe.gamezilla.app`; the unattached `emqx-volume-*` volumes and extra
`*.up.railway.app` service domains in the Railway project; the old
`github-actions-gamezilla` Infisical identity.

