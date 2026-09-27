# Spec migration inventory (Phase 1, 2026-09-25)

## Status (2026-09-26): product-level Section A migrated

Every product package in Section A now runs its acceptance scenarios from the
flat `specs/<domain>/` tree, and its ported `tests/e2e` files are deleted:

| package | runs | kept in code |
|---|---|---|
| libs/profile | `specs/profile/` | — (`auth-oauth-port` retired 2026-09-27: every Google sign-in scenario walks the same port) |
| libs/friends | `specs/friends/`, `specs/spaces/` | — |
| libs/billing | `specs/billing/` | — |
| libs/chess | `specs/chess/` (incl. `puzzle-spectator.sim.test.ts`) | — |
| libs/runtime | `specs/runtime/`, `specs/journeys/` | — |

(2026-09-26, later) The random walks each package kept in code — `monkey`,
`auth-monkey`, `lifecycle-walk`, `explore` — are replaced by Quint models in
`specs/<domain>/*.qnt`, so the rows below that say "keep in code" for them
are history.

(2026-09-27) `pkgs/room-sim` runs the `rooms` domain (`specDomains`):
`specs/rooms/shared-counter.feature`, `refusals.feature`, `match-clock.feature`,
and the Quint models `specs/rooms/shared-counter.qnt` (convergence across
offline, stalled networks, crashes and room restarts; exactly-once on resent
and taken-over commands) and `specs/rooms/match-clock.qnt`. Its legacy
scenario tests are deleted. Kept in code, as framework contracts:
`determinism.test.ts` (same seed twice, was seeded-workload-determinism and
MC-06), `malformed-messages.test.ts` (wire frames), `standalone-room.test.ts`
(the loopback host seam, was `room.test.ts`), `hash-canonicality`,
`purity-and-seed`. `pkgs/room` still runs `tests/room-server.feature` and
`tests/room-client.feature` beside its tests (engine wire behavior, not yet
demoted to contract tests).

(2026-09-27) The last hand-written chess sim tests (`puzzle-allowance`,
`puzzle-attempt-once`, `puzzle-guest-carryover`, `puzzle-outcome-score`,
`puzzle-selection-window`, `watcher-command-refused` in
`libs/chess/tests/e2e/`) are replaced by scenarios in `specs/chess/`, actions
in `specs/chess/puzzle-session.qnt` (Next twice at once, closing and
reopening the app), and code tests in `libs/chess/tests/puzzle-session/`;
`libs/chess/tests/e2e/` keeps only the sim composition (`support/`). The
watcher-refusal scenarios now assert what the host and watcher see (nothing
changes), not the room's refusal.

Still open:

- **Framework-level sims** (`pkgs/auth-sim`, `pkgs/db-indexes`,
  `pkgs/matchmaking-sim`, `pkgs/room-sim`): deferred to a later wave, as
  marked below.
- **`pkgs/sync-engine`**: ported except four files (see its section).
- **Section B:** candidates only; none ported.
- **Open spec questions:**
  - `puzzle-limit-upgrade`'s old title promised "open billing plans", but only
    the no-limit assertion was ported.
  - The watcher-refusal scenarios reach the room directly, because a watcher's
    drag is a suggestion.
  - An automatic opponent reply shows no last-move highlight (unconfirmed, not
    pinned).
- **Weaker on live-browser hosts:** a scenario that loses the connection on a
  host that cannot partition ends as a host limit (`hostLimit` in
  `@pkgs/gherkin`). On those hosts the billing offline scenario no longer
  asserts paid access or the delinquent server row.

The rest of this document is the original point-in-time inventory.

Source: `inventory.jsonl` (581 test files). Repo root: `corner-prose`.

## 1. Summary counts

**Total files:** 581

**By kind:**

| kind | count |
|---|---|
| unit | 416 |
| e2e | 64 |
| sim | 53 |
| property | 32 |
| contract | 16 |

**By package (top two path segments):**

| package | files | package | files | package | files |
|---|---|---|---|---|---|
| apps/client | 3 | pkgs/aedes-server | 1 | pkgs/observability | 7 |
| apps/product | 5 | pkgs/assert | 1 | pkgs/observability-cli | 3 |
| apps/server | 3 | pkgs/assistant | 2 | pkgs/observability-mcp | 1 |
| libs/auth | 13 | pkgs/async | 4 | pkgs/outbox | 1 |
| libs/billing | 15 | pkgs/async-local | 1 | pkgs/permissions | 7 |
| libs/chess | 49 | pkgs/attribute | 1 | pkgs/property | 1 |
| libs/client-app | 5 | pkgs/auth-inhouse | 9 | pkgs/pubsub | 2 |
| libs/client-config | 2 | pkgs/auth-sim | 5 | pkgs/pubsub-emqx | 3 |
| libs/feature | 1 | pkgs/billing | 3 | pkgs/pubsub-mqtt | 1 |
| libs/friends | 19 | pkgs/billing-mock | 2 | pkgs/room | 2 |
| libs/games | 1 | pkgs/billing-mock-provider | 5 | pkgs/room-adapter-durable-object | 1 |
| libs/observability | 1 | pkgs/billing-paddle | 3 | pkgs/room-adapter-memory | 3 |
| libs/permissions | 7 | pkgs/billing-providers | 1 | pkgs/room-sim | 15 |
| libs/profile | 18 | pkgs/billing-stripe | 5 | pkgs/secret-provider | 2 |
| libs/pubsub | 2 | pkgs/chess-board | 12 | pkgs/secret-store | 3 |
| libs/runtime | 10 | pkgs/chess-board-core | 13 | pkgs/secret-string | 1 |
| libs/server-app | 4 | pkgs/chess-rules | 5 | pkgs/secrets-config | 1 |
| libs/sim-harness | 5 | pkgs/clock | 3 | pkgs/secure-storage | 2 |
| libs/spaces | 11 | pkgs/collab | 1 | pkgs/secure-storage-web | 2 |
| libs/tools | 21 | pkgs/colors | 1 | pkgs/sim | 7 |
| | | pkgs/database-url-policy | 1 | pkgs/sim-console | 8 |
| | | pkgs/db-indexes | 9 | pkgs/sim-report | 3 |
| | | pkgs/db-indexes-postgres | 3 | pkgs/solid-context | 1 |
| | | pkgs/db-indexes-sqlite | 1 | pkgs/sounds | 2 |
| | | pkgs/db-migrate | 2 | pkgs/sql | 3 |
| | | pkgs/db-schema | 3 | pkgs/sql-cli | 2 |
| | | pkgs/db-schema-postgres | 8 | pkgs/sql-client | 1 |
| | | pkgs/db-schema-sqlite | 6 | pkgs/sql-client-contract | 10 |
| | | pkgs/device | 3 | pkgs/sql-client-postgres | 6 |
| | | pkgs/distributed-lock | 1 | pkgs/sql-client-sim | 1 |
| | | pkgs/entity-store | 1 | pkgs/sql-client-sqlite | 1 |
| | | pkgs/equal | 2 | pkgs/sql-client-sqlite-web | 5 |
| | | pkgs/glicko2 | 1 | pkgs/sql-map | 1 |
| | | pkgs/http-client | 3 | pkgs/static-file-server | 1 |
| | | pkgs/idp-sim | 11 | pkgs/sync-engine | 33 |
| | | pkgs/invariants | 1 | pkgs/tailwind | 1 |
| | | pkgs/keyword | 2 | pkgs/task-dag | 1 |
| | | pkgs/kv | 3 | pkgs/tts | 7 |
| | | pkgs/kv-postgres | 1 | pkgs/ui | 52 |
| | | pkgs/kv-web | 1 | pkgs/ui-devtools | 5 |
| | | pkgs/llm | 2 | pkgs/ui-testing | 3 |
| | | pkgs/logger | 1 | pkgs/ui-testing-bun-webview | 2 |
| | | pkgs/message | 2 | pkgs/ui-testing-solid-dom | 4 |
| | | pkgs/ndjson | 4 | pkgs/uuid | 3 |
| | | pkgs/object-store | 2 | pkgs/vite-workspace-resolver | 1 |
| | | pkgs/object-store-node-fs | 2 | pkgs/word-filter | 2 |
| | | pkgs/object-store-opfs | 3 | | |
| | | pkgs/object-store-s3 | 1 | | |

