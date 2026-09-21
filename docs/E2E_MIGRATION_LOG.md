# e2e migration log

Every spec that lived in `apps/product/tests` and where it went. The point of
the table is that coverage of user-visible behaviour must not shrink: a row
may move, merge or split, but it may not quietly disappear.

Status values: **done** (moved and passing at its new home), **planned**
(destination decided, not yet moved), **kept** (stays where it is, with the
reason).

> **Where this stands.** The architecture the moves depend on is in place —
> feature manifests, the three folds, both shells generic over the features
> they run, boundaries enforced (see
> [`FEATURE_SUBSYSTEMS.md`](FEATURE_SUBSYSTEMS.md)). No spec has moved yet:
> that needs the sim fabric to become a harness that boots a feature slice,
> which is the next piece of work. Until then every row below is **planned**
> and all 46 specs still run from `apps/product/tests` as one task,
> `@apps/product#test:e2e`.

## Where things go

| Destination | What belongs there |
| --- | --- |
| `libs/<feature>/tests/` | Subsystem e2e — boots only that feature's slice from its manifest. The default. |
| the full-composition package | Journeys that inherently span features, plus the smoke set over the real app composition. ~10% of coverage, never skipped. |
| the owning package's `tests/` | Things that were never e2e (fixture validation, static policy checks) and only lived under `tests/` because that is where the file landed. |

## The 46 specs

### chess — 18 specs

| Spec | Covers | New home | Status |
| --- | --- | --- | --- |
| `chess-puzzle-play` | seeded mate-in-1 solved by board drag; Next never repeats the active puzzle | `libs/chess/tests/` | planned |
| `chess-puzzle-solve-flow` | §5 solve flow, §3/§34 input rules, §6 show-solution, §34 move rules (14 tests) | `libs/chess/tests/` | planned |
| `chess-puzzle-solve-session` | §5 session handling: leave mid-attempt, app kill, double-Next, prefetch, auto-advance | `libs/chess/tests/` | planned |
| `chess-puzzle-controls` | retry, hint staging, solution offer, failed-attempt logging | `libs/chess/tests/` | planned |
| `chess-puzzle-review` | §7 post-solve review scrubbing (6 tests) | `libs/chess/tests/` | planned |
| `chess-puzzle-stats` | solve raises Elo and logs; wrong move drops Elo | `libs/chess/tests/` | planned |
| `chess-puzzle-stats-p0` | §15 rating/solved/accuracy as folds of the ledger | `libs/chess/tests/` | planned |
| `chess-puzzle-rating` | §8 Glicko: provisional start, RD settling, offline reconcile, repeat attempts, two-device convergence | `libs/chess/tests/` | planned |
| `chess-puzzle-selection` | §9 selection: no repeats, quality floor, window widening, exhaustion | `libs/chess/tests/` | planned |
| `chess-puzzle-feed` | feed settings: history filter, rating offset, custom mode, difficulty band | `libs/chess/tests/` | planned |
| `chess-puzzle-exhaust` | exhausted pool serves oldest attempt unrated; empty theme filter recovers | `libs/chess/tests/` | planned |
| `chess-puzzle-skip-clock` | clock ticks then freezes; skip is terminal and unrated | `libs/chess/tests/` | planned |
| `chess-puzzle-offline` | offline block with no local pool; offline wrong move syncs exactly once | `libs/chess/tests/` | planned |
| `chess-puzzle-ingest` | §4/§23 boot seeding and CSV ingest land only valid rows | `libs/chess/tests/` | planned |
| `chess-puzzle-quota` | rated-puzzle quota at the anonymous limit; signing in lifts it | `libs/chess/tests/` | planned |
| `chess-puzzle-limit-upgrade` | guest limit opens billing plans | full-composition (chess × billing) | planned |
| `chess-puzzle-spectator` | guest spectates a host's solve; suggestions broadcast | full-composition (chess × spaces rooms) | planned |
| `chess-puzzle-fixtures` | §23 validation over the browser-bundled puzzle fixture | harness package (owns the fixture) | planned |

