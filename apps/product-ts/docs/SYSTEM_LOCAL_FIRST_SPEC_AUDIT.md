# Combined local-first specification audit

Verdict: INCOMPLETE. This corrects a registered composition of existing domain
rules, as permitted by [the campaign rules](../../../specs/README.md).
It does not replace any domain's specification or provide a launch verdict.

Context: Whole product. Aggregates: the Spaces and Friends composition in
`community.qnt`, domain choices in `product-state.qnt`, and combined actions.
Story: people keep their own choices while away, then share them when both
the applicable connection and account proof permit sharing.

| Rule source | Positive illustration | Refusal or boundary illustration |
| --- | --- | --- |
| [Offline hosting](../../../specs/spaces/space-needs-connection.feature) | `offlineHostCreatesAndSharesTheSameSpaceTest`: create, reopen and share the same space | Existing access, quota and ended-space checks are retained |
| [Offline username](../../../specs/profile/offline-username.feature) | `offlineUsernameIsKeptAndSharedLaterTest` | Existing duplicate-name and invalid-name checks are retained |
| [Offline request](../../../specs/friends/offline-friend-request.feature) | `offlineFriendRequestWaitsForSharingTest` | Existing block-before-delivery and removed-person checks are retained |
| [Adding a person](../../../specs/spaces/space-add-person.feature) | `addingAccessWaitsForExplicitJoinTest`: access is available before participation | The added person is absent until explicit Join |
| [Joining](../../../specs/spaces/space-guest-link-join.feature) | `joiningWaitsForTheHostToReturnTest`: host returns, then Join succeeds | Join while every host device is offline is refused |
| [Host leaving](../../../specs/spaces/space-host-leaves.feature) | `hostLeavesInsteadOfRemovingThemselvesTest`: offline Leave ends the space and is shared later | Removing the host is refused; the space stays open |

No new product term is introduced. Names use the source contexts' existing
vocabulary; the campaign's internal names remain interpretation helpers under
the registered campaign rule. Technical boundary checks stay model-only.
There is no new Gherkin phrasing or step-definition handoff.

The composition now distinguishes access from participation, preserves the
host among participants of an open space, and requires a connected host for
Join and live room use. Local table choices use the existing offline domain
rules; joining and finding an opponent retain their connection requirements.
Every existing action, invariant, search bound and adversarial check is retained.

Outstanding: executable simulation and fault sensitivity, current symbolic
proofs within their existing deadlines, the full domain policy and transition
audit, and production conformance. Sign-in lapse is not abstracted as paid
access ending; its downstream reactions require their own evidence.

The strict gate passes with 1,766 scenarios, 47 domain models, 2,253 step
definitions and no wording warnings. All four literal campaign groups pass,
including all retained adversarial checks and the six added local-first
sequences (17.00 seconds total). The aggregate domain maps and remaining
campaign obligations remain incomplete; these results do not supply the
missing symbolic or production verdicts.
