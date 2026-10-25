// A custom game of a game with secret choices and four sides in a fixed turn
// order: Alice created it and plays the first side, Bob the second, Carol the
// third and a bot the fourth. Eve is in the space and watches.
// Play goes in rounds. Each round opens with secret choices: every side makes
// one in secret, the bot at once. Everyone sees which sides have made theirs,
// and each person sees only their own side's secret choice, never another
// side's, and a watcher sees none. A secret choice is final for its round; a
// second one, one for an earlier round, one while play goes on, one from the
// watcher and one for a side a stand-in plays are refused and change nothing.
// Nothing a round's secret choices decide happens until the last side has
// made one; then they all take effect at once, and each side makes one move
// in turn, starting with the first side. After the second round's moves the
// custom game is finished with the result the game's own rules give: one
// side's victory, or a victory several sides share. Which result the rules
// give is not promised here. The result is decided once and never changes,
// and each person counts a victory, once, exactly when their side is a
// winner.
// A person whose device has no connection is away. Their device keeps
// showing which sides it last saw chosen, and they cannot make a secret
// choice, move or take back their side. After 60 seconds away, a stand-in
// plays their side, shown to everyone, by the same rules and knowing only
// what that side may know. The person keeps their side and its result; their
// own secret choices and moves are refused while the stand-in plays, and
// coming back alone does not end it: back online, they take back their side,
// and from then on the stand-in decides nothing for it. Losing the connection
// for less than 60 seconds leaves the side and its turn with its person.
module secret_choices {
  pure val PEOPLE = Set("alice", "bob", "carol", "eve")
  pure val SIDE_SET = Set("first", "second", "third", "fourth")
  pure val PARTICIPANTS = Map("first" -> "alice", "second" -> "bob", "third" -> "carol", "fourth" -> "bot")
  pure val NEXT_SIDE = Map("first" -> "second", "second" -> "third", "third" -> "fourth", "fourth" -> "first")
  /// The two secret choices a side can make in this reduced game.
  pure val CHOICES = Set("one way", "another way")
  /// The results the game's own rules may give with the last move: a victory alone or a shared victory.
  pure val RESULTS = Set(Set("third"), Set("first", "third"), Set("second", "fourth"))
  pure val ROUNDS = 2
  pure val SIDE_COUNT = 4
  pure val AWAY_SECONDS = 60

  /// Who plays each side; a stand-in never changes it.
  var participants: str -> str
  /// "under way" or "finished".
  var status: str
  /// The current round of secret choices, from 1.
  var choiceRound: int
  /// Whether the custom game is awaiting secret choices.
  var choosing: bool
  /// Each side's secret choice this round, or "" while it has made none.
  var secretChoice: str -> str
  /// Which sides each person sees as having made their secret choice.
  var chosenShown: str -> Set[str]
  /// Whose secret choice each person can see.
  var secretChoiceShown: str -> Set[str]
  /// How many rounds of secret choices have taken effect.
  var appliedRounds: int
  /// The sides a stand-in plays.
  var standIn: Set[str]
  var sideToMove: str
  var movesPlayed: int
  /// The sides that won, once the custom game is finished; several when they share the victory.
  var winners: Set[str]
  /// The victories each person's history and statistics count for this custom game.
  var victoriesShown: str -> int
  var _offline: Set[str]
  /// Bookkeeping: seconds each person has been away, up to the limit.
  var _awayFor: str -> int
  /// Bookkeeping: the side that last acted and who decided for it: "person", "stand-in", "bot" or "".
  var _actedBy: (str, str)
  var _previousRound: int
  var _previousSecretChoice: str -> str
  var _previousStandIn: Set[str]
  var _previousOffline: Set[str]
  var _previousChosenShown: str -> Set[str]
  var _previousStatus: str
  var _previousWinners: Set[str]