**Headline for this report:** 109 files to port (Section A) · 22 candidate files (Section B) · 450 files stay in code (Section C).

Note: 4 files carry kind `sim` but are framework/mechanics tests, not product scenarios, and are treated as Section C despite the kind tag: `pkgs/sim/src/run/restart-monitor.test.ts`, `pkgs/sim/tests/explore.test.ts`, `pkgs/sim/tests/report.test.ts`, `pkgs/sim-report/tests/html-report.test.ts` (the sim/report framework's own tests), plus `pkgs/chess-board-core/{destinations,game-status,move-sound}.test.ts` (chess engine mechanics/scheduling, not user scenarios) and `pkgs/sql-client-sim/src/sql-client-web.test.ts` (a port property/fault-injection suite). These are listed and reasoned in Section C.

---

## 2. Section A — Acceptance / e2e / sim tests (must port to Gherkin)

109 files total.

### libs/billing (6)

| File | Goal tags | Scenarios | Notes |
|---|---|---|---|
| `libs/billing/tests/e2e/lifecycle-walk.test.tsx` | — | describe: billing lifecycle walk<br>every reachable lifecycle holds the standing properties | monkey/explore walk (keep in code) |
| `libs/billing/tests/e2e/lifecycle.test.tsx` | guest-free-and-paid:9 | the trial becomes active at the period end<br>a renewal moves the period end forward and stays paid<br>a failed payment is delinquent but stays paid inside grace<br>a recovered payment is active with a future period end<br>cancel_at_period_end keeps it paid, then the period end ends it<br>resuming before the period end keeps the membership live<br>cancel_now ends the membership immediately<br>resubscribing after the end starts a new live membership<br>switching the interval during the trial keeps the trial<br>switching the interval after the trial starts a paid year now<br>a renewal that keeps failing ends after the last retry<br>a guest is offered the unlock and a second signed-in actor stays free<br>a redelivered event leaves one identical row | large lifecycle matrix; port each row as its own scenario |
| `libs/billing/tests/e2e/monkey.test.tsx` | — | a random walk through billing holds every standing property | monkey/explore walk (keep in code) |
| `libs/billing/tests/e2e/offline.test.tsx` | — | the synced delinquent row answers paid while partitioned | |
| `libs/billing/tests/e2e/portal.test.tsx` | guest-free-and-paid:8 | cancel, renew and switch interval through the provider's portal | multi-behavior test — split (cancel / renew / switch are separate outcomes) |
| `libs/billing/tests/e2e/subscribe.test.tsx` | guest-free-and-paid:7 | sign in → subscribe → paid tier with a trialing monthly row | |

### libs/chess (23)

| File | Goal tags | Scenarios | Notes |
|---|---|---|---|
| `libs/chess/src/sim/puzzle-spectator.sim.test.ts` | — | describe: chess room sim: host drives, guest spectates<br>a guest cannot drive and both clients converge on host truth | |
| `libs/chess/tests/e2e/monkey.test.tsx` | — | a random walk through puzzles holds every standing property | monkey/explore walk (keep in code) |
| `libs/chess/tests/e2e/puzzle-controls.test.tsx` | chess-puzzles:9 | wrong move → Retry reverts the ply → solve<br>hint highlights, second hint reveals the solution, board stays solvable<br>Solution is offered after a wrong move<br>a wrong move then Retry then solve still logs as Failed | |
| `libs/chess/tests/e2e/puzzle-exhaust.test.tsx` | chess-puzzles:5 | after every unseen puzzle is solved, the oldest attempt comes round again, unrated<br>a theme filter that matches nothing shows the empty state; widening recovers | |
| `libs/chess/tests/e2e/puzzle-feed.test.tsx` | chess-puzzles:3,4 | history filter edit is reflected everywhere after Done<br>rating offset moves the target shown in the modal and the feed bar<br>custom mode swaps the target source and survives reopen<br>custom difficulty target changes the selected puzzle band | |
| `libs/chess/tests/e2e/puzzle-guest-carryover.test.tsx` | works-offline:5, always-true:1,2,10, social:2 | an offline guest solve survives Google sign-in and reaches a second device once | regression tag `puzzle-profile-volatility-sync` |
| `libs/chess/tests/e2e/puzzle-guest-play.test.tsx` | social:1 | a guest opens the app, hosts, and solves puzzles — no sign-in anywhere | multi-behavior test — split (open/host/solve are distinct steps but read as one journey; consider one scenario with steps) |
| `libs/chess/tests/e2e/puzzle-ingest.test.tsx` | — | boot seeds only valid puzzles; ingest lands only the valid rows; the board faces the solver | multi-behavior test — split (seed validity, ingest validity, board orientation are 3 outcomes joined by `;`) |
| `libs/chess/tests/e2e/puzzle-limit-upgrade.test.tsx` | guest-free-and-paid:6 | twenty completed puzzles show the limit and open billing plans | |
| `libs/chess/tests/e2e/puzzle-offline.test.tsx` | works-offline:2, always-true:1 | offline with no local pool shows the offline block; reconnect recovers<br>an offline wrong move syncs exactly once after reconnect | first title multi-behavior — split (offline block vs reconnect recovery) |
| `libs/chess/tests/e2e/puzzle-outcome-sync.test.tsx` | chess-puzzles:9, works-offline:4, always-true:3 | ${entry.name} has the goal's score locally and after reconnect | regression tag `puzzle-wrong-move-half-credit`; templated title expands to one scenario per outcome kind |
| `libs/chess/tests/e2e/puzzle-play.test.tsx` | chess-puzzles:1 | host solves a seeded mate-in-1 via board drag<br>next never repeats the active puzzle | |
| `libs/chess/tests/e2e/puzzle-quota.test.tsx` | — | the board completes at the limit; the next start is denied and never charged<br>signing in lifts the limit with no code branching on who the user is | first title multi-behavior — split (complete-at-limit vs denied-and-not-charged) |
| `libs/chess/tests/e2e/puzzle-rating.test.tsx` | chess-puzzles:8 | a new player starts at 1500 provisional; a solve raises it, a fail lowers it<br>the provisional marker clears once RD drops below the threshold<br>an offline solve reconciles to the server value and never double-applies<br>a repeat attempt on an already-rated puzzle leaves the rating alone<br>two devices of one account converge on a single rating | first title multi-behavior — split (start value / solve raises / fail lowers) |
| `libs/chess/tests/e2e/puzzle-review.test.tsx` | chess-puzzles:7 | buttons, the move list and the ends scrub the solved line<br>arrow keys step and Home / End jump<br>a horizontal swipe scrubs one ply at a time<br>review after a failed attempt still scrubs the whole line<br>the revealed state scrubs the full line in place<br>a retired puzzle still opens in review from the game log | |
| `libs/chess/tests/e2e/puzzle-selection.test.tsx` | chess-puzzles:9 | no repeat while unseen puzzles remain, and low-quality is never served<br>the window widens with RD and narrows as the rating settles<br>pool exhaustion serves the oldest attempt first, unrated | first title multi-behavior — split (no-repeat vs low-quality-never-served) |
| `libs/chess/tests/e2e/puzzle-skip-clock.test.tsx` | — | started clock ticks then freezes on solve<br>skip is terminal and unrated<br>Next after a skip loads a fresh puzzle | |
| `libs/chess/tests/e2e/puzzle-solve-flow.test.tsx` | chess-puzzles:5 | a clean multi-move solve: setup move, reply, one recorded outcome<br>the first wrong move is the outcome; retry, solve and show solution never re-rate<br>only the side to move moves; an illegal drop snaps back unpunished<br>input is locked after a wrong move and after the puzzle ends<br>the remaining line plays out, review opens and it counts as a fail<br>underpromotion is the solution and the queen is never picked for you<br>a capture-promotion that mates with another piece is accepted<br>en passant as the solution<br>another mate on the final move is accepted<br>a faster mate on a non-final move ends the puzzle as solved<br>a transposing move is accepted and the line continues reordered<br>solver is Black: orientation, prompt and promotion picker follow<br>the solver is in check at the start of the attempt | 4 describes bundled in one file (§5 solve flow, §3/34 input rules, §6 show solution, §34 chess move rules); split into separate feature files by describe |
| `libs/chess/tests/e2e/puzzle-solve-session.test.tsx` | chess-puzzles:5 | leaving mid-attempt keeps the puzzle pending and restores it<br>the app killed mid-puzzle restores the same pending attempt<br>tapping Next twice advances exactly one puzzle<br>the next puzzle is prefetched and Next needs no network<br>auto-advance moves on by itself after a solve | |
| `libs/chess/tests/e2e/puzzle-spectator.test.tsx` | chess-puzzles:12, always-true:7 | a guest watching the host solve is not rated for it<br>a guest spectates: no driving, suggestions broadcast, host move clears them | second title multi-behavior — split (no-driving / suggestions-broadcast / host-move-clears) |
| `libs/chess/tests/e2e/puzzle-stats-p0.test.tsx` | chess-puzzles:15 (out of range, see §5) | rating, solved and accuracy are folds of the rating ledger<br>an unrated repeat attempt moves none of the three figures<br>the provisional marker clears once RD settles, figures still hold | |
| `libs/chess/tests/e2e/puzzle-stats.test.tsx` | chess-puzzles:2,11 | a solve raises Elo and lands in the game log; review opens the board<br>a wrong move drops Elo and logs a Failed row | first title multi-behavior — split (Elo+game-log vs review-opens-board) |
| `libs/chess/tests/e2e/space-host-select-game.test.tsx` | spaces:3 | the host picks chess and everyone in the space is taken to it | |

### libs/friends (18)

| File | Goal tags | Scenarios | Notes |
|---|---|---|---|
| `libs/friends/tests/e2e/block.test.tsx` | — | blocking ends the friendship for both; unblocking lets them start over<br>a stranger who asks can be blocked from their profile: the request goes, and so do they | both titles multi-behavior — split |
| `libs/friends/tests/e2e/friend-in-open-space.test.tsx` | social:6, spaces:7 | bob sees alice is in an open space, live, and joins from his friends list | |
| `libs/friends/tests/e2e/gates.test.tsx` | social:1 | a guest is asked to sign in, on search and on the friends list<br>a guest's friends row asks them to sign in<br>no friends yet: the list says so and Find friends opens search | |
| `libs/friends/tests/e2e/monkey.test.tsx` | — | a random walk through friends and spaces holds every standing property | monkey/explore walk (keep in code) |
| `libs/friends/tests/e2e/person-profile.test.tsx` | social:5 | ask from their profile, answer from theirs: both become friends and the counts say so<br>a request's View profile shows who is asking; Delete there turns it down | both titles multi-behavior — split |
| `libs/friends/tests/e2e/profile-changes.test.tsx` | social:3 | bob renames: alice's friends list and search follow | |
| `libs/friends/tests/e2e/remove.test.tsx` | social:5 | alice removes bob: the friendship is gone for both | |
| `libs/friends/tests/e2e/request-accept.test.tsx` | social:5 | alice sends a request; bob accepts from his inbox; both see each other | multi-behavior test — split (send / accept / both-see are 3 steps) |
| `libs/friends/tests/e2e/request-decline-cancel.test.tsx` | social:5 | bob declines: neither is a friend, and asking again at once is refused with a reason<br>alice cancels: the request leaves bob's inbox | |
| `libs/friends/tests/e2e/search-people.test.tsx` | — | search settles and finds bob by username | |
| `libs/friends/tests/e2e/space-create.test.tsx` | — | host creates a space and sees it in the lobby | |
| `libs/friends/tests/e2e/space-disconnect-reconnect.test.tsx` | spaces:5 | a guest disconnected when the host ends sees the ended space on reconnect<br>losing the connection and getting it back leaves bob there once<br>closing the app and coming back returns bob to the space, once | |
| `libs/friends/tests/e2e/space-end.test.tsx` | — | host ends; guest sees ended state | |
| `libs/friends/tests/e2e/space-friend-join.test.tsx` | spaces:7 | host creates; friend joins from lobby card | |
| `libs/friends/tests/e2e/space-guest-host.test.tsx` | spaces:1 | a guest creates a space and hosts it<br>a guest host can end their own space | |
| `libs/friends/tests/e2e/space-guest-link-join.test.tsx` | spaces:2, social:1 | a guest with no account opens the link and joins the space | |
| `libs/friends/tests/e2e/space-lifecycle.test.tsx` | spaces:6 | the host reopens their live space after returning to the lobby | |
| `libs/friends/tests/e2e/space-live-presence.test.tsx` | spaces:4 | everyone sees who is there, and who has left, live | multi-behavior — split (who's there vs who has left) |

### libs/profile (13)

| File | Goal tags | Scenarios | Notes |
|---|---|---|---|
| `libs/profile/tests/e2e/account.test.tsx` | social:2,3 | signing out leaves the profile with the account; signing back in brings it back<br>the same account on a second device shows the same profile, and edits follow live | both titles multi-behavior — split |
| `libs/profile/tests/e2e/auth-apple.test.tsx` | — | a first sign-in with Apple makes an account that lists Apple<br>Google then Apple with the same verified address is one account<br>Hide My Email is a separate account until linked | |
| `libs/profile/tests/e2e/auth-guest-progress-carryover.test.tsx` | social:2, always-true:10 | a guest signs in with Google and keeps the name and avatar they made | |
| `libs/profile/tests/e2e/auth-linking.test.tsx` | — | connect Apple, sign in with it, then remove it<br>the only sign-in method cannot be removed<br>an Apple Account that belongs to another account can't be connected<br>confirm: signing in to the existing account connects Apple to it<br>keep separate: the new sign-in becomes its own account | |
| `libs/profile/tests/e2e/auth-login-logout.test.tsx` | social:1 | first login → logout on the account screen | |
| `libs/profile/tests/e2e/auth-monkey.test.tsx` | — | seed ${seed}: a random walk through sign-in methods holds every property | monkey/explore walk (keep in code) |
| `libs/profile/tests/e2e/auth-oauth-port.test.ts` | — | google sign-in via in-process openAuthSession | |
| `libs/profile/tests/e2e/auth-offline.test.tsx` | — | a sign-in started offline fails cleanly, then succeeds back online<br>signing out offline signs this device out | first title multi-behavior — split (fails-cleanly vs succeeds-once-online) |
| `libs/profile/tests/e2e/auth-sessions.test.tsx` | — | sign out of all devices ends the other device too<br>stopping Apple sign-in for the app signs the account out; Apple still gets back in<br>deleting the only Apple Account ends its sessions<br>deleting a linked Apple Account keeps the account and its Google sign-in | second title multi-behavior — split |
| `libs/profile/tests/e2e/defaults.test.tsx` | social:3 | a first-time guest already has a username and an avatar of their own | |
| `libs/profile/tests/e2e/edit.test.tsx` | — | guest updates username<br>guest updates avatar<br>avatar edits left with Cancel are not saved<br>signed-in updates username<br>signed-in updates avatar | |
| `libs/profile/tests/e2e/monkey.test.tsx` | — | a random walk through profile and sign-in holds every standing property | monkey/explore walk (keep in code) |
| `libs/profile/tests/e2e/username-rules.test.tsx` | social:3,4 | a refused name says why and changes nothing; a good one is kept lower-case<br>a draft left with Cancel is not saved<br>a username belongs to one person, whatever the letter case | first title multi-behavior — split |

### libs/runtime (4)

| File | Goal tags | Scenarios | Notes |
|---|---|---|---|
| `libs/runtime/tests/e2e/explore.test.tsx` | — | explore episodes over defineAction pool hold properties | monkey/explore walk (keep in code) |
| `libs/runtime/tests/e2e/monkey.test.tsx` | — | a random walk over every feature holds every standing property | monkey/explore walk (keep in code) |
| `libs/runtime/tests/e2e/shell-boot.test.tsx` | — | two actors boot into the tab shell, open Settings, switch focus | multi-behavior test — split (boot / open Settings / switch focus) |
| `libs/runtime/tests/e2e/topology-partition.test.tsx` | — | partition alice–server then restoreNetwork still allows sign-up | |

### pkgs/auth-sim (4) — framework-level sim (no product UI); port in a later wave

| File | Goal tags | Scenarios | Notes |
|---|---|---|---|
| `pkgs/auth-sim/tests/linking.test.ts` | — | a verified address shared by Google and Apple is one account<br>Apple first, Google second: still one account<br>Hide My Email never links by address<br>an unverified match must be proven: confirm links it<br>an unverified match can be declined: a separate account<br>proving with the wrong account discards the pending link<br>a pending link expires<br>link Apple to a Google account, then sign in with either<br>an identity that belongs to someone else cannot be linked<br>a link ticket minted for one session never serves another<br>one identity per provider<br>unlink: never the last method; the unlinked one starts fresh | framework-level sim (no product UI); port in a later wave |
| `pkgs/auth-sim/tests/network-and-sessions.test.ts` | — | signing in offline fails cleanly; back online it works<br>signing out offline forgets the device; the server session survives<br>linking or unlinking offline changes nothing<br>sessions expire after their TTL<br>sign out everywhere ends every device of the account<br>a stolen bearer works until its session is revoked<br>linking retires the old session and keeps the account | framework-level sim; port in a later wave |
| `pkgs/auth-sim/tests/provider-behaviour.test.ts` | — | revoking the app at Apple signs the account out everywhere<br>deleting the Apple Account: the only way in is gone, so is the session<br>deleting the Apple Account keeps a session that has Google too<br>relay forwarding switched off at Apple is recorded<br>a changed Google address keeps the account and updates the identity<br>${fault}: sign-in fails, nothing changes, and recovers<br>${fault}: tolerated<br>a denied consent is a cancellation<br>key rotation: the relying party refetches the JWKS | framework-level sim; port in a later wave |
| `pkgs/auth-sim/tests/sign-in.test.ts` | — | google: launch → provider screens → callback → session<br>apple: form_post callback, hidden email, session | framework-level sim; port in a later wave |

### pkgs/db-indexes (1) — framework-level sim; port in a later wave

| File | Goal tags | Scenarios | Notes |
|---|---|---|---|
| `pkgs/db-indexes/tests/scenario/regressions.test.ts` | — | seed replay is byte-identical on owned count<br>fixpoint after enough fault-free runs<br>usage since deprecation never drops | framework-level sim (no product UI); port in a later wave |

### pkgs/matchmaking-sim (3) — framework-level sim; port in a later wave

| File | Goal tags | Scenarios | Notes |
|---|---|---|---|
| `pkgs/matchmaking-sim/tests/join-status-leave.test.ts` | — | round-trips participant data through status while waiting<br>status returns null for unknown id<br>leave removes the row<br>ready() is idempotent<br>leave on unknown id returns removed:false<br>leave on matched participant returns removed:false | framework-level sim; port in a later wave |
| `pkgs/matchmaking-sim/tests/replicas-shared-db.test.ts` | — | join r0 / status r1 / leave r2 see the same store<br>updateFormulas on a different replica than join<br>ready() is idempotent on every replica | framework-level sim; port in a later wave |
| `pkgs/matchmaking-sim/tests/seeded-workload.test.ts` | — | same seed yields identical match fingerprint twice | seeded-workload determinism (keep in code); framework-level sim |

### pkgs/room-sim (12) — framework-level sim; port in a later wave

| File | Goal tags | Scenarios | Notes |
|---|---|---|---|
| `pkgs/room-sim/tests/authorize-reject.test.ts` | — | authorize hook denies without mutating | framework-level sim; port in a later wave |
| `pkgs/room-sim/tests/command-id-replay-dedup.test.ts` | — | same commandId applies once across reconnect storm | framework-level sim; port in a later wave |
| `pkgs/room-sim/tests/crash-restart.test.ts` | — | client crash keeps local queue; restart + settle staysInSync<br>server crash + restart hydrates log and staysInSync<br>boundary afterNextCommitted crashes client; settle restores<br>checkInvariants passes on healthy run | framework-level sim; port in a later wave |
| `pkgs/room-sim/tests/malformed-frame-reject.test.ts` | — | non-Message command payload rejects without mutate<br>unknown wire kind is ignored without mutate | framework-level sim; port in a later wave |
| `pkgs/room-sim/tests/match-clock-schedule.test.ts` | — | MC-01: runFor past flag → server FlagFall terminal; clients converge<br>MC-02: move before flag cancels; opponent clock active<br>MC-03: lagging held client cannot move after server flag<br>MC-04: early client FlagFall rejected; server still flags at at<br>MC-05: soft disconnect during tick; reconnect after flag<br>MC-06: seeded clock workload ×2 identical serverHash | framework-level sim; MC-06 is a seeded-workload determinism case (keep in code) |
| `pkgs/room-sim/tests/offline-dispatch-then-sync.test.ts` | — | optimistic increment flushes after reconnect | framework-level sim; port in a later wave |
| `pkgs/room-sim/tests/partition-then-heal.test.ts` | — | held peer never sees write until restoreNetwork + converge | framework-level sim; port in a later wave |
| `pkgs/room-sim/tests/seeded-workload-determinism.test.ts` | — | same seed yields identical multi-client hash twice | monkey/explore walk (keep in code); framework-level sim |
| `pkgs/room-sim/tests/session-takeover-sim.test.ts` | — | take-over mid-command does not double-apply | framework-level sim; port in a later wave |
| `pkgs/room-sim/tests/single-client-increment.test.ts` | — | increment staysInSync to server hash | framework-level sim; port in a later wave |
| `pkgs/room-sim/tests/two-client-converge.test.ts` | — | mutual increments yield equal hashes and roster | framework-level sim; port in a later wave |
| `pkgs/room-sim/tests/unknown-command-reject.test.ts` | — | unknown message type rejects without mutate | framework-level sim; port in a later wave |

### pkgs/sync-engine — ported (2026-09-27)

The 20 scripted sim tests are gone. Person-observable claims are
`specs/sync/*.feature` (run by `@pkgs/sync-engine` `test:e2e`, `specDomains:
["sync"]`, goal tags carried over); stateful internals and every seed sweep are
the package-local model `pkgs/sync-engine/tests/quint/note-replication.qnt`
(run from the package `test` by `note-replication.quint.test.ts`); wire and
storage claims stay contract tests. Parity:

| Former file | Now |
|---|---|
| `single-client-mutate-uploads-and-persists`, `two-client-mutual-writes-converge` | `specs/sync/note-writing.feature`; seed sweep → `note-replication.qnt` |
| `same-actor-two-devices-converge` (works-offline:5, always-true:2) | `specs/sync/notes-across-devices.feature` |
| `soft-delete-tombstone-propagates-and-revives` | `specs/sync/note-deleting.feature` |
| `crash-restart-rehydrates-and-drains-queue` (always-true:1) | `specs/sync/notes-offline.feature`, `notes-after-a-crash.feature`; model `crashAndReopen` |
| `upload-response-lost-retry-does-not-double-apply` (works-offline:4, always-true:3) | `specs/sync/notes-saved-once.feature`; model `setNoteReplyLost` / `retryUpload`, `invNoDoubleApply` |
| `requires-online-fails-offline-without-queue` (works-offline:6) | `specs/sync/online-only-actions.feature` |
| `permanent-reject-stored-peer-never-applies` | `specs/sync/note-refused-edits.feature`; model `rejections` |
| `leave-drops-room-topic-until-rejoin`, `membership-revoked-mid-session-…` | `specs/sync/shared-space-membership.feature`; topic drop without remake → `tests/space-topic-scope.test.ts` |
| `denied-query-detaches-scope-keeps-rows` | `tests/space-topic-scope.test.ts` |
| `full-partition-during-write-then-heal`, `live-loss-dup-reorder-stays-in-sync`, `non-mutation-server-write-without-notify-…` | `note-replication.qnt` (`goOffline` / `goOnline`, `degradeLive`, `operatorEdit`) |
| `merge-via-sim` | local-only columns → `tests/merge-local-columns.test.ts`; pending over tombstone → model + `pending-rebase.property.test.ts` |
| `deep-pending-chain-rebases-in-seq-order` | `tests/deep-offline-queue.test.ts` |
| `epoch-bump-wipes-cache-preserves-pending-uploads` | `tests/schema-epoch-bump.test.ts` (one seed) |
| `fanout-row-cap-boundary-64-vs-65` | `tests/fanout-row-cap.test.ts` |
| `domain-hard-delete-rejected` | `tests/hard-delete-refused.test.ts` |
| `seeded-workload-fuzz-determinism` | `tests/exploration.test.ts` (determinism + pool faults the model does not draw) |

Still open in `pkgs/sync-engine/tests/`: `invariant-check-waits-for-in-flight-verdict` (regression `invariant-dirty-read`), `peer-visibility-latency-budget` (perf budget; the-bar:3, works-offline:7), `pending-ux-answers-with-server-verdict`, `schema-drift`.

---

## 3. Section B — Unit-tier libs/ tests that read as behavior specs (candidates to port)

22 files.

| File | Goal tags | Reason |
|---|---|---|
| `libs/permissions/tests/consume-quota.test.ts` | — | Quota rules a user experiences directly: anonymous daily limit, verified = unlimited, server-clock-decided window resists client skew, exactly-once consumption under replay/race. |
| `libs/permissions/tests/plan.test.ts` | guest-free-and-paid:10, always-true:4,5 | Membership → role rules users see: trial/active/delinquent/ended/grace mapping to paid vs free access. |
| `libs/permissions/tests/plan-properties.test.ts` | — | States the access-over-time invariants (monotone, grace window bounds) behind the paid/free experience. |
| `libs/permissions/tests/policy.test.ts` | guest-free-and-paid:1,4 | What each role (guest/free/paid/host) is allowed to do — directly the guest/free/paid spec. |
| `libs/permissions/tests/policy-matrix.test.ts` | — | Exhaustive statement of what each caller is told (restrictions/unlocks) per plan × key/limit. |
| `libs/permissions/tests/catalog-resolution.test.ts` | — | States the permissive-baseline behavior (every grant allowed except anonymous rated) that is a product policy, not an implementation detail. |
| `libs/profile/tests/username-integrity.test.ts` | social:3,4, always-true:9 | Username uniqueness + content-filter rules users hit when picking a name. |
| `libs/auth/src/root/server/anon-user-service.test.ts` | social:2, always-true:10 | Guest → account upgrade rules (device binding, forceNew, linking to an existing account) — user-visible identity continuity. |
| `libs/auth/src/public/signup-username.test.ts` | — | The accept/reject rule for a signup username (length, characters). |
| `libs/chess/src/shared/chess/chess-puzzle-play.test.ts` | chess-puzzles:6,7, always-true:8 | The puzzle-play authorization/state-machine rules users experience: guest denied every control, host-only submit/skip/reset, hint escalation, spectator suggestions — large FSM spec, currently only unit-tested. |
| `libs/chess/tests/puzzle-session/feed-sync-bands.test.ts` | works-offline:3 | Defines what rating-band data is synced/visible to a client (sync-visibility rule), not just a pure-function detail. |
| `libs/chess/tests/puzzle-session/rate-puzzle-attempt.test.ts` | — | Ownership + idempotency rules for rating writes ("a rating for someone else is rejected", replay-safe). |
| `libs/billing/src/use-cases/apply-subscription-state/server/billing-callback-route.test.ts` | — | Callback API route behavior (503 unconfigured, reject unverified, ignore unlinked, notify on resolved change). |
| `libs/billing/src/use-cases/create-checkout-session/server/billing-checkout-route.test.ts` | guest-free-and-paid:7 | Checkout API route behavior (link/reuse customer, 502 on bad provider response). |
| `libs/billing/src/use-cases/open-portal-session/server/billing-portal-route.test.ts` | guest-free-and-paid:8 | Portal API route behavior (404 no customer, 502 no url). |
| `libs/billing/tests/billing-routes-matrix.test.ts` | — | Cross-cutting statement of route behavior over every caller × provider combination. |
| `libs/games/tests/game-plugin-contract.test.ts` | room-to-grow:1,2 | States the "add a game without product changes" extensibility promise as a testable contract. |
| `libs/runtime/tests/migrate-legacy-integer-width.test.ts` | — | Migration's outcome is explicitly called out in the brief as a candidate category (schema width widen affecting synced column safety). |
| `libs/client-app/tests/shell/resolve-connectivity-status.test.ts` | — | Maps device/sync signals to the connectivity status shown to the user (online/pending/warning/offline). |
| `libs/spaces/src/root/client/my-live-space-seat-sql.test.ts` | social:6 | Sync-visibility rule: which live spaces show up in a person's shared list (host/ACL/friend-seated cases). |
| `libs/spaces/tests/guest-space-join.test.ts` | spaces:2 | Guest access-control rules for joining public/private/ACL spaces. |
| `libs/spaces/tests/space-participation-policy.test.ts` | — | Host/ownership rules under member-id drift — a permissions edge case users could hit. |

---

## 4. Section C — Keep in code

450 files. Summarized by package.

| Package | Count | Reason |
|---|---|---|
| apps/client | 3 | Build/bundle-budget tooling checks (critical-path imports, perf gates) — CI tooling, not product behavior. |
| apps/product | 5 | Product-composition/scenario harness scaffolding (sim host wiring), not user-facing scenarios themselves. |
| apps/server | 3 | Server wiring/implementation unit tests. |
| libs/auth | 11 | Client/server plumbing units (token refresh, bearer resolution, session capability) — mechanism, not user story; not selected for B. |
| libs/billing | 5 | View-model/screen-view rendering units and deployment reconciliation (sync-billing-offer) — implementation detail, not selected for B. |
| libs/chess | 23 | Pure-function/state-derivation units for puzzle UI (notation, nav, clock, action-bar plan, cell feedback, rating math, SQL builders) and puzzle-data validation/ingest parsers — logic already exercised end-to-end in Section A e2e specs. |
| libs/client-app | 4 | Shell composition/i18n fallback/wall-adapter units. |
| libs/client-config | 2 | Config parsing + build-guard checks. |
| libs/feature | 1 | Composition-helper unit test. |
| libs/friends | 1 | Non-selected unit leftover (not a candidate). |
| libs/observability | 1 | Infra-config check (Grafana Cloud traces wiring). |
| libs/permissions | 1 | `plan-state-space.test.ts` — exhaustive cartesian-product coverage check, implementation-detail completeness test (the behavior-facing files from this dir are in Section B). |
| libs/profile | 4 | Avatar-config units + non-selected leftovers. |
| libs/pubsub | 2 | Token-minting/credential-rotation mechanism, not user-facing. |
| libs/runtime | 4 | App-schema/query wiring and feature-boundary composition checks (migrate-legacy-integer-width moved to B). |
| libs/server-app | 4 | Server framework plumbing (CORS, fetch serving, provider resolution). |
| libs/sim-harness | 5 | Harness-only test-infra units (host compile, observability artifact, transport plumbing). |
| libs/spaces | 8 | Layout/format/session-store pure-function units (behavior-facing ones moved to B). |
| libs/tools | 21 | Repo CI/tooling scripts (goal-tag lint, naming, budgets, turbo graph, secrets scan, i18n) — meta-tooling, not product behavior. |
| pkgs/aedes-server | 1 | MQTT broker adapter unit. |
| pkgs/assert / attribute / colors / equal / keyword / logger / invariants / message / task-dag / tailwind / vite-workspace-resolver | 12 | Agnostic pkgs micro-utility unit tests (assertions, small data helpers). |
| pkgs/assistant | 2 | Agnostic utility units. |
| pkgs/async / async-local / ndjson | 9 | Async/stream primitive unit tests. |
| pkgs/auth-inhouse | 9 | In-house OAuth/OIDC mechanism units (token/JWKS handling), a port implementation, not product scenarios. |
| pkgs/auth-sim | 1 | `random-walk.test.ts` — monkey/explore walk (keep in code). |
| pkgs/billing, billing-mock, billing-mock-provider, billing-paddle, billing-providers, billing-stripe | 19 | Billing provider port/adapter/contract tests against vendor APIs — port-level, not product scenarios. |
| pkgs/chess-board, chess-board-core, chess-rules | 30 | Chess engine/board mechanics (move destinations, game-status agreement with chess.js, move-sound scheduling, board rendering) — implementation detail exercised via the libs/chess e2e specs in Section A. |
| pkgs/clock / device / secure-storage / secure-storage-web / secret-provider / secret-store / secret-string / secrets-config / database-url-policy | 19 | Injected-port unit tests for wall adapters and secret handling. |
| pkgs/collab | 1 | Utility unit test. |
| pkgs/db-indexes | 8 | Index-declaration invariant checks (naming, ownership, idempotence, determinism) — DB-index framework's own correctness tests (scenario/regressions.test.ts is the one sim scenario, in Section A). |
| pkgs/db-indexes-postgres / db-indexes-sqlite | 4 | Port-level index-engine adapters. |
| pkgs/db-migrate / db-schema / db-schema-postgres / db-schema-sqlite | 19 | Schema/migration engine's own DDL-emission unit tests — framework mechanics, not product scenarios. |
| pkgs/distributed-lock / entity-store / glicko2 / outbox / property / solid-context / sounds / sql-map / static-file-server / word-filter | 11 | Agnostic utility unit tests. |
| pkgs/http-client / kv / kv-postgres / kv-web | 8 | Injected-port unit tests. |
| pkgs/idp-sim | 11 | IdP test-double mechanics (Apple/Google flow simulation, page rendering) — sim-fixture framework, not product scenarios. |
| pkgs/llm | 2 | LLM port unit tests. |
| pkgs/object-store, object-store-node-fs, object-store-opfs, object-store-s3 | 8 | Object-store port/adapter unit + contract tests. |
| pkgs/observability, observability-cli, observability-mcp | 11 | Observability tooling unit tests. |
| pkgs/permissions | 7 | Policy-engine's own unit/property tests (parse, decision, evaluate, quota-window) — the product-facing rules built on top are in libs/permissions (Section B); `evaluate-cost.property.test.ts` is a property test (excluded per instructions). |
| pkgs/pubsub, pubsub-emqx, pubsub-mqtt | 6 | Pub/sub port/adapter + contract tests against the broker. |
| pkgs/room, room-adapter-durable-object, room-adapter-memory | 6 | Room-port adapter unit tests. |
| pkgs/room-sim | 3 | `hash-canonicality.test.ts`, `purity-and-seed.test.ts`, `room.test.ts` — room-sim framework's own determinism/purity unit tests (the sim scenarios are in Section A, framework-level). |
| pkgs/secret-* (see above) | — | (counted above) |
| pkgs/sim | 7 | The sim framework's own tests (explore/randomActions engine, report/recording engine, restart-monitor) — explicitly framework-internal, not a product scenario. |
| pkgs/sim-console | 8 | Dev console UI units (SQL notebook, node selection) — dev tooling, not product behavior. |
| pkgs/sim-report | 3 | The HTML report writer's own tests — framework-internal. |
| pkgs/sql, sql-cli, sql-client, sql-client-contract, sql-client-postgres, sql-client-sim, sql-client-sqlite, sql-client-sqlite-web | 27 | SQL-client port/contract/property tests against engines, plus a multi-tab fault-injection property suite (`sql-client-sim`) — port-level, not product scenarios. |
| pkgs/sync-engine | 9 | Sync-engine's own unit/property tests (`define-wrap-mutate`, `engine-watch`, `no-product-vocabulary`, `query-not-modified`, `server-authorize-mutation`, `solid-bindings`, plus 3 `.property.test.ts` files) — framework mechanics/properties, excluded per instructions (product-facing scenarios are in Section A). |
| pkgs/task-dag | — | (counted above) |
| pkgs/tts | 7 | TTS provider port unit tests. |
| pkgs/ui | 52 | Design-system component unit tests — implementation detail of `@pkgs/ui`. |
| pkgs/ui-devtools, ui-testing, ui-testing-bun-webview, ui-testing-solid-dom | 14 | Test-harness/devtools infrastructure unit tests. |
| pkgs/uuid | 3 | Id-generation port unit tests. |

Property tests (32, kind `property`) and contract tests against ports (16, kind `contract`, excluding the 3 billing route files already placed in Section B) are counted within their packages above and are Keep-in-code by definition — they check port/engine invariants across generated inputs, not a single product scenario.

---

## 5. Goal coverage

Every distinct `goal:<section>:<n>` tag found, with carrying files. Known statement ranges: the-bar 1-6, spaces 1-7, works-offline 1-7, social 1-6, chess-puzzles 1-12, guest-free-and-paid 1-10, always-true 1-10, room-to-grow 1-6.

| Tag | Files |
|---|---|
| always-true:1 | libs/chess/tests/e2e/puzzle-guest-carryover.test.tsx; libs/chess/tests/e2e/puzzle-offline.test.tsx; pkgs/sync-engine/tests/crash-restart-rehydrates-and-drains-queue.test.ts |
| always-true:2 | libs/chess/tests/e2e/puzzle-guest-carryover.test.tsx; pkgs/sync-engine/tests/same-actor-two-devices-converge.test.ts |
| always-true:3 | libs/chess/tests/e2e/puzzle-outcome-sync.test.tsx; pkgs/sync-engine/tests/upload-response-lost-retry-does-not-double-apply.test.ts |
| always-true:4 | libs/permissions/tests/plan.test.ts |
| always-true:5 | libs/permissions/tests/plan.test.ts |
| always-true:6 | pkgs/permissions/tests/evaluate.test.ts |
| always-true:7 | libs/chess/tests/e2e/puzzle-spectator.test.tsx |
| always-true:8 | libs/chess/src/shared/chess/chess-puzzle-play.test.ts |
| always-true:9 | libs/profile/tests/username-integrity.test.ts |
| always-true:10 | libs/auth/src/root/server/anon-user-service.test.ts; libs/chess/tests/e2e/puzzle-guest-carryover.test.tsx; libs/profile/tests/e2e/auth-guest-progress-carryover.test.tsx |
| chess-puzzles:1 | libs/chess/tests/e2e/puzzle-play.test.tsx |
| chess-puzzles:2 | libs/chess/tests/e2e/puzzle-stats.test.tsx |
| chess-puzzles:3 | libs/chess/tests/e2e/puzzle-feed.test.tsx |
| chess-puzzles:4 | libs/chess/tests/e2e/puzzle-feed.test.tsx |
| chess-puzzles:5 | libs/chess/tests/e2e/puzzle-exhaust.test.tsx; libs/chess/tests/e2e/puzzle-solve-flow.test.tsx; libs/chess/tests/e2e/puzzle-solve-session.test.tsx |
| chess-puzzles:6 | libs/chess/src/shared/chess/chess-puzzle-play.test.ts |
| chess-puzzles:7 | libs/chess/src/shared/chess/chess-puzzle-play.test.ts; libs/chess/tests/e2e/puzzle-review.test.tsx |
| chess-puzzles:8 | libs/chess/tests/e2e/puzzle-rating.test.tsx; libs/chess/tests/puzzle-session/opponent-stager.test.ts |
| chess-puzzles:9 | libs/chess/tests/e2e/puzzle-controls.test.tsx; libs/chess/tests/e2e/puzzle-outcome-sync.test.tsx; libs/chess/tests/e2e/puzzle-selection.test.tsx |
| chess-puzzles:10 | pkgs/chess-board/tests/chess-board.test.tsx |
| chess-puzzles:11 | libs/chess/tests/e2e/puzzle-stats.test.tsx |
| chess-puzzles:12 | libs/chess/tests/e2e/puzzle-spectator.test.tsx |
| **chess-puzzles:15** | libs/chess/tests/e2e/puzzle-stats-p0.test.tsx — **out of range** (known max is chess-puzzles:12) |
| guest-free-and-paid:1 | libs/permissions/tests/policy.test.ts |
| guest-free-and-paid:2 | pkgs/permissions/tests/evaluate.test.ts |
| guest-free-and-paid:3 | pkgs/permissions/tests/evaluate.test.ts |
| guest-free-and-paid:4 | libs/permissions/tests/policy.test.ts |
| guest-free-and-paid:5 | pkgs/permissions/tests/evaluate-cost.property.test.ts |
| guest-free-and-paid:6 | libs/chess/tests/e2e/puzzle-limit-upgrade.test.tsx |
| guest-free-and-paid:7 | libs/billing/src/use-cases/create-checkout-session/server/billing-checkout-route.test.ts; libs/billing/tests/e2e/subscribe.test.tsx |
| guest-free-and-paid:8 | libs/billing/src/use-cases/open-portal-session/server/billing-portal-route.test.ts; libs/billing/tests/e2e/portal.test.tsx |
| guest-free-and-paid:9 | libs/billing/tests/e2e/lifecycle.test.tsx; pkgs/billing-stripe/src/stripe-membership.test.ts |
| guest-free-and-paid:10 | libs/permissions/tests/plan.test.ts |
| room-to-grow:1 | libs/games/tests/game-plugin-contract.test.ts |
| room-to-grow:2 | libs/games/tests/game-plugin-contract.test.ts |
| room-to-grow:3 | pkgs/permissions/tests/evaluate.test.ts |
| room-to-grow:4 | pkgs/billing/src/membership.contract.test.ts |
| room-to-grow:5 | libs/sim-harness/tests/hosts-compile.test.ts |
| social:1 | libs/chess/tests/e2e/puzzle-guest-play.test.tsx; libs/friends/tests/e2e/gates.test.tsx; libs/friends/tests/e2e/space-guest-link-join.test.tsx; libs/profile/tests/e2e/auth-login-logout.test.tsx |
| social:2 | libs/auth/src/root/server/anon-user-service.test.ts; libs/chess/tests/e2e/puzzle-guest-carryover.test.tsx; libs/profile/tests/e2e/account.test.tsx; libs/profile/tests/e2e/auth-guest-progress-carryover.test.tsx |
| social:3 | libs/friends/tests/e2e/profile-changes.test.tsx; libs/profile/tests/e2e/account.test.tsx; libs/profile/tests/e2e/defaults.test.tsx; libs/profile/tests/e2e/username-rules.test.tsx; libs/profile/tests/username-integrity.test.ts |
| social:4 | libs/profile/tests/e2e/username-rules.test.tsx; libs/profile/tests/username-integrity.test.ts |
| social:5 | libs/friends/tests/e2e/person-profile.test.tsx; libs/friends/tests/e2e/remove.test.tsx; libs/friends/tests/e2e/request-accept.test.tsx; libs/friends/tests/e2e/request-decline-cancel.test.tsx |
| social:6 | libs/friends/tests/e2e/friend-in-open-space.test.tsx; libs/spaces/src/root/client/my-live-space-seat-sql.test.ts |
| spaces:1 | libs/friends/tests/e2e/space-guest-host.test.tsx |
| spaces:2 | libs/friends/tests/e2e/space-guest-link-join.test.tsx; libs/spaces/tests/guest-space-join.test.ts |
| spaces:3 | libs/chess/tests/e2e/space-host-select-game.test.tsx |
| spaces:4 | libs/friends/tests/e2e/space-live-presence.test.tsx |
| spaces:5 | libs/friends/tests/e2e/space-disconnect-reconnect.test.tsx |
| spaces:6 | libs/friends/tests/e2e/space-lifecycle.test.tsx |
| spaces:7 | libs/friends/tests/e2e/friend-in-open-space.test.tsx; libs/friends/tests/e2e/space-friend-join.test.tsx |
| the-bar:1 | libs/tools/scripts/turbo-deploy-graph.test.ts |
| the-bar:2 | libs/tools/scripts/check-goals.test.ts |
| the-bar:3 | pkgs/sync-engine/tests/peer-visibility-latency-budget.test.ts |
| the-bar:5 | pkgs/db-indexes-postgres/tests/postgres.contract.test.ts; pkgs/db-schema-postgres/tests/postgres-reconcile.contract.test.ts; pkgs/object-store-s3/src/object-store.s3.contract.test.ts; pkgs/pubsub-emqx/src/emqx.contract.test.ts; pkgs/sql-client-postgres/src/postgres.contract.test.ts |
| works-offline:1 | apps/product/scripts/sw-policy.test.ts |
| works-offline:2 | libs/chess/tests/e2e/puzzle-offline.test.tsx |
| works-offline:3 | libs/chess/tests/puzzle-session/feed-sync-bands.test.ts |
| works-offline:4 | libs/chess/tests/e2e/puzzle-outcome-sync.test.tsx; pkgs/sync-engine/tests/upload-response-lost-retry-does-not-double-apply.test.ts |
| works-offline:5 | libs/chess/tests/e2e/puzzle-guest-carryover.test.tsx; pkgs/sync-engine/tests/same-actor-two-devices-converge.test.ts |
| works-offline:6 | pkgs/sync-engine/tests/requires-online-fails-offline-without-queue.test.ts |
| works-offline:7 | pkgs/sync-engine/tests/peer-visibility-latency-budget.test.ts |

**Only flagged tag:** `goal:chess-puzzles:15` (carried by `libs/chess/tests/e2e/puzzle-stats-p0.test.tsx`) is out of the known chess-puzzles:1-12 range — either the chess-puzzles spec needs a §13-15 addendum, or this tag is a typo for an existing number (likely meant to reference the stats/§15 P0 slice not yet in the documented statement list).
