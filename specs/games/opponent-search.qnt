// Two people with accounts seek an opponent for a game that offers no clock
// choice. They may stop seeking, and being paired gives them one unfinished
// matched game on opposite sides. A second attempt to seek keeps the first
// search; someone already paired must finish that matched game first.
// Each sees the other person's rating, for the game itself rather than a speed.
// An offline device keeps its last known search or matched game. It cannot
// start or stop a search. Returning shows the agreed search or matched game,
// including a pairing that happened while that person was offline.
// Play, completion and rematches belong to the matched game's own lifecycle.
module opponent_search {
  pure val PEOPLE = Set("alice", "bob")
  pure val RATINGS = Map("alice" -> "1500?", "bob" -> "1620")
  type LastKnownSearch = { seeking: bool, playNumber: int, opponentRating: str, oppositeSides: bool }

  /// Whether each person is shown their search for an opponent.
  var seeking: str -> bool
  /// The matched game each person is shown: none yet, or the one they received.
  var playNumber: str -> int
  /// Whether a person is asked to choose a clock anywhere in finding an opponent.
  var clockChoiceShown: str -> bool
  /// The other person's rating shown beside the matched game, or nothing before pairing.
  var opponentRating: str -> str
  /// Whether the two people are shown on opposite sides of the matched game.
  var oppositeSides: str -> bool
  /// The reason each person is told their latest search choice cannot happen.
  var refusal: str -> str

  var _waiting: Set[str]
  var _paired: bool
  var _offline: Set[str]
  var _lastKnown: str -> LastKnownSearch
  var _wasRefused: bool
  var _beforeWaiting: Set[str]
  var _beforePaired: bool

  pure def _other(person: str): str = if (person == "alice") "bob" else "alice"

  action _show(waiting: Set[str], paired: bool, offline: Set[str], reasons: str -> str, refused: bool): bool = all {
    seeking' = PEOPLE.mapBy(p => if (offline.contains(p)) seeking.get(p) else waiting.contains(p)),
    playNumber' = PEOPLE.mapBy(p => if (offline.contains(p)) playNumber.get(p) else if (paired) 1 else 0),
    opponentRating' = PEOPLE.mapBy(p => if (offline.contains(p)) opponentRating.get(p)
      else if (paired) RATINGS.get(_other(p)) else ""),
    oppositeSides' = PEOPLE.mapBy(p => if (offline.contains(p)) oppositeSides.get(p) else paired),
    clockChoiceShown' = PEOPLE.mapBy(_ => false),
    refusal' = reasons,
    _lastKnown' = PEOPLE.mapBy(p => if (not(_offline.contains(p)) and offline.contains(p)) {
      { seeking: seeking.get(p), playNumber: playNumber.get(p),
        opponentRating: opponentRating.get(p), oppositeSides: oppositeSides.get(p) }
    } else _lastKnown.get(p)),
    _beforeWaiting' = _waiting, _beforePaired' = _paired, _wasRefused' = refused,
    _waiting' = waiting, _paired' = paired, _offline' = offline,
  }

  action init = all {
    seeking' = PEOPLE.mapBy(_ => false), playNumber' = PEOPLE.mapBy(_ => 0),
    clockChoiceShown' = PEOPLE.mapBy(_ => false), opponentRating' = PEOPLE.mapBy(_ => ""),
    oppositeSides' = PEOPLE.mapBy(_ => false), refusal' = PEOPLE.mapBy(_ => ""),
    _waiting' = Set(), _paired' = false, _offline' = Set(),
    _lastKnown' = PEOPLE.mapBy(_ => { seeking: false, playNumber: 0, opponentRating: "", oppositeSides: false }),
    _wasRefused' = false, _beforeWaiting' = Set(), _beforePaired' = false,
  }

  /// Opening finding an opponent shows the person's existing search or matched game.
  action openFindingAnOpponent(person: str): bool = _show(_waiting, _paired, _offline, refusal, false)

  /// An account seeks an opponent, or is told why the same search or matched game stays.
  action seekOpponent(person: str): bool = {
    val reason = if (_offline.contains(person)) "connection needed"
      else if (_paired) "finish first"
      else if (_waiting.contains(person)) "already seeking" else ""
    _show(if (reason == "") _waiting.union(Set(person)) else _waiting,
      _paired, _offline, refusal.set(person, reason), reason != "")
  }

  /// Stopping a search changes no matched game; without a connection nothing is stopped.
  action stopSeeking(person: str): bool = {
    val reason = if (_offline.contains(person)) "connection needed"
      else if (not(_waiting.contains(person))) "no search" else ""
    _show(if (reason == "") _waiting.exclude(Set(person)) else _waiting,
      _paired, _offline, refusal.set(person, reason), reason != "")
  }

  /// Being paired ends both searches and gives the two people their one matched game.
  action pairPeopleUp = all {
    _waiting == PEOPLE, not(_paired), _show(Set(), true, _offline, refusal, false),
  }

  /// A lost connection keeps the person's last known search or matched game.
  action loseConnection(person: str): bool = all {
    not(_offline.contains(person)), _show(_waiting, _paired, _offline.union(Set(person)), refusal, false),
  }

  /// Returning brings the person to the agreed search or matched game.
  action connectionReturns(person: str): bool = all {
    _offline.contains(person), _show(_waiting, _paired, _offline.exclude(Set(person)), refusal, false),
  }

  action step = {
    nondet person = PEOPLE.oneOf()
    any { openFindingAnOpponent(person), seekOpponent(person), stopSeeking(person),
      pairPeopleUp, loseConnection(person), connectionReturns(person) }
  }

  /// Nobody is asked to choose a clock the game does not offer.
  val invNoClockChoice = PEOPLE.forall(p => not(clockChoiceShown.get(p)))
  /// A person has a search or the one unfinished matched game, never both.
  val invOneCurrentPlay = (_paired implies _waiting == Set()) and
    PEOPLE.forall(p => playNumber.get(p).in(0.to(1)) and
      (seeking.get(p) implies playNumber.get(p) == 0))
  /// A person with a connection sees the agreed search or matched game.
  val invConnectedView = PEOPLE.forall(p => not(_offline.contains(p)) implies and {
    seeking.get(p) == _waiting.contains(p), playNumber.get(p) == (if (_paired) 1 else 0),
  })
  /// A lost connection keeps the search or matched game, sides and opponent rating last shown.
  val invOfflineView = PEOPLE.forall(p => _offline.contains(p) implies and {
    seeking.get(p) == _lastKnown.get(p).seeking,
    playNumber.get(p) == _lastKnown.get(p).playNumber,
    oppositeSides.get(p) == _lastKnown.get(p).oppositeSides,
    opponentRating.get(p) == _lastKnown.get(p).opponentRating,
  })
  /// A paired person sees the other person's game rating and the two people on opposite sides.
  val invOpponent = PEOPLE.forall(p => not(_offline.contains(p)) implies and {
    opponentRating.get(p) == (if (_paired) RATINGS.get(_other(p)) else ""),
    oppositeSides.get(p) == _paired,
  })
  /// A refused choice keeps the agreed search or matched game and gives the person a reason.
  val invRefusal = (_wasRefused implies (_waiting == _beforeWaiting and _paired == _beforePaired)) and
    PEOPLE.forall(p => Set("", "connection needed", "finish first", "already seeking", "no search").contains(refusal.get(p)))
}
