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
