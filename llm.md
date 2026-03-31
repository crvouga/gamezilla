# Gamezilla

A local-first, offline-first multiplayer game platform. Expo + React Native + TypeScript client, Bun server.

---

## Engineering Philosophy

### Tiger Style

We follow the [Tiger Style](https://github.com/tigerbeetle/tigerbeetle/blob/main/docs/TIGER_STYLE.md) discipline adapted for TypeScript. The core premise: safety and correctness are not at odds with velocity — they enable it.

- **Assert invariants, don't check them.** Assertions are load-bearing, not debug aids. If an invariant is violated, crash. Silent corruption is always worse than a crash.
- **Handle every error.** No swallowed promises, no bare catches, no `catch {}`. Every failure path is either explicitly handled or explicitly propagated.
- **Fail loudly.** Crash handlers are registered at the top of the process. Unhandled rejections are fatal. If something impossible happens, the process dies and tells you why.
- **Explicit over implicit.** No hidden control flow, no magic. Every dependency is injected. Every configuration is visible. Every side effect is named.

### Local-First

The client is the source of truth. The server is coordination infrastructure, not authority.

- The app works fully offline for weeks. Sync happens opportunistically when connectivity is available.
- The client database is always available, always writable, always fast. It never waits on the network.
- The server exists to relay patches between clients. It has no durable state — if it loses everything, clients re-push. The system self-heals.
- Users own their data. Backup and restore is a client concern, not a server concern.

### Append-Only

Data is never deleted or mutated. Only new patches are appended.

- No destructive migrations, ever. Schema changes are additive.
- Soft deletes via attributes. Undo is replaying history, not recovering deleted rows.
- The full history of every entity is always available by reading its patch chain.

### Conflict-Tolerant

Multiple clients can write concurrently to the same entity without coordination. Conflicts are resolved automatically by merge semantics — latest value per attribute key wins, `null` removes a key. No manual conflict resolution, no last-writer-wins at the entity level, no CRDTs. The merge is per-attribute.

### Deterministic Simulation

Every non-deterministic boundary — time, network, scheduling, randomness — is injectable. This allows the entire multi-client sync system to be simulated in-process with:

- Simulated clocks with explicit tick control
- Simulated network links with configurable latency and packet loss
- Simulated transport layers that replace HTTP with direct function calls
- Event recording and replay for regression testing

This means we can write tests like "two clients go offline, make conflicting edits for 30 seconds, come back online, and converge" — and run them deterministically in milliseconds with no real I/O.

### Infrastructure as Code

Every piece of infrastructure is defined in code, versioned, and deployed automatically. There is no manual provisioning, no clicking through consoles, no snowflake servers.

- AWS CDK defines all cloud resources: S3 buckets, CloudFront distributions, App Runner services, Route 53 DNS, ACM certificates.
- A single `git push` to `main` triggers the full pipeline: type check → lint → test → CDK deploy → build → upload → invalidate CDN.
- Environment configuration is injected at build time by CI, not stored in the repo or managed manually.

### Single Source of Truth

- **Code is the source of truth for infrastructure.** The CDK stack is the complete, reproducible definition of the production environment.
- **The client database is the source of truth for application data.** The server is a cache that can be rebuilt from clients.
- **The patch log is the source of truth for entity state.** Snapshots are derived views that can be recomputed from patches at any time.
- **`main` is the source of truth for what's deployed.** There is no separate "deploy" step or branch. If it's on `main`, it's in production.

---

## Architecture

### Patch DB

All application data is modeled as an append-only log of **patches**. Each patch targets an entity and carries namespaced attributes. Entities are materialized by folding patches.

```typescript
interface PatchesDb {
  read(queries: PatchesDbQuery[]): Promise<PatchesDbResult[]>;
  write(patches: PatchInput[]): Promise<Patch[]>;
  update(
    updates: { patchId: string; attributes: Record<string, unknown> }[]
  ): Promise<void>;
}
```

Queries support filtering, ordering, pagination, and cursor-based sync. No joins — queries target a single entity type. Attribute keys follow a Clojure-style namespaced convention: `entityType/attributeName`.

### Sync

Clients write locally first (optimistic, instant), then sync in the background via push and poll cycles over HTTP + SSE. The transport layer is interface-driven and swappable.

```typescript
interface PatchDbClientTransport {
  read(queries: PatchesDbQuery[]): Promise<PatchesDbResult[]>;
  write(patches: PatchInput[]): Promise<Patch[]>;
  subscribe(callback: () => void): Unsubscribe;
}
```

The server performs merge-then-read: it incorporates client-known patches before responding. Clients detect server data loss and re-push automatically.

### Dependency Injection

A lightweight container with typed tokens, parent/child scoping, and circular dependency detection. Every service — storage, transport, sync, config — is resolved through DI. React integration via context provider.

### Deployment

AWS CDK provisions everything. GitHub Actions runs the full pipeline on every push to `main`. The server req res runs as a Bun container on App Runner. The web app is a static Expo export served from S3 + CloudFront.
