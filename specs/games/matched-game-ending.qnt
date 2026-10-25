// Two people have been paired in a game without turns. Until play begins,
// either may abort with no result. Once it is under way either may resign,
// giving the opponent the victory. An aborted game or a victory lasts,
// however often either person tries to abort or resign it again.
// An offline person keeps the last game and choices they saw, cannot end
// the game, and sees the agreed result when their connection returns.
// Finding opponents, moves, clocks, draw offers and rematches are covered
// by the other matched-game examples; this follows only ending their play.
module matched_game_ending {
  pure val PEOPLE = Set("alice", "bob")

  /// Both people's shown result: unfinished, aborted, or the person's victory.
  var resultShown: str -> str
  /// The people offered aborting their matched game.
  var abortOffered: Set[str]
  /// The people offered resigning their matched game.
  var resignOffered: Set[str]

  var _begun: bool
  var _result: str
  var _previousResult: str
  var _offline: Set[str]
  var _lastKnown: str -> { result: str, abort: bool, resign: bool }
  var _refused: bool

  action _show(begun: bool, result: str, offline: Set[str], refused: bool): bool = all {
    resultShown' = PEOPLE.mapBy(p => if (offline.contains(p)) resultShown.get(p) else result),
    abortOffered' = PEOPLE.filter(p => if (offline.contains(p)) abortOffered.contains(p)
      else result == "unfinished" and not(begun)),
    resignOffered' = PEOPLE.filter(p => if (offline.contains(p)) resignOffered.contains(p)
      else result == "unfinished" and begun),
    _lastKnown' = PEOPLE.mapBy(p => if (not(_offline.contains(p)) and offline.contains(p)) {
      { result: resultShown.get(p), abort: abortOffered.contains(p), resign: resignOffered.contains(p) }
    } else _lastKnown.get(p)),
    _begun' = begun, _result' = result, _previousResult' = _result,
    _offline' = offline, _refused' = refused,
  }

  action init = all {
    resultShown' = PEOPLE.mapBy(_ => "unfinished"),
    abortOffered' = PEOPLE, resignOffered' = Set(),
    _begun' = false, _result' = "unfinished", _previousResult' = "unfinished",
    _offline' = Set(), _refused' = false,
    _lastKnown' = PEOPLE.mapBy(_ => { result: "unfinished", abort: true, resign: false }),
  }

  /// The game's own beginning of play makes resignation available in place of aborting.
  action playBegins = all {
    not(_begun), _result == "unfinished", _offline == Set(),
    _show(true, _result, _offline, false),
  }

  /// Either person can abort before play begins; an unfinished game under way or an over game keeps its result.
  action abortGame(person: str): bool = {
    val allowed = not(_offline.contains(person)) and not(_begun) and _result == "unfinished"
    _show(_begun, if (allowed) "aborted" else _result, _offline, not(allowed))
  }

  /// Either person can give the opponent the victory once play begins; other attempts keep the game.
  action resignGame(person: str): bool = {
    val allowed = not(_offline.contains(person)) and _begun and _result == "unfinished"
    _show(_begun, if (allowed) (if (person == "alice") "bob won" else "alice won")
      else _result, _offline, not(allowed))
  }

  /// Losing a connection preserves that person's last known game and ending choices.
  action loseConnection(person: str): bool = all {
    not(_offline.contains(person)),
    _show(_begun, _result, _offline.union(Set(person)), false),
  }

  /// Returning shows the agreed result, even if the opponent ended play while this person was offline.
  action connectionReturns(person: str): bool = all {
    _offline.contains(person),
    _show(_begun, _result, _offline.exclude(Set(person)), false),
  }

  action step = {
    nondet person = PEOPLE.oneOf()
    any { playBegins, abortGame(person), resignGame(person), loseConnection(person), connectionReturns(person) }
  }

  /// Both people see the same unfinished game, aborted game or winner.
  val invSharedResult = PEOPLE.forall(p => not(_offline.contains(p)) implies resultShown.get(p) == _result)
    and Set("unfinished", "aborted", "alice won", "bob won").contains(_result)
  /// A person can abort exactly while the unfinished game has not begun.
  val invAbortBoundary = PEOPLE.forall(p => not(_offline.contains(p)) implies
    abortOffered.contains(p) == (_result == "unfinished" and not(_begun)))
  /// A person can resign exactly while their unfinished game is under way.
  val invResignBoundary = PEOPLE.forall(p => not(_offline.contains(p)) implies
    resignOffered.contains(p) == (_result == "unfinished" and _begun))
  /// Once a result is reached, nothing afterwards changes it.
  val invLastingResult = _previousResult != "unfinished" implies _result == _previousResult
  /// An offline person keeps the result and choices last shown before losing their connection.
  val invOfflineView = PEOPLE.forall(p => _offline.contains(p) implies and {
    resultShown.get(p) == _lastKnown.get(p).result,
    abortOffered.contains(p) == _lastKnown.get(p).abort,
    resignOffered.contains(p) == _lastKnown.get(p).resign,
  })
  /// A refused ending choice never changes the agreed result.
  val invRefusal = _refused implies _result == _previousResult
}
