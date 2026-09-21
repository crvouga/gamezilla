# e2e migration log

Every spec that lived in `apps/product/tests` and where it went. The point of
the table is that coverage of user-visible behaviour must not shrink: a row
may move, merge or split, but it may not quietly disappear.

> **Where this stands.** Done. The sim harness is `@libs/sim-harness`, generic
> over a composition; each feature exports its slice from its `./sim` surface;
> each suite boots only the slices it needs
> ([`libs/sim-harness/README.md`](../libs/sim-harness/README.md)). 38 of the
> 46 specs run in a feature's own `test:e2e`, 2 became ordinary tests, and 6
> stay in the full composition.

A suite's home is the lowest package that may depend on every feature it
composes (turbo rejects cycles). Three features read another's tables or
queries directly, which moved homes up the graph — see "Hidden table reads" in
[`FEATURE_SUBSYSTEMS.md`](FEATURE_SUBSYSTEMS.md):

- permissions reads billing's `billing_subscriptions` → every composition
  includes billing;
- spaces reads friends' `friends_friendships` → spaces flows run in friends'
  suite, and chess composes friends;
- people search's sync query and block filter live in friends → search-people
  runs in friends' suite.

## chess — 18 specs → `libs/chess`

| Spec | Covers | Home |
| --- | --- | --- |
| `chess-puzzle-play` | seeded mate-in-1 solved by board drag; Next never repeats the active puzzle | `libs/chess/tests/e2e/puzzle-play` |
| `chess-puzzle-solve-flow` | §5 solve flow, §3/§34 input rules, §6 show-solution, §34 move rules | `libs/chess/tests/e2e/puzzle-solve-flow` |
| `chess-puzzle-solve-session` | §5 session handling: leave mid-attempt, app kill, double-Next, prefetch, auto-advance | `libs/chess/tests/e2e/puzzle-solve-session` |
| `chess-puzzle-controls` | retry, hint staging, solution offer, failed-attempt logging | `libs/chess/tests/e2e/puzzle-controls` |
| `chess-puzzle-review` | §7 post-solve review scrubbing | `libs/chess/tests/e2e/puzzle-review` |
| `chess-puzzle-stats` | solve raises Elo and logs; wrong move drops Elo | `libs/chess/tests/e2e/puzzle-stats` |
| `chess-puzzle-stats-p0` | §15 rating/solved/accuracy as folds of the ledger | `libs/chess/tests/e2e/puzzle-stats-p0` |
| `chess-puzzle-rating` | §8 Glicko: provisional start, RD settling, offline reconcile, repeats, two-device convergence | `libs/chess/tests/e2e/puzzle-rating` |
| `chess-puzzle-selection` | §9 selection: no repeats, quality floor, window widening, exhaustion | `libs/chess/tests/e2e/puzzle-selection` |
| `chess-puzzle-feed` | feed settings: history filter, rating offset, custom mode, difficulty band | `libs/chess/tests/e2e/puzzle-feed` |
| `chess-puzzle-exhaust` | exhausted pool serves oldest attempt unrated; empty theme filter recovers | `libs/chess/tests/e2e/puzzle-exhaust` |
| `chess-puzzle-skip-clock` | clock ticks then freezes; skip is terminal and unrated | `libs/chess/tests/e2e/puzzle-skip-clock` |
| `chess-puzzle-offline` | offline block with no local pool; offline wrong move syncs exactly once | `libs/chess/tests/e2e/puzzle-offline` |
| `chess-puzzle-ingest` | §4/§23 boot seeding and CSV ingest land only valid rows | `libs/chess/tests/e2e/puzzle-ingest` |
| `chess-puzzle-quota` | rated-puzzle quota at the anonymous limit; signing in lifts it | `libs/chess/tests/e2e/puzzle-quota` |
| `chess-puzzle-limit-upgrade` | guest limit opens billing plans (chess composes billing) | `libs/chess/tests/e2e/puzzle-limit-upgrade` |
| `chess-puzzle-spectator` | guest spectates a host's solve; suggestions broadcast — needs search + inbox to befriend | full composition: `apps/product/tests/chess-puzzle-spectator` |
| `chess-puzzle-fixtures` | §23 validation over the browser-bundled fixture — not an e2e | `libs/chess/tests/puzzle-web-fixture` (ordinary test) |