### spaces — 9 specs

| Spec | Covers | New home | Status |
| --- | --- | --- | --- |
| `space-create` | host creates a space and sees it in the lobby | `libs/spaces/tests/` | planned |
| `space-end` | host ends; guest sees the ended state | `libs/spaces/tests/` | planned |
| `space-lifecycle` | host reopens their live space after returning to the lobby | `libs/spaces/tests/` | planned |
| `space-guest-host` | a guest creates and hosts a space, and can end it | `libs/spaces/tests/` | planned |
| `space-live-presence` | two actors share a synchronized session | `libs/spaces/tests/` | planned |
| `space-disconnect-reconnect` | partition and restore an actor session | `libs/spaces/tests/` | planned |
| `space-guest-link-join` | a second actor mounts | `libs/spaces/tests/` | planned |
| `space-host-select-game` | host actor is exposed for game selection | `libs/spaces/tests/` | planned |
| `space-friend-join` | host creates; a friend joins from the lobby card | full-composition (spaces × friends) | planned |

### billing — 4 specs

| Spec | Covers | New home | Status |
| --- | --- | --- | --- |
| `billing-lifecycle` | 12 membership lifecycle transitions through the mock provider | `libs/billing/tests/` | planned |
| `billing-subscribe` | sign in → subscribe → paid tier, trialing monthly row | `libs/billing/tests/` | planned |
| `billing-portal` | cancel, resume and switch interval through the mock portal | `libs/billing/tests/` | planned |
| `billing-offline` | a synced delinquent row answers paid while partitioned | `libs/billing/tests/` | planned |

### friends — 4 specs

| Spec | Covers | New home | Status |
| --- | --- | --- | --- |
| `friends-request-accept` | alice requests, bob accepts from notifications, both see friends | `libs/friends/tests/` | planned |
| `friends-request-decline-cancel` | lifecycle from a synchronized relationship | `libs/friends/tests/` | planned |
| `friends-remove` | relationship visible before removal | `libs/friends/tests/` | planned |
| `friends-block` | relationship visible before block/unblock | `libs/friends/tests/` | planned |

### auth — 3 specs

| Spec | Covers | New home | Status |
| --- | --- | --- | --- |
| `auth-login-logout` | first login, then logout on the account screen | `libs/auth/tests/` | planned |
| `auth-oauth-port` | Google sign-in through the in-process `openAuthSession` seam | `libs/auth/tests/` | planned |
| `auth-guest-progress-carryover` | **see note** | `libs/auth/tests/` | planned |

> `auth-guest-progress-carryover` asserts less than its name claims: it signs
> in and checks the actor id is present, reusing `auth-login-logout`'s report
> id. There is no guest-progress assertion in it today. It moves as-is so the
> migration stays behaviour-preserving, and the missing carryover assertion is
> tracked separately rather than smuggled in here.

### profile, search — 2 specs

| Spec | Covers | New home | Status |
| --- | --- | --- | --- |
| `profile-edit` | guest and signed-in username + avatar edits (4 tests) | `libs/profile/tests/` | planned |
| `search-people` | people search settles and finds bob by username | `libs/search/tests/` | planned |

### Not subsystem e2e — 6 specs

| Spec | Covers | New home | Status |
| --- | --- | --- | --- |
| `shell-boot` | two actors boot through the paint gate into the tab shell; focus switching | full-composition (smoke) | planned |
| `product-walk` | weighted random walk over the whole action pool | full-composition (smoke) | planned |
| `product-explore` | `system.explore` search over the action pool | full-composition (smoke) | planned |
| `topology-partition` | partition an actor from the server, then restore, and still sign up | full-composition (platform) | planned |
| `non-web-host-smoke` | host registration and the bun-webview build | harness package | planned |
| `sw-policy` | service-worker precache/runtime rule coverage — pure static check, no sim | `apps/product/scripts/` | planned |
