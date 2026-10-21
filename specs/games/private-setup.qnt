// A game with a private setup: something each side prepares in secret before
// play, such as a fleet in Battleship. Alice creates a custom game of it, or is
// paired with Bob for a matched game of it; Carol is in the space and watches.
// Each person sees only their own private setup, never anyone else's, during
// the game and after it, in its history and review too. Everyone sees who is
// ready.
// In a custom game, Alice is the creator on the first side, and Bob or a bot
// is on the second; a rematch swaps the sides. A person becomes ready only
// with a complete private setup, which confirms it; while ready they cannot
// change it, and withdrawing readiness lets them change it again. Only Alice starts, once every person is
// ready, and the bot arranges its private setup when the custom game starts. A
// rematch of a finished custom game starts with no private setups.
// A custom game against a bot needs the connection: with none, Alice cannot
// start it, and a move she makes waits, showing no result, until the
// connection returns.
// In a matched game, choosing one's complete private setup makes a person
// ready, and it is final. Both have 2 minutes from pairing to choose; when
// that runs out first, the matched game is aborted with no result. The first
// side's 30 seconds for the first move begin once both are ready, and the
// second side's 30 seconds once the first side has moved. Either person may
// abort until both have made their first move.
// A device with no connection keeps showing who it last saw ready, and its
// person cannot become ready, start, abort, resign or move, except for the
// waiting move above.
module private_setup {
  pure val PEOPLE = Set("alice", "bob", "carol")
  /// What a private setup can be: none yet, incomplete, or one of two complete choices.
  pure val COMPLETE_SETUPS = Set("complete layout", "other complete layout")
  pure val SETUP_CHOICES = Set("incomplete").union(COMPLETE_SETUPS)
  pure val SETUP_SECONDS = 120
  pure val FIRST_MOVE_SECONDS = 30

  /// A "custom" game or a "matched" game.
  var kind: str
  /// Who is on each side: "alice" first, and "bob" or "bot" second.
  var participants: str -> str
  /// "setting up", "under way", "finished" or "aborted".
  var status: str
  /// Each participant's private setup: "none", "incomplete" or a complete one.
  var privateSetup: str -> str
  /// Which participants are ready.
  var ready: str -> bool
  /// Whom each person sees ready.
  var readyShown: str -> Set[str]
  /// Whose private setup each person sees.
  var privateSetupShown: str -> Set[str]
  /// Seconds since a matched game's pairing while its private setups are being chosen.
  var setupSeconds: int
  /// Seconds the side to move has spent on its first move.
  var firstMoveSeconds: int
  var movesPlayed: int
  var sideToMove: str
  /// A move made with no connection, waiting for it to return.
  var moveWaiting: bool
  var _offline: Set[str]
  /// Each ready participant's private setup as it was when they became ready.
  var _confirmed: str -> str

  def _sides = Set(participants.get("first"), participants.get("second"))
  def _persons = _sides.intersect(PEOPLE)
  def _againstBot = _sides.contains("bot")
  pure def _complete(setup: str): bool = COMPLETE_SETUPS.contains(setup)
  def _readySet(r: str -> bool): Set[str] = _sides.filter(p => r.get(p))

  action _update(
    newStatus: str, setups: str -> str, r: str -> bool, setupTime: int, moveTime: int,
    moves: int, waiting: bool, offline: Set[str], confirmed: str -> str,
  ): bool = all {
    kind' = kind, participants' = participants, status' = newStatus,
    privateSetup' = setups, ready' = r,
    readyShown' = PEOPLE.mapBy(v => if (offline.contains(v)) readyShown.get(v) else _readySet(r)),
    privateSetupShown' = PEOPLE.mapBy(v => if (_persons.contains(v)) Set(v) else Set()),
    setupSeconds' = setupTime, firstMoveSeconds' = moveTime,
    movesPlayed' = moves, sideToMove' = if (moves % 2 == 0) "first" else "second",
    moveWaiting' = waiting, _offline' = offline, _confirmed' = confirmed,
  }
  action _hold = _update(status, privateSetup, ready, setupSeconds, firstMoveSeconds, movesPlayed, moveWaiting, _offline, _confirmed)
  action _move(offline: Set[str]): bool =
    _update(status, privateSetup, ready, setupSeconds, 0, movesPlayed + 1, false, offline, _confirmed)

