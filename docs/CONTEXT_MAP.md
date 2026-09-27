# Context map

Every `specs/<domain>/` is a bounded context with its own ubiquitous
language (`specs/<domain>/glossary.yaml`); the few terms every context
shares are the kernel, `specs/glossary.yaml`. This map says which context
owns which concept, which way the contexts depend on each other, and what
crosses each boundary. Policy:
[`SPEC_DRIVEN_DEVELOPMENT.md`](SPEC_DRIVEN_DEVELOPMENT.md#bounded-contexts-and-ubiquitous-language).

## Contexts

| Context | `specs/` | Owns | Kind |
| --- | --- | --- | --- |
| Identity | `profile` | who a person is to the product: guests, accounts, signing in and out, sign-in methods, usernames, avatars, profiles, the devices on an account | supporting |
| Billing | `billing` | Plus: memberships, trials, renewals, paid access, grace, refunds, the billing portal | generic (the provider does the paying) |
| Spaces | `spaces` | live spaces: hosting, joining, leaving, ending, links, the lobby, presence, the hosting limit | core |
| Friends | `friends` | friendships: friend requests, the inbox, blocking, people search, the friends list | supporting |
| Chess | `chess` | chess puzzles played in a space: the puzzle feed, attempts, the puzzle rating, the game log, review, watching | core |
| Rooms | `rooms` | rooms: one authority keeping live shared state (the shared counter, the match clock), refused changes | supporting |
| Matchmaking | `matchmaking` | matchmaking: waiting for a match, reach, matching rounds, being matched, stopping a wait, the same answer at every entrance | supporting |
| Notes | `sync` | notes people write and share across devices and shared spaces, even offline | supporting |
| App | `runtime` | the app itself: opening it, tabs, Settings, addresses, updates, reconnecting | generic |
| Operations | `health` | the promises a live environment keeps, seen by the team | generic |
| Journeys | `journeys` | the critical journeys across every context | — |

## Relationships

Upstream contexts publish; downstream contexts conform to the upstream
language by borrowing its terms (`from: <domain>` in their glossary). A
downstream context never redefines an upstream term and never imports an
upstream model — only its `events.qnt`.

```text
Identity ──► Billing, Spaces, Friends, Chess, App, Operations, Journeys
Billing  ──► Spaces (the hosting limit), Chess (the daily puzzle limit), Operations, Journeys
Spaces   ──► Friends (a friend's open space), Chess (a space plays a puzzle), App, Operations, Journeys
Friends  ──► Spaces (a friend's space in the lobby), Chess (friends watch), App (people search), Journeys
App      ──► Operations (addresses, versions), Journeys
Chess    ──► Journeys (a game of chess, a puzzle)
Rooms, Notes, Matchmaking: stand alone (Notes' "shared space" is not a Spaces space)
```

## Published language

A context's published language is the terms its glossary marks
`published: true`, plus its `events.qnt`. Only those cross a boundary: a
downstream glossary borrows them with exactly these spellings, and a
context's other terms bind nobody else.

| Context | Published terms | `events.qnt` |
| --- | --- | --- |
| Identity (`profile`) | guest, account, sign in, sign out, sign-in method, username, avatar, profile, rename themselves, Google, Apple | `IdentityEvent`: `SignedIn`, `SignedOut`, `UsernameChanged` |
| Billing (`billing`) | Plus, Plus member, free account, paid access, billing plans | `BillingEvent`: `PaidAccessStarted`, `PaidAccessEnded` |
| Spaces (`spaces`) | space, host, join, leave, create a space, end a space, open space, return to a space, lobby, space link, hosting limit | `SpaceEvent`: `SpaceOpened`, `PersonJoined`, `PersonLeft`, `SpaceEnded` |
| Friends (`friends`) | friend, friends list, people search | `FriendshipEvent`: `BecameFriends`, `FriendshipEnded` |
| Chess (`chess`) | game, chess, board, puzzle, solve | — |
| App (`runtime`) | Settings, tabs, address, version of the app | — |
| Rooms, Matchmaking, Notes, Operations, Journeys | — | — |

## Rules of thumb

- A published term is a product concept, not a common English word: publish
  "open space", never "open". An internal term may be a plain word ("move"
  in Chess): it constrains only its own context.
- The same word may mean different things in different contexts ("notice",
  "member", "move"): each defines its own, and neither borrows the other's.
- Events are past-tense facts the upstream context already decided
  (`PaidAccessEnded`), never requests (`EndPaidAccess`).
