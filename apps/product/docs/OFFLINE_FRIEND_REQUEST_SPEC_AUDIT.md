# Offline friend request spec audit

Verdict: INCOMPLETE. The six corrected feature examples are implemented and
pass. Whole-context replay, policy reactions and the complete aggregate map
remain outstanding. This is not a passing launch verdict.

Scope: `specs/friends/offline-friend-request.feature`,
`offline-friend-requests.qnt`, the corrected connection feature, and the changed
Friends glossary and connected-relationships model.

The person confirmed local acceptance from a profile already on the device,
sharing later, and a clear refusal if the shared rules refuse the choice.
No new term is introduced. The block rule already prohibits revealing a block.

## Per feature

The new capability uses one job story and three rules. Local acceptance is paired
with the known-decline refusal. Persistence and sharing have no counter-example:
unanswered choices are preserved; shared refusal is illustrated separately.
The block rule pairs refusal with a block undone before sharing. Each scenario
has one command or return event, factual setup, visible outcomes and a reason
for refusal. There is no quoted copy, technical state or formula. Cast names,
profile, friend request, inbox, decline, block, refused, device and connection
resolve in the Friends language and its published Profile and shared-kernel
borrowings. Seven- and eight-step examples retain the offline choice and the
intervening relationship change because those facts distinguish the rule.

The connection feature now describes remote people search, with a connected
example and the existing offline refusal. A request from an already-known
profile is no longer described as connection-required. The connected friendship
model's scheduling assumption is private bookkeeping; it no longer publishes
an invariant saying that people cannot make choices offline. The new account
covers offline asking and its sharing outcomes.

A0–A6, B1–B13, B15–B17 and D1 are checked for this draft. B14 needs the strict
catalog check after implementation. D2–D6, P3 and executable product evidence
are the implementation handoff. A3: no added vocabulary.

## Coverage

| Kind | Model name | Term | Illustration | Status |
| --- | --- | --- | --- | --- |
| command | ask | friend request | offline-friend-request.feature, offline acceptance and known decline | covered |
| command | decline | decline a friend request | friend-request-decline-cancel.feature, Bob declines | covered |
| command | blockPerson | block someone | offline-friend-request.feature, blocked while away | covered |
| command | unblockPerson | unblock | offline-friend-request.feature, block undone before sharing | covered |
| world | loseConnection | connection | offline setup; direct loss causes no distinct request outcome | model-only |
| world | connectionReturns | connection | offline-friend-request.feature, accepted and refused return | covered |
| command | reopen | app | offline-friend-request.feature, reopen preserves request | covered |
| invariant | invPendingRequestIsPrivate | friend request | offline acceptance; Bob's inbox stays empty | covered |
| invariant | invSharedRequestAgrees | friend request | accepted return; pending notice ends and Bob receives request | covered |
| invariant | invBlockEndsSharedRequest | block someone | blocked return; Bob's inbox stays empty | covered |
| invariant | invRefusalEndsPendingChoice | refused | known decline and unavailable-person refusal | covered |
| invariant | invOwnChoiceIsKept | friend request | reopen preserves local request and pending notice | covered |
| transition | no request → local request | friend request | offline acceptance | covered |
| transition | no request → refused | refused | known recent decline | covered |
| transition | local request → shared request | friend request | accepted return | covered |
| transition | local request → refused | refused | unavailable-person return | covered |
| illegal | another request while one waits | friend request | reopen offers cancel and hides a second request | covered |
| illegal | request after a known block | hidden by a block | friend-block.feature, blocked person cannot find blocker | covered |
| event | BecameFriends, FriendshipEnded | friendship | existing acceptance and removal features | covered |
| policy | SignedIn and AccountDeletionConfirmed | sign in, account deletion | existing friends-gates and deleted-account-friendships features | covered |
| policy | SignedOut reaction | sign out | whole-context reaction remains unaudited | MISSING |

C4: the new request states are covered; a complete transition map for the existing
three-person friendship aggregate remains outstanding. C5: username and space
changes retain their existing downstream features; the whole policy audit is
outstanding. C6: requesting, declining, blocking and unblocking name existing
commands; reopening belongs to the shared app vocabulary. Other offline friend
choices need their own full coverage review. No unsupported launch claim is made.

## Implementation handoff

Reuse the existing profile-request command and recent-decline refusal. Bind the
pending notice, pending-notice dismissal, duplicate request absence and durable
unavailable-person refusal as actual observations. Add a fact for an accepted
request chosen from the already-open profile while offline. Do not infer outcomes
from the model or from shared storage. Run the new scenarios red before changing
product code, then run the complete Friends and Spaces contexts.

## Current executable evidence

All six new examples failed at their Then outcomes before implementation
(`offline-friend-request-bound-red.log`, 16.13 seconds). All six passed after
implementation with nine assertions in 25.96 seconds. The request is locally
accepted, kept through app reopening, shared on return, or visibly refused
without revealing a block. Scoped durable-feedback contracts passed with
17 assertions. Current Friends client/harness, Spaces harness and sync client
type checks and lint pass. The strict gate passes for 1,766 scenarios, 47
models and 2,253 definitions. These results do not prove the still-running
32 request traces or the complete Friends/Spaces contexts.

The private proof premises now enumerate both boolean values and every
connection subset; the hosting count remains any natural number. Adding
people also records that participation follows a known open space and access.
These premises do not remove actions, observations or public invariants.
The hosting-limit induction passed in 8.60 seconds and addition induction in
103.40 seconds as focused proof runs, with the original four-step bound and
120-second deadline. The request induction first found an unreachable premise
(shared request despite no local request). The complete candidate now proves
that relationship and all five public invariants in 17.20 seconds. No failed obligation is marked as passing.
