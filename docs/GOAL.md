GOAL: Ship v1

> This file is the definition of done for our current goal. It says **what must be true**, never how to build it. Any agent unsure whether work matters should check it against this file. The file changes as the goal changes.

## The goal

Get the product to a v1 that real people can use. Anyone with a link can open it on their phone, play, bring friends, and pay if they want more.

Everything in v1 must stand on its own. The base must be solid, not a demo.

**Ship when the bar is met.** There is no deadline. Quality is never traded for speed.

## What v1 is

A realtime multiplayer gaming app built around **spaces**. People create, host, and join spaces. The host picks a game. Friends join. The product is meant to grow to any kind of game, from single player puzzles to party games.

v1 ships one game: **single player chess puzzles**, which friends can watch live in a space.

---

# Definition of done

<!-- goal-statement-ids are derived from section + ordinal; do not reorder bullets. -->

v1 is done when every statement below is true. Not before.

## 1. The bar

- [x] **If `bun check` passes, the app is ready to release.** Nothing else is required.
- [x] **Nothing is ever verified by hand.** Every statement in this file is proven by an automated check that runs as part of `bun check`. A statement without a check is not done.
- [x] **Checks are fast.** Fast enough to run constantly without thinking about it, and they stay that fast as the product grows. A slow check is a defect. Warm `bun check` finishes in under 10 minutes.
- [x] **Checks are trustworthy.** None are skipped, none are flaky, and a pass means the same thing every time.
- [x] **Checks are realistic.** They exercise the whole product the way real users and the real world would, including the outside services it depends on, and including things going wrong.
- [x] **Zero known bugs.** Every bug ever found is permanently guarded by a check.

## 2. Spaces

- [x] Anyone, including a guest, can create a space and host it.
- [x] Anyone with a space's link can join it, including a guest with no account.
- [x] The host can choose what the space is playing.
- [x] Everyone in a space sees who else is there, live.
- [x] Leaving, losing connection, closing the app, and coming back all leave the space in a correct state. Nobody appears twice. Nobody lingers after they have gone.
- [x] A person can find and return to their spaces.
- [x] A person can join a friend's open space without needing the link.

## 3. Works offline

- [x] Once the app has been opened once, it opens and works with no connection.
- [x] A person can play for days with no connection. No errors, no blocked screens, no waiting on a network that is not there.
- [x] There is always enough to play offline for days.
- [x] When the connection returns, everything done offline is kept. Nothing is lost, nothing is duplicated, and the person does not have to do anything.
- [x] Someone using more than one device ends up with the same state on all of them.
- [x] Anything that truly cannot work offline says so clearly. Nothing fails silently.
- [x] Keeping devices in step is fast enough that people never notice it. Peer-visible sync p95 under 200 ms.

## 4. Social

- [x] People can play without an account.
- [x] A guest can sign in with Google and keep everything they did as a guest.
- [x] Every account has a username that belongs to them alone.
- [x] Usernames containing slurs or profanity are refused, including obvious attempts to disguise them.
- [x] People can send, accept, decline, and cancel friend requests, and remove friends.
- [x] People can see their friends and which of them are in an open space right now.

## 5. Chess puzzles

The bar: everything a person would expect from a dedicated chess puzzle app. It stands on its own as a product even for someone who never opens a space.

- [x] Play is a **feed**. Finish one puzzle and the next is ready at once.
- [x] Each player has a **running puzzle rating** that moves after every puzzle, online or offline.
- [x] The feed serves puzzles suited to the player's rating.
- [x] The player can **customize the feed**, at least by theme and by difficulty, and their choices stick.
- [x] A player is not shown the same puzzle again while fresh ones remain.
- [x] Every rule of chess is honored. No illegal move is ever allowed. No legal move is ever blocked.
- [x] Every correct solution is accepted. No incorrect one is.
- [x] The opponent's replies play themselves at a natural pace.
- [x] A wrong move gets clear feedback. The player can retry, take a hint, or see the solution, and the rating responds the way a player would expect.
- [x] The board feels right on a phone: moving pieces by tap or by drag, seeing where a piece can go, seeing the last move, seeing check, choosing a promotion piece, and always knowing whose move it is and whether the puzzle is solved or failed.
- [x] A player can see their history and how they are doing over time.
- [x] **Friends can watch.** People in a space see the player's board and moves live. Someone who arrives mid-puzzle sees the correct position.

