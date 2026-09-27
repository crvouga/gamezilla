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
Identity ──► Billing, Spaces, Friends, Chess, App, Notes, Operations, Journeys
Billing  ──► Spaces (the hosting limit), Chess (the daily puzzle limit), Operations, Journeys
Spaces   ──► Friends (a friend is live), Chess (a space plays a puzzle), App, Operations, Journeys
Friends  ──► Spaces (a friend's open space in the lobby), Journeys
App      ──► Identity (Settings, where devices are), every context's "the app"
Rooms, Notes: stand alone (Notes' "shared space" is not a Spaces space)
```

## Published language

The terms and events each upstream context offers. A downstream glossary
borrows exactly these spellings.

### Identity (`profile`)

- Terms: **guest**, **account**, **sign in** (forms: signs in, signed in,
  signing in), **sign out** (forms: signs out, signed out), **sign-in
  method**, **username**, **avatar**, **profile**.
- `specs/profile/events.qnt` — `type IdentityEvent`: `SignedIn`,
  `SignedOut`, `UsernameChanged`.

### Billing (`billing`)

- Terms: **Plus**, **Plus member** (forms: Plus members), **free account**
  (a signed-in person without Plus), **paid access**.
- `specs/billing/events.qnt` — `type BillingEvent`: `PaidAccessStarted`,
  `PaidAccessEnded`.

### Spaces (`spaces`)

- Terms: **space**, **host** (forms: hosts, hosting, hosted), **join**
  (forms: joins, joined), **leave** (forms: leaves, left), **end a space**
  (forms: ends the space, ended), **open space**, **lobby**, **space link**,
  **hosting limit**.
- `specs/spaces/events.qnt` — `type SpaceEvent`: `SpaceOpened`,
  `PersonJoined`, `PersonLeft`, `SpaceEnded`.

### Friends (`friends`)

- Terms: **friend** (forms: friends), **friends list**.
- `specs/friends/events.qnt` — `type FriendshipEvent`: `BecameFriends`,
  `FriendshipEnded`.

### App (`runtime`)

- Terms: **Settings**, **tabs**.

## Rules of thumb

- A term is a product concept, not a common English word: define "open
  space", never "open"; "puzzle feed", never "feed" alone unless the
  context means only that.
- The same word may mean different things in different contexts ("notice",
  "member", "move"): each defines its own, and neither borrows the other's.
- Events are past-tense facts the upstream context already decided
  (`PaidAccessEnded`), never requests (`EndPaidAccess`).
