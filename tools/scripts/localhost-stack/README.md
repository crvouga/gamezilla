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
     Postgres · S3rver · EMQX · simulated Google (own origin, own state)
```

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
`bun run stack --no-emqx --no-s3         # faster boot, less fidelity`
bun run stack --no-web                     # API tier only

bun run test:product:localhost            # boot a stack, run the sim suite, tear down
```

The web tier serves `apps/client/dist`, so build it first
(`bun run --filter @apps/client build`) — the bundle talks to `/api` on its
own origin, which is why a dynamically-ported stack needs no rebuild.