## 6. Guest, free, and paid

- [x] There are three kinds of user, **guest**, **free**, and **paid**, and each can have different limits and different features.
- [x] Guests get the least. Free accounts get more. Paid users never hit a usage limit.
- [x] **Limits hold offline exactly as they do online.** The answer to "is this person allowed to do this" is always the same, wherever it is asked.
- [x] Every limit, every gated feature, and every grace period can be changed without changing the product itself.
- [x] Checking whether something is allowed costs effectively nothing. It never slows the app and never makes the player wait.
- [x] Hitting a limit is a clear invitation to upgrade, never an error.
- [x] A signed in person can subscribe and has paid access as soon as their payment succeeds.
- [x] A paid person can manage and cancel their subscription themselves, and access ends when it should.
- [x] Failed payments, expired cards, cancellations, and refunds each leave the person with the correct access.
- [x] A paid person who goes offline keeps paid access for a set grace period.

## 7. Always true

These hold at all times, including when connections drop, messages arrive late or twice or out of order, the app or a server crashes and restarts, clocks disagree, and people stay offline for days.

- [x] **Nothing is lost.** Anything a person did is still there afterward.
- [x] **Everyone agrees.** Every device and every person looking at the same thing ends up seeing the same thing.
- [x] **Nothing counts twice.** Usage and rating changes apply exactly once.
- [x] **Paid means access.** Someone who has paid is never treated as though they have not.
- [x] **Unpaid means no access.** Nobody keeps paid access beyond what they paid for plus the grace period.
- [x] **Limits hold.** Nobody gets more than their limits allow.
- [x] **Watchers see the truth.** People watching a game see exactly the game being played.
- [x] **Chess is correct.** Always.
- [x] **No offensive usernames exist.** Ever.
- [x] **Becoming a member loses nothing.** Going from guest to account never loses or duplicates progress.

## 8. Room to grow

Nothing in "Not in v1" is built, but v1 must not stand in its way.

- [x] A second game can be added without changing spaces, social, offline, or subscriptions.
- [x] The product can host every kind of game we intend: single player, turn based multiplayer, and live party games with many people in different roles.
- [x] New games and new features can be given limits without changing how limits work.
- [x] Another way to pay can be added without changing how limits work.
- [x] The app can be delivered beyond the mobile web (phones, tablets, desktop) without being rebuilt.
- [x] Other languages can be added without reworking the product.

Room to grow means nothing blocks the path. It does not mean building any part of the future now.

---

# Not in v1

None of this is built, stubbed, or hinted at in v1.

- Any game other than chess puzzles, including chess against a friend and party games
- Chat or voice
- Leaderboards, public ratings, achievements
- App store releases
- Puzzle creation or any user made content
- Moderation beyond usernames (no reporting, no admin tools)
- Other languages
- More than one paid plan, trials, coupons, team plans

---

# Decisions

Owner: human. Agents ask. Agents do not guess.

- When the host leaves a live space, the space ends. There is no pause and no transfer.
- Offline with friends: offline in v1 means playing alone offline. Spaces, watching, and everything social require a connection.
- The actual limits: guest gets 20 puzzles per day and can host, join, and watch spaces, but has no friends and no feed customization; free gets unlimited puzzles, friends, feed customization, and at most 1 hosted space at a time; paid never hits a limit. Every value lives in config.
- Grace period: a paid person who goes offline keeps paid access for 7 days.
- Hints and rating: a clean solve scores 1, a hint or a wrong move scores 0.5, and viewing the solution or abandoning scores 0.
- How fast is fast: warm `bun check` finishes in under 10 minutes, and peer-visible sync p95 is under 200 ms.
- Determined cheaters: yes, it is acceptable in v1 that someone willing to wipe their device can reset guest limits.

Assumed unless corrected: watching is watch only, and guest progress carries over on sign in.
