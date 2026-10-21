# Offline username spec audit

Verdict: INCOMPLETE. This authoring handoff corrects the connection restriction;
current focused product verification passes, but the full aggregate audit and
launch verification remain incomplete. It is not launch proof.

Scope: `specs/profile/offline-username.feature`, the changed username glossary,
`username-rules.feature`, and `username-changes.qnt`.

The person confirmed that a username choice is accepted locally and shared later,
with a clear refusal if the shared rules refuse it. No new domain term is added.

## Examples and checks

The new feature uses existing profile and connection language. A0–A6 and D1:
the examples describe what a person chooses, sees, keeps and is told. B1–B3:
one capability, one job story, two rules. B4: local acceptance has a known-rule
refusal; sharing has taken-name and no-longer-allowed refusals. B5–B10: each
example has one command or return event, factual setup, observable outcomes,
data only in quotes, and an outcome title. B11–B13: no background or outline;
all people and names are plausible. B14: existing rename, refusal, profile,
reopen and connection phrases are reused; the new notice describes sharing
on return. The bounded other-device observation adds the existing 30-second
observation promise. B15: only the profile domain tag. B16: five to seven steps;
the longer return examples need both the offline choice and the intervening
shared fact. B17: no formula, storage or transport assertion.

The existing username-rules feature still has a composite draft-and-leave
command. Its whole aggregate coverage and the existing bindings require review;
this handoff does not call that finding passed.

## Coverage

| Kind | Model name | Example | Status |
| --- | --- | --- | --- |
| command | rename | offline-username.feature:9 and profile-edit.feature:9 | covered |
| command | renameTwice | username-rules.feature:36 illustrates immediate refusal, but not the whole two-choice command | MISSING |
| world | stopAllowing | username-rules.feature:62 and offline-username.feature:57 | covered |
| world | startAllowing | username-rules.feature:67 | covered |
| world | loseConnection | offline-username.feature:9 uses an offline fact; a When explicitly losing connection remains to be mapped | MISSING |
| world | connectionReturns | offline-username.feature:40,48,57 | covered |
| invariant | invNamesAreUnique | offline-username.feature:48 and username-rules.feature:52 | covered |
| invariant | invDeviceShowsUsername | offline-username.feature:40 | covered |
| invariant | invShownNameIsUsernameOrStandIn | username-rules.feature:62 | covered |
| invariant | invNotAllowedNeverShown | username-rules.feature:62 | covered |
| invariant | invOwnDeviceUsesKnownRules | offline-username.feature:16; username-rules.feature offline naming-rules example | covered |
| invariant | invConnectedKnowsRules | username-rules.feature returning-device example; offline-username.feature:57 | covered |
| invariant | invAlwaysRefusedNeverSaved | offline-username.feature:16 | covered |
| invariant | invSavedChoiceUsesKnownNames | username-rules.feature:52 | covered |
| invariant | invStoredLowercase | username-rules.feature lowercase example | covered |
| invariant | invOfflineKeepsSharedUsername | offline-username.feature:23 | covered |
| invariant | invConnectedChoiceIsShared | offline-username.feature:40 | covered |
| transition | local acceptance → shared acceptance | offline-username.feature:40 | covered |
| transition | local acceptance → taken refusal | offline-username.feature:48 | covered |
| transition | local acceptance → no-longer-allowed refusal | offline-username.feature:57 | covered |
| illegal | choose a known disallowed name offline | offline-username.feature:16 | covered |
| event | UsernameChanged | shared other-device observation, offline-username.feature:40 | covered |
| policy | App investigation trail → Identity | unrelated standing synthetic feature; whole Identity policy map not completed | MISSING |

C4: the full existing result-state transition matrix remains outstanding;
this table records the changed offline transitions, not every result state.
C5: remaining published Identity events belong to other Identity aggregates;
the whole context map still requires its own audit. C6: reopen is an App command;
rename and connection changes belong to the model. D2–D6 and P3: new bindings,
red evidence, observable reads and model replay are the implementation handoff.
P1: commit this authoring change only with spec text and this report.

Author validation: Quint type checking passed; 32 drawn 24-step traces satisfied
all eleven invariants. The strict spec check reports only the two new undefined
observations, handed to implementation. These results check the authored model
and wording; they do not prove the product follows them.

## Focused implementation evidence

The local username choice is durable and private until shared. Pending and
refused outcomes are observed through framework feedback and shown on the
Profile tab as well as the editor. Current naming rules are judged when this
choice is shared; existing mutations that use their original rule time retain
that policy. The taken-name and newly-disallowed examples restore the last
shared username after refusal and show its reason.

All 35 selected checks pass: seven offline examples, sixteen standing naming
examples, and eight product traces plus the model's shape, type, invariant and
reached-action checks. The profile package's eight property and contract tests
pass with 587 assertions. Type checks and feedback lint pass. Earlier failing
inputs and their fixes remain pinned in individual known-bug records.

The framework's two local-choice feedback contracts pass with thirteen
assertions, including held upload without peer publication, refusal, restart,
later acceptance, device scoping and dismissal. A mounted watcher found a
harness write-notification gap, now fixed and pinned separately. Full Identity
context, model induction, policy coverage and final local verification remain
outstanding; focused results do not resolve the MISSING rows above.
