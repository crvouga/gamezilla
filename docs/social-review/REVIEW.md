# Social feature review

Target: 10/10 for polish, correctness, completeness and user expectations,
independently rated by the social critic. Each scored round is recorded in
pull-request comments with revision-specific automated evidence.

## Baseline

Revision: 27bc00adc604a4323ae139076e418e77eacf07f3.

| Dimension | Source-audit score |
| --- | --- |
| Polish | 7/10 |
| Correctness | 6/10 |
| Completeness | 7/10 |
| User expectations | 6/10 |

Reviewed scope: people search, friend lists and live-space entry, other-person
profiles, friend requests (send, accept, decline, cancel), blocking/unblocking,
removal and friend-request inbox decisions.

Findings: uncached profiles can be labeled deleted before remote hydration;
remove/block navigate away without success feedback; opposite request decisions
can run concurrently; underscores are SQL search wildcards; rate-limited searches
return false empty results. Current automated screenshots and full verification
are required before any final score. Profile editing and broader space management
are not comprehensively reviewed by this baseline.

## Evidence policy

Use the [Storybook workflow](../../pkgs/ui-root-harness-ts/README.md#agent-workflow)
and [CI stage policy](../CI_STAGE_POLICY.md). Checked-in baseline screenshots
illustrate the starting UI but do not prove current behavior. No manual testing
is release evidence. No round passes with missing checks or a score below 10.

## Existing screenshot reconciliation

The independent critic inspected all 160 differing captures from the automated
83d751c run, across phone/desktop and light/dark. It approved 152 for deliberate
reconciliation: 32 friends-list, 8 notification, 72 friend-profile and 40 search
captures. The starting checked-in images predate the current source compositions:
for example, the friends-list populated baseline has five plain rows, while the
unchanged starting source groups live players and provides request access.
Changes in this PR additionally replace remove/block confirmation lifecycles.
This is a reviewed baseline update, not a claim that prior comparisons passed.

Eight captures are excluded: four profile long-name fixtures were unrealistic
(46 characters against a 32-character limit), and four long-query search captures
include a real mobile overflow. Those require fresh evidence after correction.
The 24 new success/recovery captures passed a separate no-update comparison.

## Round three corrections

Success fixtures now adopt the resulting relationship and separately exercise
Done dismissal. A valid 32-character wide username reproduced primary-heading
clipping in all four browser variants (479px content in a 358px phone region).
The primary identity now wraps through existing typography components; the compact
navigation header retains truncation. The literal long search query is preserved
in its input while the empty heading reads "No people found".

Full verification of round two failed cache hygiene: adding a source file made the
shared sync hub exceed its 45-file cap. Retryable query definitions now live in the
existing query-definition module; the separate file and all old imports are gone.
Cache hygiene and affected checks pass after the correction. Final full verification
and final screenshot comparison remain required.

## Inherited gate repairs

The next full gate stopped at three bot-start journeys without statechart owners.
The product map now links those existing contracts and the existing Troubleshooting
route; its gate and pinned regression pass. Product scenarios are unchanged.

Missing visual coverage was inherited too. The independent critic reviewed 265
newly captured images: 259 were approved initially or after full-resolution
reconsideration; two breadcrumb captures required a real shrinking fix; four phone
captures of the documented desktop-only header were removed by correcting story
viewport metadata. The corrected breadcrumb captures are approved, making 261
accepted additions. StepTrack needed no product change: rendered glyph-range and
box containment assertions proved its labels fit the phone viewport.

Existing Word Tiles screenshot differences observed during broad authoring were
not accepted or overwritten. The combined no-update comparison passed all 447
cases. Full verification remains the completion criterion. Coverage also identified
obsolete phone header goldens and desktop captures required by explicit tests but absent from the
canonical matrix; these are reconciled through supported viewport metadata, not
by disabling assertions or deleting valid desktop evidence.

The existing blank-assignment context now has a production-component story with
visible-content assertions. Its four phone/desktop, light/dark captures were
independently approved; the focused responsive comparison passed all 28 cases.
The product preview annotation uses the established `.example.tsx` convention
so preview infrastructure is classified correctly without weakening the boundary.
The rebuilt coverage gate reports 990 UI exports, 262 story files and zero
violations; owning artifact tests and all 28 responsive comparisons pass.
The critic retains 10/9/9/10 until full verification completes successfully.

## Round five regression proof

Full verification next stopped at five inherited regression registrations that
only supplied loop-generated tests. Each now has a marked module-scope literal
reproduction, sharing unchanged assertions with the retained viewport/theme
matrices. Running those matrices also exposed the old 46-character friend-name
expectation; it now matches the valid 32-character wide-name fixture, with heading
containment and header non-overlap assertions preserved.

All 71 affected browser cases pass, along with goals, lint and typecheck. The
independent critic found no weakened assertions or new product blockers; scores
remain 10/9/9/10 pending the complete gate.

## Round six coordinate clearance

Hosted verification is green. The next full local run completed 596 tasks before
an inherited native-browser contract found nine overlapping ink pixels between
file b and the b1 white knight at 358px. Boards with internal coordinates now
use an 80% piece footprint; other boards retain 84%, including frames that move
coordinates outside the squares. Labels, hitboxes and game rules are unchanged.
The existing zero-overlap matrix and all 31 native browser contracts pass. The
critic found no assertion weakening; full verification remains required.

The critic approved all ten compact-board captures. Their previous goldens date
from a 100% piece footprint and older coordinate styling; accepting these images
also reconciles that inherited drift. The production change in this round is
84% to 80% only where coordinates remain inside squares. Promotion captures show
the pre-choice board, not an open chooser; native contracts cover that behavior.

## Round seven publication readiness

The full gate next found a publication timeout. A pinned cold-screen River
regression reproduced it: the harness waited for Publish to exist, then clicked
while the saved-copy read still disabled it. The harness now waits for an enabled
control before its single click, retaining the bounded result wait. Product and
sync code are unchanged. All 13 package tests and 170 tests across the four
puzzle spec shards pass, including "A valid draft becomes discoverable". The
critic approved the correction without weakened assertions and retains
10/9/9/10 pending full verification.

## Round eight deletion receipt readiness

The next full run stopped while reopening Privacy after account deletion. The
harness incorrectly waited for the permission-gated Delete account action after
the person had been signed out. A paid-account regression reproduced the timeout.
Opening Privacy now waits for the privacy section; reviewing deletion still taps
the actual gated control. Product code is unchanged. The regression and all six
deleted-account payment scenarios pass, including the pending cancellation case;
lint, typechecks and goals pass. The critic found no weakened assertion and
retains 10/9/9/10 until full verification succeeds.

## Round nine overdue export proof

The overdue-export scenario expected an immediate request button after 24 hours,
contradicting the existing ten-minute proof requirement. Its assertion now checks
the overdue explanation and concrete Sign in action. A registered regression
also proves that renewing account proof permits a new export and clears the late
status; it asserts that the direct request is absent before proof is renewed.
Product and permission policy are unchanged. The regression, all six cases in
the affected profile shard, lint, typechecks and goals pass. The independent
critic approved the correction; scores remain 10/9/9/10 pending the full gate.

## Round ten current permission denials

Old-proof deletion exposed the same hidden-control assumption in action helpers.
Privacy actions now wait for either their actual visible control or their specific
visible policy refusal, and only click an available control. Refusal observations
accept the current-access or post-submit surface while retaining required copy
and rejecting notices obscured by a modal. A registered old-proof regression
requires unchanged identity, an Active server account and no erasure deadline.
All 121 tests across 22 profile spec shards, all 14 package tests and the six
owning checks pass. No product or policy change was needed. The critic found
no weakened assertion; scores remain 10/9/9/10 pending full verification.

## Round eleven deleted profiles and recovery

Full verification found a regression introduced here: generic unavailability
removed the deleted-account explanation. The profile read now distinguishes a
synced tombstone from an absent row. Only a tombstone after the profile's first
answer yields the deletion message; old identity fields are suppressed.

The critic first held an inaccurate fixture, then identified a raw-ID heading
and missing Friends action in the corrected captures, lowering scores to 9/9/9/9.
Deleted and unavailable profiles now have readable headings and a direct Friends
link. Browser assertions pin the heading, destination, identity redaction and
absence of an Add friend action. The critic approved all eight final captures
and returned to 10/9/9/10 pending full verification. The initial held captures
were not accepted as baselines.

Final round-eleven checks: 36 friends-client tests, 14 affected spec cases,
17 browser comparisons and owning lint/typechecks/goals pass. Coverage reports
zero violations. Full verification is still required.

## Round twelve catalog synchronization

The full gate caught missing committed catalog entries for round eleven's
profile headings, explanation and Friends link. Canonical extraction now
matches the reviewed source, including its source references and removal of
the obsolete combined explanation. The catalog freshness gate and strict
compilation pass. The independent critic approved the correction with no new
findings; scores remain 10/9/9/10 pending full verification. Round eleven's
approved automated captures still show the current interface.

## Round thirteen visible Light Cycles results

The next full gate reached a Light Cycles scenario whose recorded screen
already showed Nova winning round three. Its harness read only the empty
arena overlay; result text now lives in the status line. The read follows the
visible result when present and otherwise retains the countdown overlay.
Product rules, scenario wording and winner assertions are unchanged.

A registered seed-one reproduction failed on the original empty read, then
passed with the correction. It uses the package's integration-test outer
budget while keeping the two-second virtual result deadline. All 15 package
tests, 115 scenarios, lint, typechecks and the regression registry gate pass.
The critic approved the guarded read after rejecting an initial unguarded
lookup of a conditionally rendered element. Full verification remains pending.

Eight result-screen comparisons exposed older goldens. The critic inspected
each current capture against its golden and approved both result states in
both themes at phone and desktop widths. Only those eight were replaced;
all eight then passed without snapshot updates. Ratings remain 10/9/9/10.

## Round fourteen spectator move refusals

Full verification next found a Quoridor harness action clicking a player-only
tool on a spectator's read-only board. Pawn and wall actions now check whether
their mode selector is visible before using it. Missing tools reach the
existing acknowledged product-command path, so the product still decides and
reports the refusal. No game rule or scenario assertion changes.

The seed-one reproduction pins Eve's e2 pawn attempt and d2 horizontal wall
attempt, requiring the non-player denial and unchanged game state after each.
The package test command now loads the shared product-harness preload needed
by this integration test. With that setup in place, the new test reproduced
the missing-selector failure before the action correction.

The broader suite then exposed a visible-but-disabled wall tool at zero
inventory. A second seed-one regression reproduced the missing explanation
(only generic move guidance was shown). The board now uses its existing
no-walls explanation with a next action, preserving finished, spectator and
mandatory-pass messages. Disabled wall attempts follow the acknowledged
refusal path. The new NoWallsLeft story asserts disabled wall selectors,
an enabled pawn selector and the recovery text.

All 58 Quoridor scenarios and 20 package tests, both packages' lint and
typechecks, goals and localization pass. Coverage reports zero violations.
The critic approved all eight new/existing spectator and no-walls captures
across themes and widths; eight comparisons then passed without snapshot
updates. Scores remain 10/9/9/10 pending the full gate.

## Round fifteen named Hearts winners

The full gate found a Hearts assertion expecting the accessibility seat label
North inside a result correctly naming Carol. The observation now resolves
the visible participant, checks the played winning card and requires the
winner's announcement prefix. The critic caught the viewer's own perspective:
the product correctly says You. The exact seeded diamond trick now covers
both perspectives, their live announcements and rejection of a wrong winner.

Two accessibility assertions had the same seat-label assumption. They now
require the validated result in the live region while retaining winning-card,
rank/suit, next-leader and score checks. Both the original label mismatch and
the own-winner mismatch were reproduced before their corrections. Product
copy, rules and specification text are unchanged.

All 58 Hearts scenarios, nine package tests, lint, typechecks and goals pass.
Cache synchronization required no derived changes. The critic approved eight
current result captures against older goldens; all eight then passed without
snapshot updates. Ratings remain 10/9/9/10 pending full verification.
