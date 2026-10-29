# Synthetic Population Worker

The product contract is in [the Synthetic Population specifications](../../specs/synthetic-population/).
The Worker mounts the product's full SolidJS client and reuses the existing UI Driver.
Each Synthetic User runs in its own Bun realm, signs in through the ordinary
sign-in surface, and uses normal space, matchmaking and chess controls.
The browser Driver remains available in the same executable specifications.

Synthetic Users sign in with an emailed link, and they are the only accounts
that can. Their addresses live under `synthetic.<namespace>.invalid`, a domain no
mail server can exist for, and the auth service is given one place to send
links: the population's internal inbox (`population_sign_in_mail`). It accepts
those addresses only, for a user a worker is running right now, and nothing is
ever sent anywhere, in every environment including production. A person can
never be mailed a link, and "Continue with email" is rendered only by this
Worker's application host (`ClientEnv.emailSignIn`), never by the apps people
use. The Driver can only tap and type, so a user asks for a link, the process
holding its Worker Lease takes the newest unexpired link over the control plane
(`POST /api/synthetic-population-worker/take-sign-in-link`), and the user
pastes it into the form. A link is handed out once: taking it soft-deletes the
mail and erases the link from the row. No administrative RPC, sync scope or
DOM inspection reads the inbox, and links are redacted from every recorded
action, diagnostic and inspection.

PostgreSQL owns persistent identities, configuration, Worker Leases and recovery
references. Lease generations fence sessions and mutations; the existing room
service owns matchmaking and games. Recovery rebuilds the client and reconciles
its active match. It cannot preserve a terminated process's network connections.
The nested Hono RPC control plane and lazy `/admin/synthetic-population` client
use the existing declarative permission system. DOM inspection reads the selected
live instance on demand and redacts sensitive fields. Replay covers recorded
Decision Policy inputs; it does not replay uncontrolled external services.

Run the complete local stack with `bun run dev --synthetic-population-workers 2`.
The stack creates local coordination secrets and connects workers to its local
API. `--synthetic-population-workers 0` disables the sidecars. Production hosting
is declared in [the Railway module](../../libs/infra-shared-ts/tofu/modules/synthetic-population-service/)
and composed into the existing foundation stack. Release uploads the commit with a
generated Dockerfile and Railway builds and runs the worker with Bun. Verify runs
the package `test` script on the host and validates the OpenTofu module. It does
not build an image. The Observatory uses the main
frontend and backend deployments. SQL names, environment bindings and OpenTofu
state addresses stay stable across the source-file rename.

Automated verification is `bun verify`. The sub's focused gates are the
`test`, `tc` and `lint` scripts in its shared/server packages, `test:spec` in
`@libs/synthetic-population-harness-ts`, and `test` in
`@apps/synthetic-population-worker-ts`. Native realm tests cover session replacement,
lease fencing, lost move acknowledgements and shutdown. Metrics use the existing
OTLP collector with bounded labels; instance identities remain resource attributes.

[Measured capacity and its limits](PERFORMANCE.md) keep the Railway default at
one Synthetic User per replica. Production readiness still requires a successful
full Verify and a GitHub Actions infrastructure/deployment rehearsal. The current
tests do not cover every requested simultaneous-failure and rapid-release scenario.
Automated alert provisioning, a sustained production soak, and the complete
failure matrix remain outstanding. These limitations are release blockers for
claiming the complete original production guarantee.
