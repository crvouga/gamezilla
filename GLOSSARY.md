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
- **review** — stepping through a played puzzle's full line; "move N" is the
  position after the Nth move of the line.
- **watcher** — someone in a space watching the host's puzzle. A watcher may
  suggest a move but never drives the puzzle and is never rated for it.
- **puzzle start** — one unit of the daily rated-puzzle allowance, used when a
  rated puzzle starts.
