// A custom game under way of a game with secret choices and four sides:
// Alice hosts the space, created the custom game and plays the first side;
// Bob plays the second, Carol the third and a bot the fourth. Eve is in the
// space and watches.
// The game's own rules say when play reaches a round of secret choices and
// who moves next; this model follows only what every such game shares. The
// custom game starts awaiting its first round of secret choices. Each side
// makes one secret choice in the round. The bot, and any stand-in, makes its
// side's own by itself as soon as the round opens; each person makes theirs
// when they choose. Everyone sees which sides have made theirs, and each
// person sees only their own side's secret choice, never another side's; a
// watcher sees none. A secret choice is final for its round. A second one,
// one from someone without a side, one while the custom game is not awaiting
// secret choices and one for a side a stand-in plays are refused and change
// nothing. No move is made while a round is awaited, and nothing the round
// decides happens until the last side has made its secret choice; then they
// all take effect at once as the game's own move, play goes on, and nobody,
// not even their own person, sees that round's secret choices any more.
// Play then makes moves, each by whoever the game's rules say moves next,
// until it reaches the next round of secret choices or the game's rules
// finish the custom game, however many rounds and moves that takes. The
// result is decided once, as the game's own rules decide it, and is never
// replaced; a finished custom game takes no more secret choices or moves,
// and finishing ends every stand-in: a stand-in plays only while the custom
// game is under way.
// A person whose device has no connection is away. Their device keeps
// showing what it last showed, and they cannot make a secret choice or take
// back their side. While the host has a connection, a participant other than
// the host who is away for 60 seconds gets a stand-in for their side, shown
// to everyone, playing by the same rules with only what that side may know;
// it decides that side's pending secret choice at once. The person keeps
// their side; their own secret choices are refused while the stand-in plays
// it, and coming back alone does not end it: back online, they take back
// their side, and from then on the stand-in decides nothing for it.
// While the host has no connection the space waits: nobody's time away
// counts, no stand-in comes for anyone, and no secret choice, move or taking
// back happens until she is back. Play goes on only while every side has
// someone to play it: its person with a connection, the bot, or a stand-in.
module secret_choices {
  pure val PEOPLE = Set("alice", "bob", "carol", "eve")
  pure val SIDE_SET = Set("first", "second", "third", "fourth")
  pure val PARTICIPANTS = Map("first" -> "alice", "second" -> "bob", "third" -> "carol", "fourth" -> "bot")
  pure val HOST = "alice"
  /// Two different secret choices a side can make in any such game.
  pure val CHOICES = Set("one choice", "another choice")
  /// Bounds for checking: the rounds of secret choices and the moves between them.
  pure val MAX_ROUNDS = 3
  pure val MAX_MOVES = 2

  /// Who plays each side; a stand-in never changes it.
  var participants: str -> str
  /// "under way" or "finished".
  var status: str
  /// Whether the custom game is awaiting secret choices.
  var choosing: bool
  /// Which sides each person sees as having made their secret choice.
  var chosenShown: str -> Set[str]
  /// Whose secret choice each person sees: only their own side's, and only while the round is awaited.
  var secretChoiceShown: str -> Set[str]
  /// The sides a stand-in plays.
  var standIn: Set[str]
  /// "" until the game's rules finish the custom game, then "decided".
  var result: str
  var _offline: Set[str]
  /// Bookkeeping: each side's secret choice in the latest round, or "" while it has made none; nobody sees it once the round takes effect.
  var _secretChoice: str -> str
  /// Bookkeeping: rounds reached, rounds taken effect and moves since the latest one took effect.
  var _choiceRound: int
  var _appliedRounds: int
  var _movesThisRound: int
  /// Bookkeeping: the sides that made a secret choice in the last step and who decided each: "person", "stand-in" or "bot".
  var _actedBy: Set[(str, str)]
  var _previousRound: int
  var _previousSecretChoice: str -> str
  var _previousStandIn: Set[str]
  var _previousOffline: Set[str]
  var _previousChosenShown: str -> Set[str]
  var _previousStatus: str
  var _previousMoves: int

  pure def _ownSides(viewer: str): Set[str] = SIDE_SET.filter(s => PARTICIPANTS.get(s) == viewer)
  pure def _sideOf(actor: str): str = if (actor == "alice") "first" else if (actor == "bob") "second" else if (actor == "carol") "third" else ""
  def _hostHere = not(_offline.contains(HOST))
  /// Every side has someone to play it, and the host is here.
  def _playable = _hostHere and SIDE_SET.forall(s =>
    PARTICIPANTS.get(s) == "bot" or standIn.contains(s) or not(_offline.contains(PARTICIPANTS.get(s))))

