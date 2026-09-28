# Localhost stack

`bun run stack` runs the whole product on loopback in the foreground:

```text
browser ──► web (vite preview, /api proxied)
                   │
                   ▼
            load balancer  ── round-robin ─► api-a (Bun)
            (one API origin)                 api-b (Bun)
                   │                          …
                   │  /api/room upgrades are hashed by topic,
                   │  so a room always lands on one instance
                   ▼
     Postgres · S3rver · Aedes MQTT · simulated Google + Apple (own origins, own state)

Everything is real: the production Worker handler runs unchanged on Bun (only
the listener and the `ROOM` binding are local), instances share one Postgres /
object store / broker, and sign-in goes through a provider that speaks
Google's protocol.

**Every port is OS-assigned.** A stack publishes its addresses to
`.cache/localhost-stack/<instance>.json`; consumers read that file (via
`LOCALHOST_STACK_MANIFEST`) rather than assuming a port. That is what lets
several stacks — several test runs, several agents — share one machine.

```bash
bun run stack                              # 2 API instances, everything on
bun run stack --api-nodes 4                # a bigger fleet
bun run stack --instance alpha             # a named, reusable data directory
bun run stack --no-mqtt --no-s3         # faster boot, less fidelity
bun run stack --no-web                     # API tier only
bun run stack --frozen-web --e2e           # no HMR, test probes on (what test runs use)

bun run stack --idp-state memory                                   # default: IdP forgets on exit
bun run stack --idp-state instance --keep-data --instance alpha    # IdP survives restarts of `alpha`
bun run stack --no-web --idp-state path --idp-state-path /tmp/idp.sqlite

bun run --filter @apps/product test:stack  # boot a stack, run the harness suite, tear down
```

### Local Google sign-in

The simulated Google provider starts with six accounts — the alphabet, so the
chooser and the sign-in hints have a list worth reading:

- `alice@gmail.com`
- `bob@gmail.com`
- `chris@gmail.com`
- `dan@gmail.com`
- `ed@gmail.com`
- `fred@gmail.com`

A second provider process speaks **Sign in with Apple** (mock-only; the API
nodes get `APPLE_*` bindings and a relying-party key minted at boot). It starts
with `alice@icloud.com`, `bob@icloud.com`, `chris@gmail.com` (the same person
as Google's `chris` — sign in with both to see account linking) and
`dan@icloud.com`. Its consent card offers **Hide My Email**.

**Every account uses the password `password`** — there is no per-account secret,
and the sign-in page says so. New accounts can be created from the sign-in and
chooser screens (name + email only; the password is always `password`), then
continue through the real OAuth redirect, PKCE, consent, callback, token
exchange, and userinfo flow.

### IdP durability

The provider keeps its whole state (accounts, clients, browser sessions,
grants, tokens, RS256 signing key) in one SQLite database. `--idp-state` picks
where that file lives:

| mode | database | survives |
| --- | --- | --- |
| `memory` (default) | in-memory SQLite | nothing; each boot starts clean |
| `instance` | `<instance data dir>/idp.sqlite` (+ `idp.apple.sqlite`) | a stack restart, when `--keep-data` is set |
| `path` | exactly `--idp-state-path` (Apple beside it as `<name>.apple.sqlite`) | everything — stack cleanup never deletes it |

A persisted store keeps the same `kid`/JWKS across restarts, so tokens issued
before a restart still verify.

The web tier runs the `@apps/product` Vite app, which owns both the wall at
`/` and the harness at `/harness`. It receives the stack API origin through
`VITE_API_URL`; no client bundle build is required. `--no-web` skips the Vite
process entirely.

`[stack] ready` means every API instance answered a real request, not just that
its listener bound: `/api/health` would also pass while the worker is in its
fatal `api misconfigured` state.
