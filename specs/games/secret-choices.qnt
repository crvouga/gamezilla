// A custom game under way of a game with secret choices and four sides:
// Alice created it and plays the first side, Bob the second, Carol the third
// and a bot the fourth. Eve is in the space and watches.
// The game's own rules say when play reaches a round of secret choices and
// who moves next; this model follows only what every such game shares. The
// custom game starts awaiting its first round of secret choices. Each side
// makes one secret choice in the round: a person when they choose, the bot
// and any stand-in by themselves. Everyone sees which sides have made theirs,
// and each person sees only their own side's secret choice, never another
// side's; a watcher sees none. A secret choice is final for its round. A
// second one, one from someone without a side, one while the custom game is
// not awaiting secret choices and one for a side a stand-in plays are refused
// and change nothing. No move is made while a round is awaited, and nothing
// the round decides happens until the last side has made its secret choice;
// then they all take effect at once and play goes on. Play then makes moves,
// each by whoever the game's rules say moves next, until it reaches the next
// round of secret choices or the game's rules finish the custom game. The
// result is decided once, as the game's own rules decide it, and is never
// replaced; a finished custom game takes no more secret choices or moves.
// A person whose device has no connection is away. Their device keeps
// showing which sides it last saw chosen, and they cannot make a secret
// choice or take back their side. Someone away for 60 seconds gets a stand-in
// for their side, shown to everyone, playing by the same rules with only what
// that side may know, while another person is in the custom game. The person
// keeps their side; their own secret choices are refused while the stand-in
// plays it, and coming back alone does not end it: back online, they take
// back their side, and from then on the stand-in decides nothing for it.
// Play goes on only while every side has someone to play it: its person with
// a connection, the bot, or a stand-in.
module secret_choices {
  pure val PEOPLE = Set("alice", "bob", "carol", "eve")
  pure val SIDE_SET = Set("first", "second", "third", "fourth")
  pure val PARTICIPANTS = Map("first" -> "alice", "second" -> "bob", "third" -> "carol", "fourth" -> "bot")
  /// Two different secret choices a side can make in any such game.
  pure val CHOICES = Set("one choice", "another choice")
  /// Bounds for checking: the rounds of secret choices and the moves between them.
  pure val MAX_ROUNDS = 3
  pure val MAX_MOVES = 2

  /// Who plays each side; a stand-in never changes it.
  var participants: str -> str
  /// "under way" or "finished".
  var status: str
  /// How many rounds of secret choices the custom game has reached, from 1.
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
  /// Moves made since the latest round of secret choices took effect.
  var movesThisRound: int
  /// "" until the game's rules finish the custom game, then "decided".
  var result: str
  var _offline: Set[str]
  /// Bookkeeping: the side that last made a secret choice and who decided it: "person", "stand-in", "bot" or "".
  var _actedBy: (str, str)
  var _previousRound: int
  var _previousSecretChoice: str -> str
  var _previousStandIn: Set[str]
  var _previousOffline: Set[str]
  var _previousChosenShown: str -> Set[str]
  var _previousStatus: str
  var _previousMoves: int

  pure def _ownSides(viewer: str): Set[str] = SIDE_SET.filter(s => PARTICIPANTS.get(s) == viewer)
  pure def _sideOf(actor: str): str = if (actor == "alice") "first" else if (actor == "bob") "second" else if (actor == "carol") "third" else ""
  /// Every side has someone to play it: its person with a connection, the bot, or a stand-in.
  def _playable = SIDE_SET.forall(s => PARTICIPANTS.get(s) == "bot" or standIn.contains(s) or not(_offline.contains(PARTICIPANTS.get(s))))

  action _update(
    newStatus: str, newRound: int, awaiting: bool, choices: str -> str, applied: int, standIns: Set[str],
    moves: int, outcome: str, offline: Set[str], acted: (str, str),
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
    appliedRounds' = applied, standIn' = standIns, movesThisRound' = moves, result' = outcome,
    _offline' = offline, _actedBy' = acted,
    _previousRound' = choiceRound, _previousSecretChoice' = secretChoice, _previousStandIn' = standIn,
    _previousOffline' = _offline, _previousChosenShown' = chosenShown,
    _previousStatus' = status, _previousMoves' = movesThisRound,
  }
  action _hold = _update(status, choiceRound, choosing, secretChoice, appliedRounds, standIn,
    movesThisRound, result, _offline, ("", ""))

  /// One side's secret choice; the last one makes every secret choice of the round take effect at once.
  action _choose(side: str, choice: str, who: str): bool = {
    val choices = secretChoice.set(side, choice)
    val complete = SIDE_SET.forall(s => choices.get(s) != "")
    _update(status, choiceRound, not(complete), choices, if (complete) choiceRound else appliedRounds, standIn,
      0, result, _offline, (side, who))
  }

  action init = all {
    participants' = PARTICIPANTS,
    status' = "under way", choiceRound' = 1, choosing' = true,
    secretChoice' = SIDE_SET.mapBy(_ => ""),
    chosenShown' = PEOPLE.mapBy(_ => Set()), secretChoiceShown' = PEOPLE.mapBy(_ => Set()),
    appliedRounds' = 0, standIn' = Set(), movesThisRound' = 0, result' = "",
    _offline' = Set(), _actedBy' = ("", ""),
    _previousRound' = 1, _previousSecretChoice' = SIDE_SET.mapBy(_ => ""), _previousStandIn' = Set(),
    _previousOffline' = Set(), _previousChosenShown' = PEOPLE.mapBy(_ => Set()),
    _previousStatus' = "under way", _previousMoves' = 0,
  }