  pure def _ownSides(viewer: str): Set[str] = SIDE_SET.filter(s => PARTICIPANTS.get(s) == viewer)
  pure def _sideOf(actor: str): str = if (actor == "alice") "first" else if (actor == "bob") "second" else if (actor == "carol") "third" else ""
  pure def _sideAt(moves: int): str =
    if (moves % SIDE_COUNT == 0) "first" else if (moves % SIDE_COUNT == 1) "second" else if (moves % SIDE_COUNT == 2) "third" else "fourth"

  action _update(
    newStatus: str, newRound: int, awaiting: bool, choices: str -> str, applied: int, standIns: Set[str],
    turn: str, moves: int, won: Set[str], offline: Set[str], away: str -> int, acted: (str, str),
  ): bool = all {
    participants' = participants,
    status' = newStatus, choiceRound' = newRound, choosing' = awaiting, secretChoice' = choices,
    chosenShown' = PEOPLE.mapBy(v =>
      if (offline.contains(v)) chosenShown.get(v)
      else if (awaiting and newStatus == "under way") SIDE_SET.filter(s => choices.get(s) != "")
      else Set()),
    secretChoiceShown' = PEOPLE.mapBy(v =>
      if (offline.contains(v)) secretChoiceShown.get(v)
      else _ownSides(v).filter(s => choices.get(s) != "")),
    appliedRounds' = applied, standIn' = standIns, sideToMove' = turn, movesPlayed' = moves,
    winners' = won,
    victoriesShown' = PEOPLE.mapBy(p => if (newStatus == "finished" and _ownSides(p).exists(s => won.contains(s))) 1 else 0),
    _offline' = offline, _awayFor' = away, _actedBy' = acted,
    _previousRound' = choiceRound, _previousSecretChoice' = secretChoice, _previousStandIn' = standIn,
    _previousOffline' = _offline, _previousChosenShown' = chosenShown,
    _previousStatus' = status, _previousWinners' = winners,
  }
  action _hold = _update(status, choiceRound, choosing, secretChoice, appliedRounds, standIn,
    sideToMove, movesPlayed, winners, _offline, _awayFor, ("", ""))

  /// One side's secret choice; the last one makes every secret choice of the round take effect at once.
  action _choose(side: str, choice: str, who: str): bool = {
    val choices = secretChoice.set(side, choice)
    val complete = SIDE_SET.forall(s => choices.get(s) != "")
    _update(status, choiceRound, not(complete), choices, if (complete) choiceRound else appliedRounds, standIn,
      "first", movesPlayed, winners, _offline, _awayFor, (side, who))
  }
  /// One side's move; the round's last move opens the next round of secret choices or finishes the custom game.
  action _move(side: str, result: Set[str], who: str): bool = {
    val moves = movesPlayed + 1
    val roundDone = moves - (choiceRound - 1) * SIDE_COUNT == SIDE_COUNT
    if (roundDone and choiceRound == ROUNDS)
      _update("finished", choiceRound, false, secretChoice, appliedRounds, standIn,
        sideToMove, moves, result, _offline, _awayFor, (side, who))
    else if (roundDone)
      _update(status, choiceRound + 1, true, SIDE_SET.mapBy(_ => ""), appliedRounds, standIn,
        "first", moves, winners, _offline, _awayFor, (side, who))
    else
      _update(status, choiceRound, false, secretChoice, appliedRounds, standIn,
        NEXT_SIDE.get(side), moves, winners, _offline, _awayFor, (side, who))
  }
  /// A bot or stand-in acting for a side: its secret choice while the round is open, else its move on its turn.
  action _decideFor(side: str, choice: str, result: Set[str], who: str): bool =
    if (status == "under way" and choosing and secretChoice.get(side) == "") _choose(side, choice, who)
    else if (status == "under way" and not(choosing) and sideToMove == side) _move(side, result, who)
    else _hold

  action init = all {
    participants' = PARTICIPANTS,
    status' = "under way", choiceRound' = 1, choosing' = true,
    secretChoice' = SIDE_SET.mapBy(_ => ""),
    chosenShown' = PEOPLE.mapBy(_ => Set()), secretChoiceShown' = PEOPLE.mapBy(_ => Set()),
    appliedRounds' = 0, standIn' = Set(), sideToMove' = "first", movesPlayed' = 0,
    winners' = Set(), victoriesShown' = PEOPLE.mapBy(_ => 0),
    _offline' = Set(), _awayFor' = PEOPLE.mapBy(_ => 0), _actedBy' = ("", ""),
    _previousRound' = 1, _previousSecretChoice' = SIDE_SET.mapBy(_ => ""), _previousStandIn' = Set(),
    _previousOffline' = Set(), _previousChosenShown' = PEOPLE.mapBy(_ => Set()),
    _previousStatus' = "under way", _previousWinners' = Set(),
  }

  /// A participant makes their side's secret choice for a round; anything but the current round's first one is refused.
  action makeSecretChoice(actor: str, choice: str, forRound: int): bool = {
    val side = _sideOf(actor)
    if (status == "under way" and choosing and side != "" and forRound == choiceRound
        and secretChoice.get(side) == "" and not(standIn.contains(side)) and not(_offline.contains(actor)))
      _choose(side, choice, "person")
    else _hold
  }
  /// The participant whose turn it is makes a move; refused while choosing, out of turn, offline or while a stand-in plays their side.
  action playMove(actor: str, result: Set[str]): bool = {
    val side = _sideOf(actor)
    if (status == "under way" and not(choosing) and side != "" and sideToMove == side
        and not(standIn.contains(side)) and not(_offline.contains(actor)))
      _move(side, result, "person")
    else _hold
  }
  /// The bot makes its own side's secret choice, or its move on its turn.
  action botPlays(choice: str, result: Set[str]): bool = all {
    status == "under way",
    _decideFor("fourth", choice, result, "bot"),
  }
  /// A stand-in decides for the side it plays, as that side's bot would.
  action standInPlays(side: str, choice: str, result: Set[str]): bool = all {
    standIn.contains(side), status == "under way",
    _decideFor(side, choice, result, "stand-in"),
  }
  /// Time passes; a participant away for 60 seconds gets a stand-in for their side.
  action secondsPass(seconds: int): bool = {
    val away = PEOPLE.mapBy(p => if (_offline.contains(p)) (if (_awayFor.get(p) + seconds >= AWAY_SECONDS) AWAY_SECONDS else _awayFor.get(p) + seconds) else 0)
    val standIns = if (status == "under way")
      standIn.union(SIDE_SET.filter(s => PARTICIPANTS.get(s) != "bot" and away.get(PARTICIPANTS.get(s)) >= AWAY_SECONDS))
      else standIn
    _update(status, choiceRound, choosing, secretChoice, appliedRounds, standIns,
      sideToMove, movesPlayed, winners, _offline, away, ("", ""))
  }
  /// A participant back online takes back their side from its stand-in.
  action takeBackSide(actor: str): bool = {
    val side = _sideOf(actor)
    if (status == "under way" and side != "" and standIn.contains(side) and not(_offline.contains(actor)))
      _update(status, choiceRound, choosing, secretChoice, appliedRounds, standIn.exclude(Set(side)),
        sideToMove, movesPlayed, winners, _offline, _awayFor, ("", ""))
    else _hold
  }
  /// A person's device loses its connection and keeps what it last showed.
  action loseConnection(actor: str): bool = all {
    not(_offline.contains(actor)),
    _update(status, choiceRound, choosing, secretChoice, appliedRounds, standIn,
      sideToMove, movesPlayed, winners, _offline.union(Set(actor)), _awayFor, ("", "")),
  }
  /// The connection comes back; any stand-in keeps playing until its person takes back their side.
  action connectionReturns(actor: str): bool = all {
    _offline.contains(actor),
    _update(status, choiceRound, choosing, secretChoice, appliedRounds, standIn,
      sideToMove, movesPlayed, winners, _offline.exclude(Set(actor)), _awayFor.set(actor, 0), ("", "")),
  }

  action step = any {
    { nondet actor = PEOPLE.oneOf() nondet choice = CHOICES.oneOf() nondet forRound = 1.to(ROUNDS).oneOf() makeSecretChoice(actor, choice, forRound) },
    { nondet actor = PEOPLE.oneOf() nondet result = RESULTS.oneOf() playMove(actor, result) },
    { nondet choice = CHOICES.oneOf() nondet result = RESULTS.oneOf() botPlays(choice, result) },
    { nondet side = SIDE_SET.oneOf() nondet choice = CHOICES.oneOf() nondet result = RESULTS.oneOf() standInPlays(side, choice, result) },
    { nondet seconds = Set(1, 29, 59, 60).oneOf() secondsPass(seconds) },
    { nondet actor = PEOPLE.oneOf() takeBackSide(actor) },
    { nondet actor = PEOPLE.oneOf() loseConnection(actor) },
    { nondet actor = PEOPLE.oneOf() connectionReturns(actor) },
  }

  /// Each person sees only their own side's secret choice; a watcher sees none.
  val invOwnSecretChoiceOnly = PEOPLE.forall(v => secretChoiceShown.get(v).subseteq(_ownSides(v)))
  /// Everyone with a connection sees exactly which sides have made their secret choice while the custom game awaits them.
  val invChosenShown = PEOPLE.forall(v => not(_offline.contains(v)) implies
    chosenShown.get(v) == (if (choosing and status == "under way") SIDE_SET.filter(s => secretChoice.get(s) != "") else Set()))
  /// A device without a connection keeps showing which sides it last saw chosen.
  val invOfflineShowsLastSeen = PEOPLE.forall(v =>
    (_offline.contains(v) and _previousOffline.contains(v)) implies chosenShown.get(v) == _previousChosenShown.get(v))
  /// A round's secret choices take effect only once every side has made one, and no move is made while they are awaited.
  val invChoicesTakeEffectTogether = and {
    choosing implies (appliedRounds == choiceRound - 1 and movesPlayed == (choiceRound - 1) * SIDE_COUNT),
    not(choosing) implies (appliedRounds == choiceRound and SIDE_SET.forall(s => secretChoice.get(s) != "")),
  }
  /// A secret choice is final for its round.
  val invSecretChoiceFinal = (choiceRound == _previousRound) implies
    SIDE_SET.forall(s => _previousSecretChoice.get(s) == "" or secretChoice.get(s) == _previousSecretChoice.get(s))
  /// One decider per side: its person only while no stand-in plays it and they have a connection; a stand-in only for a side it plays.
  val invOneDeciderPerSide = and {
    _actedBy._2 == "person" implies (not(_previousStandIn.contains(_actedBy._1)) and not(_previousOffline.contains(PARTICIPANTS.get(_actedBy._1)))),
    _actedBy._2 == "stand-in" implies _previousStandIn.contains(_actedBy._1),
    _actedBy._2 == "bot" implies _actedBy._1 == "fourth",
  }
  /// A stand-in begins only for a person away for 60 seconds, and the person keeps their side.
  val invStandInOnlyAfterAway = and {
    participants == PARTICIPANTS,
    standIn.forall(s => PARTICIPANTS.get(s) != "bot"),
    standIn.forall(s => _previousStandIn.contains(s) or _awayFor.get(PARTICIPANTS.get(s)) >= AWAY_SECONDS),
  }
  /// Play follows the turn order, starting each round with the first side.
  val invTurnOrder = (status == "under way" and not(choosing)) implies
    sideToMove == _sideAt(movesPlayed - (choiceRound - 1) * SIDE_COUNT)
  /// The result is decided once: a finished custom game has winners that never change.
  val invResultDecidedOnce = and {
    (status == "finished") == (winners != Set()),
    _previousStatus == "finished" implies (status == "finished" and winners == _previousWinners),
  }
  /// Each person counts one victory exactly when their side is among the winners, a shared victory included.
  val invVictoriesCounted = PEOPLE.forall(p =>
    victoriesShown.get(p) == (if (status == "finished" and _ownSides(p).exists(s => winners.contains(s))) 1 else 0))
}