## spaces — 9 specs → `libs/friends`

Spaces cannot run without friends' table, and friends sits above spaces.

| Spec | Covers | Home |
| --- | --- | --- |
| `space-create` | host creates a space and sees it in the lobby | `libs/friends/tests/e2e/space-create` |
| `space-end` | host ends; guest sees the ended state | `libs/friends/tests/e2e/space-end` |
| `space-lifecycle` | host reopens their live space after returning to the lobby | `libs/friends/tests/e2e/space-lifecycle` |
| `space-guest-host` | a guest creates and hosts a space, and can end it | `libs/friends/tests/e2e/space-guest-host` |
| `space-live-presence` | two actors share a synchronized session | `libs/friends/tests/e2e/space-live-presence` |
| `space-disconnect-reconnect` | partition and restore an actor session | `libs/friends/tests/e2e/space-disconnect-reconnect` |
| `space-guest-link-join` | a second actor mounts | `libs/friends/tests/e2e/space-guest-link-join` |
| `space-host-select-game` | host actor is exposed for game selection | `libs/friends/tests/e2e/space-host-select-game` |
| `space-friend-join` | host creates; a friend joins from the lobby card | `libs/friends/tests/e2e/space-friend-join` |

## billing — 4 specs → `libs/billing`

| Spec | Covers | Home |
| --- | --- | --- |
| `billing-lifecycle` | 12 membership lifecycle transitions through the mock provider | `libs/billing/tests/e2e/lifecycle` |
| `billing-subscribe` | sign in → subscribe → paid tier, trialing monthly row | `libs/billing/tests/e2e/subscribe` |
| `billing-portal` | cancel, resume and switch interval through the mock portal | `libs/billing/tests/e2e/portal` |
| `billing-offline` | a synced delinquent row answers paid while partitioned | `libs/billing/tests/e2e/offline` |

## friends — 4 specs → `libs/friends`

| Spec | Covers | Home |
| --- | --- | --- |
| `friends-request-accept` | alice requests, bob accepts from notifications, both see friends | `libs/friends/tests/e2e/request-accept` |
| `friends-request-decline-cancel` | lifecycle from a synchronized relationship | `libs/friends/tests/e2e/request-decline-cancel` |
| `friends-remove` | relationship visible before removal | `libs/friends/tests/e2e/remove` |
| `friends-block` | relationship visible before block/unblock | `libs/friends/tests/e2e/block` |

## auth, profile, search — 5 specs

Auth is platform (the harness depends on it), so its specs run in the lowest
feature that hosts a signed-in screen.

| Spec | Covers | Home |
| --- | --- | --- |
| `auth-login-logout` | first login, then logout on the account screen | `libs/profile/tests/e2e/auth-login-logout` |
| `auth-oauth-port` | Google sign-in through the in-process `openAuthSession` seam | `libs/profile/tests/e2e/auth-oauth-port` |
| `auth-guest-progress-carryover` | signs in and checks the actor id — **see note** | `libs/profile/tests/e2e/auth-guest-progress-carryover` |
| `profile-edit` | guest and signed-in username + avatar edits | `libs/profile/tests/e2e/edit` |
| `search-people` | people search settles and shows bob's result row | `libs/friends/tests/e2e/search-people` |

> `auth-guest-progress-carryover` asserts less than its name claims: it signs
> in and checks the actor id is present. There is no guest-progress assertion
> in it. It moved as-is so the migration stays behaviour-preserving; the
> missing carryover assertion is tracked separately.

## Not subsystem e2e — 6 specs

| Spec | Covers | Home |
| --- | --- | --- |
| `shell-boot` | two actors boot through the paint gate into the tab shell; focus switching | `apps/product/tests/shell-boot` (smoke) |
| `product-walk` | weighted random walk over the whole action pool | `apps/product/tests/product-walk` (smoke) |
| `product-explore` | `system.explore` search over the action pool | `apps/product/tests/product-explore` (smoke) |
| `topology-partition` | partition an actor from the server, then restore, and still sign up | `apps/product/tests/topology-partition` (platform) |
| `non-web-host-smoke` | host registration and the bun-webview build | `apps/product/tests/non-web-host-smoke` |
| `sw-policy` | service-worker precache/runtime rule coverage — static, no sim | `apps/product/scripts/sw-policy.test.ts` (ordinary test) |
