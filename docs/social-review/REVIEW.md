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