  /// A person makes their side's secret choice; refused when already made, not theirs, not awaited, offline or while a stand-in plays their side.
  action makeSecretChoice(actor: str, choice: str): bool = {
    val side = _sideOf(actor)
    if (status == "under way" and choosing and side != "" and secretChoice.get(side) == ""
        and not(standIn.contains(side)) and not(_offline.contains(actor)))
      _choose(side, choice, "person")
    else _hold
  }
  /// The bot makes its own side's secret choice by itself.
  action botPlays(choice: str): bool = all {
    status == "under way", choosing, secretChoice.get("fourth") == "",
    _choose("fourth", choice, "bot"),
  }
  /// A stand-in makes the secret choice of the side it plays, by itself.
  action standInPlays(side: str, choice: str): bool = all {
    status == "under way", choosing, standIn.contains(side), secretChoice.get(side) == "",
    _choose(side, choice, "stand-in"),
  }
  /// One move by whoever the game's rules say moves next; refused while secret choices are awaited.
  action playMove: bool =
    if (status == "under way" and not(choosing) and _playable and movesThisRound < MAX_MOVES)
      _update(status, choiceRound, choosing, secretChoice, appliedRounds, standIn,
        movesThisRound + 1, result, _offline, ("", ""))
    else _hold
  /// Play goes on, as the game's rules say, until it reaches the next round of secret choices, which nobody has made yet.
  action reachNextRound: bool = all {
    status == "under way", not(choosing), _playable, choiceRound < MAX_ROUNDS,
    _update(status, choiceRound + 1, true, SIDE_SET.mapBy(_ => ""), appliedRounds, standIn,
      0, result, _offline, ("", "")),
  }
  /// Play goes on until the game's own rules finish the custom game, with the result they decide.
  action finishGame: bool = all {
    status == "under way", not(choosing), _playable,
    _update("finished", choiceRound, false, secretChoice, appliedRounds, standIn,
      movesThisRound, "decided", _offline, ("", "")),
  }
  /// After 60 seconds away, a stand-in takes the side of a person without a connection, while another person is in the custom game.
  action standInTakesSide(actor: str): bool = {
    val side = _sideOf(actor)
    all {
      status == "under way", side != "", _offline.contains(actor), not(standIn.contains(side)),
      _update(status, choiceRound, choosing, secretChoice, appliedRounds, standIn.union(Set(side)),
        movesThisRound, result, _offline, ("", "")),
    }
  }
  /// A participant back online takes back their side; anyone else, or with no stand-in on their side, is refused.
  action takeBackSide(actor: str): bool = {
    val side = _sideOf(actor)
    if (status == "under way" and side != "" and standIn.contains(side) and not(_offline.contains(actor)))
      _update(status, choiceRound, choosing, secretChoice, appliedRounds, standIn.exclude(Set(side)),
        movesThisRound, result, _offline, ("", ""))
    else _hold
  }
  /// A person's device loses its connection and keeps what it last showed.
  action loseConnection(actor: str): bool = all {
    not(_offline.contains(actor)),
    _update(status, choiceRound, choosing, secretChoice, appliedRounds, standIn,
      movesThisRound, result, _offline.union(Set(actor)), ("", "")),
  }
  /// The connection comes back; a stand-in keeps playing until its person takes back their side.
  action connectionReturns(actor: str): bool = all {
    _offline.contains(actor),
    _update(status, choiceRound, choosing, secretChoice, appliedRounds, standIn,
      movesThisRound, result, _offline.exclude(Set(actor)), ("", "")),
  }

  action step = any {
    { nondet actor = PEOPLE.oneOf() nondet choice = CHOICES.oneOf() makeSecretChoice(actor, choice) },
    { nondet choice = CHOICES.oneOf() botPlays(choice) },
    { nondet side = SIDE_SET.oneOf() nondet choice = CHOICES.oneOf() standInPlays(side, choice) },
    playMove,
    reachNextRound,
    finishGame,
    { nondet actor = PEOPLE.oneOf() standInTakesSide(actor) },
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
    choosing implies (appliedRounds == choiceRound - 1 and movesThisRound == 0),
    not(choosing) implies (appliedRounds == choiceRound and SIDE_SET.forall(s => secretChoice.get(s) != "")),
  }
  /// A secret choice is final for its round.
  val invSecretChoiceFinal = (choiceRound == _previousRound) implies
    SIDE_SET.forall(s => _previousSecretChoice.get(s) == "" or secretChoice.get(s) == _previousSecretChoice.get(s))
  /// One decider per side: its person only while no stand-in plays it and they have a connection; a stand-in only for a side it plays; the bot only for its own.
  val invOneDeciderPerSide = and {
    _actedBy._2 == "person" implies (not(_previousStandIn.contains(_actedBy._1)) and not(_previousOffline.contains(PARTICIPANTS.get(_actedBy._1)))),
    _actedBy._2 == "stand-in" implies _previousStandIn.contains(_actedBy._1),
    _actedBy._2 == "bot" implies _actedBy._1 == "fourth",
  }
  /// A stand-in begins only for a person without a connection, never for the bot, and the person keeps their side.
  val invStandInOnlyWhenAway = and {
    participants == PARTICIPANTS,
    standIn.forall(s => PARTICIPANTS.get(s) != "bot"),
    standIn.forall(s => _previousStandIn.contains(s) or _previousOffline.contains(PARTICIPANTS.get(s))),
  }
  /// The result is decided once and never replaced: a finished custom game stays finished, with no more secret choices or moves.
  val invResultDecidedOnce = and {
    (status == "finished") == (result == "decided"),
    _previousStatus == "finished" implies (status == "finished" and movesThisRound == _previousMoves
      and secretChoice == _previousSecretChoice and not(choosing)),
  }
}