  action init = {
    nondet beginning = Set("custom game against Bob", "custom game against a bot", "matched game").oneOf()
    val second = if (beginning == "custom game against a bot") "bot" else "bob"
    all {
      kind' = if (beginning == "matched game") "matched" else "custom",
      participants' = Map("first" -> "alice", "second" -> second),
      status' = "setting up",
      privateSetup' = Set("alice", second).mapBy(_ => "none"),
      ready' = Set("alice", second).mapBy(_ => false),
      readyShown' = PEOPLE.mapBy(_ => Set()),
      privateSetupShown' = PEOPLE.mapBy(v => if (Set("alice", second).contains(v)) Set(v) else Set()),
      setupSeconds' = 0, firstMoveSeconds' = 0, movesPlayed' = 0, sideToMove' = "first",
      moveWaiting' = false, _offline' = Set(),
      _confirmed' = Set("alice", second).mapBy(_ => "none"),
    }
  }
  /// Change one's own private setup, or keep it if one is ready or the game is no longer being set up.
  action changePrivateSetup(actor: str, setup: str): bool =
    if (status == "setting up" and _persons.contains(actor) and not(ready.get(actor)))
      _update(status, privateSetup.set(actor, setup), ready, setupSeconds, firstMoveSeconds, movesPlayed, moveWaiting, _offline, _confirmed)
    else _hold
  /// In a custom game, agree to start with one's complete private setup, which confirms it.
  action becomeReady(actor: str): bool =
    if (kind == "custom" and status == "setting up" and _persons.contains(actor) and not(ready.get(actor))
        and _complete(privateSetup.get(actor)) and not(_offline.contains(actor)))
      _update(status, privateSetup, ready.set(actor, true), setupSeconds, firstMoveSeconds, movesPlayed, moveWaiting, _offline,
        _confirmed.set(actor, privateSetup.get(actor)))
    else _hold
  /// In a custom game, withdraw readiness before the start, which lets the private setup change again.
  action becomeUnready(actor: str): bool =
    if (kind == "custom" and status == "setting up" and _persons.contains(actor) and ready.get(actor) and not(_offline.contains(actor)))
      _update(status, privateSetup, ready.set(actor, false), setupSeconds, firstMoveSeconds, movesPlayed, moveWaiting, _offline, _confirmed)
    else _hold
  /// In a matched game, choose one's complete private setup once; play can begin when both have.
  action choosePrivateSetup(actor: str): bool =
    if (kind == "matched" and status == "setting up" and _persons.contains(actor) and not(ready.get(actor))
        and _complete(privateSetup.get(actor)) and not(_offline.contains(actor))) {
      val r = ready.set(actor, true)
      val both = _sides.forall(p => r.get(p))
      _update(if (both) "under way" else "setting up", privateSetup, r, setupSeconds, 0, movesPlayed, moveWaiting, _offline,
        _confirmed.set(actor, privateSetup.get(actor)))
    } else _hold
  /// Only the creator starts a custom game, once every person is ready; a bot then arranges its private setup.
  action startGame(actor: str): bool =
    if (kind == "custom" and status == "setting up" and actor == "alice" and not(_offline.contains("alice"))
        and _persons.forall(p => ready.get(p)))
      _update("under way",
        if (_againstBot) privateSetup.set("bot", "complete layout") else privateSetup,
        if (_againstBot) ready.set("bot", true) else ready,
        setupSeconds, firstMoveSeconds, movesPlayed, moveWaiting, _offline,
        if (_againstBot) _confirmed.set("bot", "complete layout") else _confirmed)
    else _hold
  /// A move by the person whose turn it is. In a custom game against a bot with no connection it waits.
  action playMove(actor: str): bool =
    if (status == "under way" and participants.get(sideToMove) == actor and _persons.contains(actor)) {
      if (not(_offline.contains(actor))) _move(_offline)
      else if (kind == "custom" and _againstBot and not(moveWaiting))
        _update(status, privateSetup, ready, setupSeconds, firstMoveSeconds, movesPlayed, true, _offline, _confirmed)
      else _hold
    } else _hold
  /// The bot replies on its turn while the host has a connection.
  action botPlays: bool = all {
    status == "under way", participants.get(sideToMove) == "bot", not(_offline.contains("alice")),
    _move(_offline),
  }
  /// Time passes in a matched game: setting up ends at 2 minutes, and a first move missed at 30 seconds aborts it.
  action secondsPass(seconds: int): bool =
    if (kind == "matched" and status == "setting up")
      _update(if (setupSeconds + seconds >= SETUP_SECONDS) "aborted" else status, privateSetup, ready,
        setupSeconds + seconds, firstMoveSeconds, movesPlayed, moveWaiting, _offline, _confirmed)
    else if (kind == "matched" and status == "under way" and movesPlayed < 2)
      _update(if (firstMoveSeconds + seconds >= FIRST_MOVE_SECONDS) "aborted" else status, privateSetup, ready,
        setupSeconds, firstMoveSeconds + seconds, movesPlayed, moveWaiting, _offline, _confirmed)
    else _hold
  /// Either person aborts a matched game, while it is set up too, until both have made their first move.
  action abortGame(actor: str): bool =
    if (kind == "matched" and Set("setting up", "under way").contains(status) and movesPlayed < 2
        and _persons.contains(actor) and not(_offline.contains(actor)))
      _update("aborted", privateSetup, ready, setupSeconds, firstMoveSeconds, movesPlayed, moveWaiting, _offline, _confirmed)
    else _hold
  /// A participant gives up the game under way; a matched game needs both first moves first.
  action resignGame(actor: str): bool =
    if (status == "under way" and _persons.contains(actor) and not(_offline.contains(actor)) and (kind == "custom" or movesPlayed >= 2))
      _update("finished", privateSetup, ready, setupSeconds, firstMoveSeconds, movesPlayed, false, _offline, _confirmed)
    else _hold
  /// A finished custom game's rematch swaps the sides and starts with no private setups and nobody ready.
  action rematch(actor: str): bool =
    if (kind == "custom" and status == "finished" and actor == "alice" and not(_offline.contains("alice"))) all {
      kind' = kind, status' = "setting up",
      participants' = Map("first" -> participants.get("second"), "second" -> participants.get("first")),
      privateSetup' = _sides.mapBy(_ => "none"), ready' = _sides.mapBy(_ => false),
      readyShown' = PEOPLE.mapBy(v => if (_offline.contains(v)) readyShown.get(v) else Set()),
      privateSetupShown' = privateSetupShown,
      setupSeconds' = 0, firstMoveSeconds' = 0, movesPlayed' = 0, sideToMove' = "first",
      moveWaiting' = false, _offline' = _offline, _confirmed' = _sides.mapBy(_ => "none"),
    } else _hold
  /// A person's device loses its connection and keeps showing who it last saw ready.
  action loseConnection(actor: str): bool = all {
    not(_offline.contains(actor)),
    _update(status, privateSetup, ready, setupSeconds, firstMoveSeconds, movesPlayed, moveWaiting, _offline.union(Set(actor)), _confirmed),
  }
  /// The connection returns; a waiting move counts if it is still the person's turn.
  action connectionReturns(actor: str): bool = all {
    _offline.contains(actor),
    if (actor == "alice" and moveWaiting and status == "under way" and participants.get(sideToMove) == "alice") _move(_offline.exclude(Set(actor)))
    else _update(status, privateSetup, ready, setupSeconds, firstMoveSeconds, movesPlayed, false, _offline.exclude(Set(actor)), _confirmed),
  }
  action step = any {
    { nondet actor = PEOPLE.oneOf() nondet setup = SETUP_CHOICES.oneOf() changePrivateSetup(actor, setup) },
    { nondet actor = PEOPLE.oneOf() becomeReady(actor) },
    { nondet actor = PEOPLE.oneOf() becomeUnready(actor) },
    { nondet actor = PEOPLE.oneOf() choosePrivateSetup(actor) },
    { nondet actor = PEOPLE.oneOf() startGame(actor) },
    { nondet actor = PEOPLE.oneOf() playMove(actor) },
    botPlays,
    { nondet seconds = Set(1, 29, 30, 60, 119).oneOf() secondsPass(seconds) },
    { nondet actor = PEOPLE.oneOf() abortGame(actor) },
    { nondet actor = PEOPLE.oneOf() resignGame(actor) },
    { nondet actor = PEOPLE.oneOf() rematch(actor) },
    { nondet actor = PEOPLE.oneOf() loseConnection(actor) },
    { nondet actor = PEOPLE.oneOf() connectionReturns(actor) },
  }

