# Shared product facts

The root keeps identity and access active while one device navigates. A shared event is delivered to every active region that handles it; each region uses its most specific applicable handler. These facts have the meanings declared by the contexts’ `events.qnt` files. The names refer to the current person, viewed space or selected relationship, as described in the [projection scope](README.md).

| Fact | Active reactions | Contract |
| --- | --- | --- |
| `SignedIn` | Identity becomes the proven account; its access is confirmed independently; an active account invitation can resume its capability | [Identity events](../../specs/profile/events.qnt) |
| `SignedOut` | This device becomes a guest and loses this account’s paid access; an accepted multiplayer game or wait is not cancelled | [Sign-in](../../specs/profile/sign-in.feature), [a matched game follows the account](../../specs/games/matched-game-ownership.feature) |
| `AccountDeletionConfirmed` | Identity becomes deleted; current access becomes free; active privacy shows confirmation, while affected spaces and progress respect erasure | [Deletion](../../specs/profile/account-deletion.feature), [privacy lifecycle](../../specs/system/privacy-lifecycle.qnt) |
| `UsernameChanged` | Viewed profiles, people and space presence use the current name; a Custom Game keeps the same side | [Identity events](../../specs/profile/events.qnt), [custom game identity](../../specs/games/custom-game-identity.feature) |
| `PaidAccessStarted` | Current paid access remains explicit across navigation; an active hosting-limit invitation can resume | [Billing events](../../specs/billing/events.qnt), [hosting limit](../../specs/spaces/space-host-limit.feature) |
| `PaidAccessEnded` | Current access becomes free; ordinary multiplayer and Custom Games remain available, and an already started puzzle may finish | [Billing access](../../specs/billing/access.dmn), [puzzle quota](../../specs/games/puzzle-quota.feature), [finding an opponent](../../specs/games/finding-an-opponent.feature) |
| `SpaceOpened` | A pending creation becomes the hosted space; other relevant views refresh their discoverable choices | [Spaces events](../../specs/spaces/events.qnt) |
| `PersonJoined` / `PersonLeft` | A pending join or leave reaches its outcome; an open space’s people change | [Presence](../../specs/spaces/space-live-presence.feature) |
| `SpaceEnded` | A current puzzle or Custom Game view reaches the ended-space view; ordinary private multiplayer keeps its separate lifecycle | [Space ending](../../specs/spaces/space-end.feature), [custom game completion](../../specs/games/custom-game-completion.feature), [a matched game follows the account](../../specs/games/matched-game-ownership.feature) |
| `BecameFriends` / `FriendshipEnded` | The current request or relationship reaches its outcome; discoverability is recomputed where relevant | [Friends events](../../specs/friends/events.qnt) |
| `MatchFormed` | A waiting matchmaking flow reaches a complete match; opponent search reaches multiplayer play | [Matchmaking events](../../specs/matchmaking/events.qnt), [finding an opponent](../../specs/games/finding-an-opponent.feature) |

Cross-region targets enter the owning branch directly. A completed opponent
search opens its multiplayer board, and a puzzle link opens that exact
puzzle’s board. Each guided journey therefore replays from the one product
root.

Provider outcomes and published facts are explicit steps in a journey. The pure chart does not execute an action to publish another event. Runtime delivery, actor selection and duplicate handling belong to the referenced specifications and application adapters.