  action _update(
    newStatus: str, awaiting: bool, choices: str -> str, newRound: int, applied: int, standIns: Set[str],
    moves: int, outcome: str, offline: Set[str], acted: Set[(str, str)],
  ): bool = all {
    participants' = participants,
    status' = newStatus, choosing' = awaiting, _secretChoice' = choices,
    chosenShown' = PEOPLE.mapBy(v =>
      if (offline.contains(v)) chosenShown.get(v)
      else if (awaiting and newStatus == "under way") SIDE_SET.filter(s => choices.get(s) != "")
      else Set()),
    secretChoiceShown' = PEOPLE.mapBy(v =>
      if (offline.contains(v)) secretChoiceShown.get(v)
      else if (awaiting and newStatus == "under way") _ownSides(v).filter(s => choices.get(s) != "")
      else Set()),
    standIn' = standIns, result' = outcome,
    _choiceRound' = newRound, _appliedRounds' = applied, _movesThisRound' = moves,
    _offline' = offline, _actedBy' = acted,
    _previousRound' = _choiceRound, _previousSecretChoice' = _secretChoice, _previousStandIn' = standIn,
    _previousOffline' = _offline, _previousChosenShown' = chosenShown,
    _previousStatus' = status, _previousMoves' = _movesThisRound,
  }
  action _hold = _update(status, choosing, _secretChoice, _choiceRound, _appliedRounds, standIn,
    _movesThisRound, result, _offline, Set())

  /// Secret choices for some sides of the current round; once every side has one they all take effect at once.
  action _choose(newRound: int, previous: str -> str, deciders: Set[(str, str)], choice: str, standIns: Set[str]): bool = {
    val choices = SIDE_SET.mapBy(s => if (deciders.exists(d => d._1 == s)) choice else previous.get(s))
    val complete = SIDE_SET.forall(s => choices.get(s) != "")
    _update(status, not(complete), choices, newRound, if (complete) newRound else _appliedRounds, standIns,
      0, result, _offline, deciders)
  }
  /// The sides that decide by themselves when a round opens: the bot and every side a stand-in plays.
  def _selfDeciders(standIns: Set[str]): Set[(str, str)] =
    Set(("fourth", "bot")).union(standIns.map(s => (s, "stand-in")))

  action init = {
    nondet choice = CHOICES.oneOf()
    all {
      participants' = PARTICIPANTS,
      status' = "under way", choosing' = true,
      chosenShown' = PEOPLE.mapBy(_ => Set("fourth")),
      secretChoiceShown' = PEOPLE.mapBy(_ => Set()),
      standIn' = Set(), result' = "",
      _offline' = Set(),
      _secretChoice' = SIDE_SET.mapBy(s => if (s == "fourth") choice else ""),
      _choiceRound' = 1, _appliedRounds' = 0, _movesThisRound' = 0,
      _actedBy' = Set(("fourth", "bot")),
      _previousRound' = 1, _previousSecretChoice' = SIDE_SET.mapBy(_ => ""), _previousStandIn' = Set(),
      _previousOffline' = Set(), _previousChosenShown' = PEOPLE.mapBy(_ => Set()),
      _previousStatus' = "under way", _previousMoves' = 0,
    }
  }

  /// A person makes their side's secret choice; refused when already made, not theirs, not awaited, offline, while the host is away or while a stand-in plays their side.
  action makeSecretChoice(actor: str, choice: str): bool = {
    val side = _sideOf(actor)
    if (status == "under way" and choosing and side != "" and _secretChoice.get(side) == ""
        and not(standIn.contains(side)) and not(_offline.contains(actor)) and _hostHere)
      _choose(_choiceRound, _secretChoice, Set((side, "person")), choice, standIn)
    else _hold
  }
  /// One move by whoever the game's rules say moves next; refused while secret choices are awaited.
  action playMove: bool =
    if (status == "under way" and not(choosing) and _playable and _movesThisRound < MAX_MOVES)
      _update(status, choosing, _secretChoice, _choiceRound, _appliedRounds, standIn,
        _movesThisRound + 1, result, _offline, Set())
    else _hold
  /// Play goes on, as the game's rules say, until it reaches the next round of secret choices; the bot and every stand-in make theirs at once.
  action reachNextRound(choice: str): bool = all {
    status == "under way", not(choosing), _playable, _choiceRound < MAX_ROUNDS,
    _choose(_choiceRound + 1, SIDE_SET.mapBy(_ => ""), _selfDeciders(standIn), choice, standIn),
  }
  /// Play goes on until the game's own rules finish the custom game, with the result they decide; every stand-in ends.
  action finishGame: bool = all {
    status == "under way", not(choosing), _playable,
    _update("finished", false, _secretChoice, _choiceRound, _appliedRounds, Set(),
      _movesThisRound, "decided", _offline, Set()),
  }
  /// While the host is here, a stand-in takes the side of a participant other than the host who has been away for 60 seconds, and makes its pending secret choice at once.
  action standInTakesSide(actor: str, choice: str): bool = {
    val side = _sideOf(actor)
    val standIns = standIn.union(Set(side))
    all {
      status == "under way", side != "", actor != HOST, _hostHere,
      _offline.contains(actor), not(standIn.contains(side)),
      if (choosing and _secretChoice.get(side) == "")
        _choose(_choiceRound, _secretChoice, Set((side, "stand-in")), choice, standIns)
      else
        _update(status, choosing, _secretChoice, _choiceRound, _appliedRounds, standIns,
          _movesThisRound, result, _offline, Set()),
    }
  }
  /// A participant back online takes back their side; anyone else, or with no stand-in on their side, is refused.
  action takeBackSide(actor: str): bool = {
    val side = _sideOf(actor)
    if (status == "under way" and side != "" and standIn.contains(side) and not(_offline.contains(actor)) and _hostHere)
      _update(status, choosing, _secretChoice, _choiceRound, _appliedRounds, standIn.exclude(Set(side)),
        _movesThisRound, result, _offline, Set())
    else _hold
  }
  /// A person's device loses its connection and keeps what it last showed.
  action loseConnection(actor: str): bool = all {
    not(_offline.contains(actor)),
    _update(status, choosing, _secretChoice, _choiceRound, _appliedRounds, standIn,
      _movesThisRound, result, _offline.union(Set(actor)), Set()),
  }
  /// The connection comes back; a stand-in keeps playing until its person takes back their side.
  action connectionReturns(actor: str): bool = all {
    _offline.contains(actor),
    _update(status, choosing, _secretChoice, _choiceRound, _appliedRounds, standIn,
      _movesThisRound, result, _offline.exclude(Set(actor)), Set()),
  }

  action step = any {
    { nondet actor = PEOPLE.oneOf() nondet choice = CHOICES.oneOf() makeSecretChoice(actor, choice) },
    playMove,
    { nondet choice = CHOICES.oneOf() reachNextRound(choice) },
    finishGame,
    { nondet actor = PEOPLE.oneOf() nondet choice = CHOICES.oneOf() standInTakesSide(actor, choice) },
    { nondet actor = PEOPLE.oneOf() takeBackSide(actor) },
    { nondet actor = PEOPLE.oneOf() loseConnection(actor) },
    { nondet actor = PEOPLE.oneOf() connectionReturns(actor) },
  }

  /// Each person sees only their own side's secret choice; a watcher sees none.
  val invOwnSecretChoiceOnly = PEOPLE.forall(v => secretChoiceShown.get(v).subseteq(_ownSides(v)))
  /// Once a round takes effect, nobody with a connection sees its secret choices any more, not even their own person.
  val invChoicesForgottenOnceTakenEffect = PEOPLE.forall(v =>
    (not(_offline.contains(v)) and not(choosing)) implies secretChoiceShown.get(v) == Set())
  /// Everyone with a connection sees exactly which sides have made their secret choice while the custom game awaits them.
  val invChosenShown = PEOPLE.forall(v => not(_offline.contains(v)) implies
    chosenShown.get(v) == (if (choosing and status == "under way") SIDE_SET.filter(s => _secretChoice.get(s) != "") else Set()))
  /// A device without a connection keeps showing which sides it last saw chosen.
  val invOfflineShowsLastSeen = PEOPLE.forall(v =>
    (_offline.contains(v) and _previousOffline.contains(v)) implies chosenShown.get(v) == _previousChosenShown.get(v))
  /// A round's secret choices take effect only once every side has made one, and no move is made while they are awaited.
  val invChoicesTakeEffectTogether = and {
    choosing implies (_appliedRounds == _choiceRound - 1 and _movesThisRound == 0),
    not(choosing) implies (_appliedRounds == _choiceRound and SIDE_SET.forall(s => _secretChoice.get(s) != "")),
  }
  /// A secret choice is final for its round.
  val invSecretChoiceFinal = (_choiceRound == _previousRound) implies
    SIDE_SET.forall(s => _previousSecretChoice.get(s) == "" or _secretChoice.get(s) == _previousSecretChoice.get(s))
  /// One decider per side: its person only while no stand-in plays it, with a connection and the host here; a stand-in only for a side it plays; the bot only for its own.
  val invOneDeciderPerSide = _actedBy.forall(d => and {
    d._2 == "person" implies (not(_previousStandIn.contains(d._1)) and not(_previousOffline.contains(PARTICIPANTS.get(d._1)))
      and not(_previousOffline.contains(HOST))),
    d._2 == "stand-in" implies standIn.contains(d._1),
    d._2 == "bot" implies d._1 == "fourth",
  })
  /// A stand-in begins only for a participant other than the host who is away while the host is here, never for the bot, and the person keeps their side.
  val invStandInOnlyWhenAway = and {
    participants == PARTICIPANTS,
    standIn.forall(s => PARTICIPANTS.get(s) != "bot" and PARTICIPANTS.get(s) != HOST),
    standIn.forall(s => _previousStandIn.contains(s)
      or (_previousOffline.contains(PARTICIPANTS.get(s)) and not(_previousOffline.contains(HOST)))),
  }
  /// The result is decided once and never replaced: a finished custom game stays finished, with no stand-in and no more secret choices or moves.
  val invResultDecidedOnce = and {
    (status == "finished") == (result == "decided"),
    status == "finished" implies standIn == Set(),
    _previousStatus == "finished" implies (status == "finished" and _movesThisRound == _previousMoves
      and _secretChoice == _previousSecretChoice and not(choosing)),
  }
}