  /// Each person sees their own private setup and nobody else's.
  val invOwnPrivateSetupOnly = PEOPLE.forall(v => privateSetupShown.get(v).subseteq(Set(v)))
  /// Only a complete private setup is ready, and it cannot change while ready.
  val invReadySetupLocked = _sides.forall(p => ready.get(p) implies (_complete(privateSetup.get(p)) and privateSetup.get(p) == _confirmed.get(p)))
  /// Everyone with a connection sees exactly who is ready.
  val invReadinessShown = PEOPLE.forall(v => not(_offline.contains(v)) implies readyShown.get(v) == _readySet(ready))
  /// Play needs every participant ready with a complete private setup.
  val invPlayNeedsReady = Set("under way", "finished").contains(status) implies _sides.forall(p => ready.get(p))
  /// A matched game being set up has less than 2 minutes behind it; one not begun, less than 30 seconds for the move due.
  val invSetupTime = kind == "matched" implies and {
    status == "setting up" implies setupSeconds < SETUP_SECONDS,
    (status == "under way" and movesPlayed < 2) implies firstMoveSeconds < FIRST_MOVE_SECONDS,
  }
  /// Only a matched game is aborted, and only before both first moves; a game being set up has no moves.
  val invAbortedBeforeBothMoves = and {
    status == "aborted" implies (kind == "matched" and movesPlayed < 2),
    status == "setting up" implies (movesPlayed == 0 and not(moveWaiting)),
    sideToMove == (if (movesPlayed % 2 == 0) "first" else "second"),
  }
  /// A move waits only in a custom game against a bot while the host has no connection.
  val invWaitingMove = moveWaiting implies (kind == "custom" and _againstBot and _offline.contains("alice") and status == "under way")
}
