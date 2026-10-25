// Alice publishes editions of her puzzle River for a game. Each edition keeps
// the game's rules it was published under. Bob starts and resumes River on his
// phone. After a rules change, an edition published before it is neither
// started nor continued under the changed rules: Bob is told it needs a
// version of the app with its rules, play of it stops, and his saved attempt
// at it is kept. An edition published after the change plays as usual.
// Bob's phone starts connected. Offline he keeps every saved attempt and can
// start an edition his phone already has; an edition published meanwhile
// reaches his phone when the connection returns. The examples use at most two
// editions and one rules change; the product has no such limits.
module edition_rules {
  /// The rules each edition was published under: 0 before the rules change, 1 after it.
  var editions: List[int]
  /// The game's current rules.
  var rules: int
  /// The editions Bob has a saved attempt at.
  var attempts: Set[int]
  /// The edition Bob is playing, or -1.
  var activeAttempt: int
  /// The editions Bob's phone has.
  var availableOnPhone: Set[int]
  var _online: bool
  var _previousEditions: List[int]
  var _previousAttempts: Set[int]

  action _keep(published: List[int], current: int, saved: Set[int], playing: int,
    online: bool): bool = all {
    editions' = published, rules' = current, attempts' = saved, activeAttempt' = playing,
    availableOnPhone' = (if (online) published.indices() else availableOnPhone),
    _online' = online, _previousEditions' = editions, _previousAttempts' = attempts,
  }

  action init = all {
    editions' = List(0), rules' = 0, attempts' = Set(), activeAttempt' = -1,
    availableOnPhone' = Set(0), _online' = true, _previousEditions' = List(0),
    _previousAttempts' = Set(),
  }

  /// Alice publishes another edition under the game's current rules.
  action publishPuzzle: bool = all {
    editions.length() < 2,
    _keep(editions.append(rules), rules, attempts, activeAttempt, _online),
  }

  /// Starting needs an edition on the phone that was published under the
  /// current rules; otherwise nothing starts and other attempts are kept.
  action startPuzzle(edition: int): bool = all {
    editions.indices().contains(edition),
    if (availableOnPhone.contains(edition) and editions[edition] == rules)
      _keep(editions, rules, attempts.union(Set(edition)), edition, _online)
    else _keep(editions, rules, attempts, activeAttempt, _online),
  }

  /// A saved attempt continues only under its edition's rules, and is kept either way.
  action resumeAttempt(edition: int): bool = all {
    attempts.contains(edition),
    if (editions[edition] == rules) _keep(editions, rules, attempts, edition, _online)
    else _keep(editions, rules, attempts, activeAttempt, _online),
  }

  /// World event: the game's rules change once. Play of an edition published
  /// before it stops; its saved attempt is kept.
  action rulesChange: bool = all {
    rules == 0,
    val playing = if (activeAttempt == -1) -1
      else if (editions[activeAttempt] != 1) -1 else activeAttempt
    _keep(editions, 1, attempts, playing, _online),
  }

  /// Model-only: Bob's phone loses its connection and keeps every saved attempt.
  action _loseConnection: bool = all {
    _online, _keep(editions, rules, attempts, activeAttempt, false),
  }

  /// Editions published meanwhile reach Bob's phone.
  action connectionReturns: bool = all {
    not(_online), _keep(editions, rules, attempts, activeAttempt, true),
  }

  action step = {
    nondet edition = Set(0, 1).oneOf()
    any { publishPuzzle, startPuzzle(edition), resumeAttempt(edition), rulesChange,
      _loseConnection, connectionReturns }
  }

  /// No later publication or rules change alters the rules an edition was published under.
  val invEditionsKeepTheirRules = _previousEditions.indices().forall(i =>
    editions.indices().contains(i) and editions[i] == _previousEditions[i])
  /// Bob plays an edition only under the rules it was published under.
  val invPlayOnlyUnderTheEditionsRules = activeAttempt == -1 or
    (attempts.contains(activeAttempt) and editions[activeAttempt] == rules)
  /// A rules change, a publication or a refusal never discards a saved attempt.
  val invSavedAttemptsAreKept = _previousAttempts.subseteq(attempts) and
    attempts.forall(a => editions.indices().contains(a))
  /// While connected, Bob's phone has every published edition.
  val invConnectedPhoneHasEveryEdition = _online implies availableOnPhone == editions.indices()
  /// Offline, Bob plays only an edition his phone already has.
  val invOfflinePlayUsesEditionsOnThePhone = not(_online) implies
    (activeAttempt == -1 or availableOnPhone.contains(activeAttempt))
}
