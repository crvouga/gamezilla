# Synthetic Population Worker

The product contract is in [the Synthetic Population specifications](../../specs/synthetic-population/).
The Worker mounts Gamezilla's full SolidJS client and reuses the existing UI Driver.
Each Synthetic User runs in its own Bun realm, signs in through the ordinary
email/password auth port, and uses normal space, matchmaking and chess controls.
The browser Driver remains available in the same executable specifications.

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
is declared in [the Railway module](../../libs/infra-shared/tofu/modules/synthetic-population-service/)
and composed into the existing foundation stack. The Observatory uses the main
frontend and backend deployments. SQL names, environment bindings and OpenTofu
state addresses stay stable across the source-file rename.

Automated verification is `bun check`. The feature's focused gates are the
`test`, `tc` and `lint` scripts in its shared/server packages, `test:spec` in
`@libs/synthetic-population-harness`, and `test` in
`@apps/synthetic-population-worker`. Native realm tests cover session replacement,
lease fencing, lost move acknowledgements and shutdown. Metrics use the existing
OTLP collector with bounded labels; instance identities remain resource attributes.

[Measured capacity and its limits](PERFORMANCE.md) keep the Railway default at
one Synthetic User per replica. Production readiness still requires a successful
full Check and a GitHub Actions infrastructure/deployment rehearsal. The current
tests do not cover every requested simultaneous-failure and rapid-release scenario.
Automated alert provisioning, a sustained production soak, and the complete
failure matrix remain outstanding. These limitations are release blockers for
claiming the complete original production guarantee.
