# Product glossary

Use these terms consistently in feature files. Prefer the person's intent and
observable outcome over controls such as buttons, dialogs, taps, or navigation.

- **actor** — a named person participating in a scenario, such as Alice or Bob.
- **friend request** — a pending invitation from one person to another.
- **friends list** — the person's current, non-deleted friendships.
- **guest** — a person using the product without an account. Access behavior is
  still expressed through permissions, never identity checks in product code.
- **live space badge** — the observable indication that a friend is currently
  in an open space; feature text normally says the friend is “live”.
- **notice** — an inbox item reporting an outcome, distinct from a pending
  request.
- **person** — either a named actor or a displayed username.
- **space** — a live room people may host, join, leave, reopen, or end.
- **avatar** — the picture on a person's profile: a style (such as Bottts)
  drawn from a seed. Every newcomer starts with one.
- **sign-in method** — a way a person gets back into their account (Google or
  Apple). An account always keeps at least one.
- **another device / other device** — a second device signed into the same
  person's account; each device keeps its own place.
- **Settings** — the place a person reaches from anywhere in the app to manage
  their account and preferences.
- **tabs** — the app's home once it has opened; Spaces is where a person lands.
- **the view switches to {actor}'s device** — the scenario turns its attention
  to that person's app; every person's app keeps its own place meanwhile.
- **Plus** — the paid subscription a signed-in person can buy; subscribing
  starts a monthly trial.
- **membership** — one Plus subscription's record: its status, plan (monthly or
  yearly), and current period end. A person may accumulate several over time;
  the newest is the one that counts.
- **trialing / active / delinquent / ended** — membership statuses: in the free
  trial, paid and current, last payment failed but retries continue, and over.
- **period end** — when the membership's current billing period (trial, month,
  or year) finishes and it next renews or, if set to cancel, ends.
- **grace** — the window after a payment fails or a membership ends during which
  the person keeps paid access.
- **paid access / free access** — the person's billing tier as the app answers
  it, online or offline.
- **billing portal** — the payment provider's self-service page where a member
  cancels, renews, or switches plan.
- **the provider** — the payment provider; its events (renewals, failures,
  retries, redeliveries) reach the product asynchronously.
- **puzzle feed** — the endless run of chess puzzles a person plays in a space;
  "moves on to the next puzzle" advances it. Its settings are the history
  filter ("Unseen" / "Any"), theme, and target rating (automatic with an
  offset, or custom).
- **attempt** — one play of one puzzle, from start to solved, failed,
  revealed, or abandoned (skipped). The first wrong move is the attempt's
  outcome; a retry continues the same attempt.
- **rated attempt** — an attempt that moves the puzzle rating: at most one per
  puzzle, ever. A repeat of an already-played puzzle is unrated.
- **provisional** — a puzzle rating whose deviation has not yet settled, shown
  with a trailing "?" (for example "1500?").
- **game log** — the person's history of played puzzles, each marked solved,
  failed, or abandoned, and each openable in review.
- **retired puzzle** — a puzzle taken out of the feed: it is never served
  again, but it stays in the game log and still opens in review.
- **review** — stepping through a played puzzle's full line; "move N" is the
  position after the Nth move of the line.
- **watcher** — someone in a space watching the host's puzzle. A watcher may
  suggest a move but never drives the puzzle and is never rated for it.
- **puzzle start** — one unit of the daily rated-puzzle allowance, used when a
  rated puzzle starts.
- **critical journey** — a flow people rely on most, which must never break
  anywhere people use the app (`specs/journeys/`).
- **fresh device** — a device that has never opened the app: nothing saved on
  it and nobody signed in.
- **the team** — the people who run the product. They observe it from outside,
  as people do, plus the records and declarations they keep for it.
- **the Simulator** — a tool for the team, at its own address beside the app.
  People who use the app never need it.
- **environment** — one complete, separate copy of the product (production is
  one). "This environment" is the copy a health check is looking at; a
  **production environment** is one real people use.
- **live updates** — what happens in a space reaching everyone in it as it
  happens.
- **Google sign-in's way back** — where Google sends a person once they have
  signed in: always back to the app they started from, in the environment they
  started in.
- **room** — a shared place that several people's devices join, where one
  authority, the room itself, keeps the live state everyone sees. A room can
  crash (it is then down) and restart (it is up again with what it had).
- **shared counter** — a room holding one count that anyone in it can
  increment or decrement; "everyone agrees on a count of N" means the room and
  every device in it show N.
- **ownership room** — a room anyone may claim while nobody has, becoming its
  owner; only the owner may bump it, raising its bump count. It can be set to
  turn a named person away, refusing every change they make, even a claim.
- **refused** — a change the room will not accept, reported to its sender:
  "invalid" when the room does not understand it, "not allowed" when the room
  turns the sender away. A refused change alters nothing.
- **waiting change** — a change a person made that has not reached the room
  yet (they are offline, their network has stalled, or their app crashed); it
  already shows on their own device.
- **stalled network** — a person's network stops carrying anything in either
  direction while they are still in the room; it **recovers** later. Unlike
  being offline, the person's device does not know it is cut off.
- **match clock** — the room's own clock in a timed match between White and
  Black; it runs down only the bank of the side to move.
- **bank** — the time a side has left in a timed match, in ms. A move keeps
  what is left of it and passes the clock to the opponent.
- **flag** — a side's flag falls when their bank runs out while they are to
  move; the room then ends the match and the opponent wins on time. Claiming
  a flag that has not fallen changes nothing.
- **hosting limit** — how many spaces a person may host at once: one for a
  guest or a free account, no limit for a Plus member. Reaching it is an
  invitation to Plus.
- **refund** — the provider returning a member's payment. A refunded
  membership ends at once, with no grace.
- **inbox** — where a signed-in person finds friend requests and notices.
- **devices** — the list of devices signed into a person's account, reached
  from Settings.
- **outdated app** — a version of the app older than the product still
  accepts; it asks the person to update.
- **note** — a piece of writing a person keeps: a title (such as "Groceries")
  and a body (such as "milk"). Writing a note with a title that already exists
  replaces its body; writing a deleted note again brings it back.
- **owner of a note** — whoever last wrote the note. Only the owner may delete
  it.
- **shared space** — a group of people who share notes. Anyone can create one,
  join it, or leave it, even offline; every note written by someone in it
  reaches everyone in it. Not the same as a (live) **space**.
- **{person}'s app / phone / tablet** — one of a person's devices. A person
  may use the app on more than one device; each one ends up with all of their
  notes.
- **offline / back online** — a device has no connection, then has it again.
  What a person writes offline shows for them at once and reaches others once
  the device is back online, with nothing for the person to do.
- **crashes and reopens** — the app stops without warning and is opened again;
  it still has everything it had.
- **hear back about a save** — the word that a person's write has been kept
  for everyone. It can get lost on the way back; the write still counts
  exactly once.
- **online-only action** — something that truly needs a connection (writing
  an announcement). Tried offline it tells the person it needs a connection, and
  it is not done later on its own.
- **announcement** — a note that goes out to everyone in the shared space the
  moment it is written, so it can only be written while connected. Once
  written it shows like any other note.
- **refused edit** — a write the person's device accepted that the rules
  refuse once it reaches everyone else, such as deleting a note offline that
  someone else has since written (and so now owns). It is undone on its
  author's device and never reaches anyone else. A delete the device already
  knows is not allowed simply does not happen, and leaves no notice.
- **notice of a refused edit** — a **notice** telling the author that their
  edit was refused. It stays until the author **acknowledges** it, and then it
  is gone.
