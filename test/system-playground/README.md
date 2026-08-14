# `@test/system-playground`

Expo **web** host that boots the full product system graph in-process and mounts
two product `App` trees (Alice / Bob) side by side in one browser tab.

```bash
bun run --filter @test/system-playground web
```

Opens Metro on port **5180**. Do not add a Turbo `dev` script — that would start
a second Expo next to `@apps/client`.

## What runs

- `createWorld` + `apiResource` + `roomResource` (Hono `serveFetch`, no sockets)
- Shared in-memory pubsub bus
- Expo SQLite DBs: `sim_api`, `sim_alice`, `sim_bob`
- Two embedded `<App embedded />` trees with isolated nav / auth / sqlite

Same leaf stubs as `@test/ui` (in-memory Stripe / TTS / LLM / object store) —
not Durable Objects, Neon, EMQX, or S3.
