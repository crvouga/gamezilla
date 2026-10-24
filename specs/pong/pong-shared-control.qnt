// Alice has the left paddle and Bob the right paddle on separate devices.
// Carol is in Alice's space and can see Pong, but has no paddle. Each person
// guides only their own paddle between the middle and either edge of the
// court. Losing a player's connection suspends guidance for both players;
// Carol's connection does not decide who may guide a paddle. An offline
// device keeps the court it last showed. Returning restores the agreed
// court and only that person's own paddle. Scoring and victory belong to
// Pong's scoring rules, rather than the guidance followed here.
module pong_shared_control {
  pure val PEOPLE = Set("alice", "bob", "carol")
  pure val PADDLES = Set("left", "right")
  pure val PLACES = Set("middle", "upper edge", "lower edge")
  pure val ASSIGNED = Map("alice" -> Set("left"), "bob" -> Set("right"), "carol" -> Set())

  type PaddlePlace = str -> str
  /// Where each person sees each paddle in the court.
  var paddlePlace: str -> PaddlePlace
  /// The paddles each person can guide on their device.
  var controlledPaddles: str -> Set[str]
  /// Pong stays visible on each person's device, including without a connection.
  var gameShown: str -> bool

  var _positions: PaddlePlace
  var _offline: Set[str]
  var _lastCourt: str -> PaddlePlace
  var _beforePositions: PaddlePlace
  var _refused: bool

  pure def _canGuide(person: str, offline: Set[str]): bool =
    not(offline.contains(person)) and not(offline.contains("alice")) and not(offline.contains("bob"))

  action _show(positions: PaddlePlace, offline: Set[str], refused: bool): bool = all {
    paddlePlace' = PEOPLE.mapBy(p => if (offline.contains(p)) paddlePlace.get(p) else positions),
    controlledPaddles' = PEOPLE.mapBy(p => if (_canGuide(p, offline)) ASSIGNED.get(p) else Set()),
    gameShown' = PEOPLE.mapBy(_ => true),
    _lastCourt' = PEOPLE.mapBy(p => if (not(_offline.contains(p)) and offline.contains(p)) paddlePlace.get(p) else _lastCourt.get(p)),
    _beforePositions' = _positions, _refused' = refused,
    _positions' = positions, _offline' = offline,
  }

  action init = all {
    paddlePlace' = PEOPLE.mapBy(_ => PADDLES.mapBy(_ => "middle")),
    controlledPaddles' = ASSIGNED, gameShown' = PEOPLE.mapBy(_ => true),
    _positions' = PADDLES.mapBy(_ => "middle"), _offline' = Set(),
    _lastCourt' = PEOPLE.mapBy(_ => PADDLES.mapBy(_ => "middle")),
    _beforePositions' = PADDLES.mapBy(_ => "middle"), _refused' = false,
  }

  /// A person guides their own paddle; someone else's paddle and missing connections refuse guidance.
  action guidePaddle(person: str, paddle: str, place: str): bool = {
    val allowed = _canGuide(person, _offline) and ASSIGNED.get(person).contains(paddle)
    _show(if (allowed) _positions.set(paddle, place) else _positions, _offline, not(allowed))
  }

  /// A lost player connection suspends guidance; a person with no paddle can leave the players connected.
  action loseConnection(person: str): bool = all {
    not(_offline.contains(person)), _show(_positions, _offline.union(Set(person)), false),
  }

  /// Returning restores the agreed court and the person's own paddle.
  action connectionReturns(person: str): bool = all {
    _offline.contains(person), _show(_positions, _offline.exclude(Set(person)), false),
  }

  action step = {
    nondet person = PEOPLE.oneOf()
    nondet paddle = PADDLES.oneOf()
    nondet place = PLACES.oneOf()
    any { guidePaddle(person, paddle, place), loseConnection(person), connectionReturns(person) }
  }

  /// A paddle stays at a place within the court.
  val invCourt = PEOPLE.forall(p => PADDLES.forall(side => PLACES.contains(paddlePlace.get(p).get(side))))
  /// Connected people see the agreed court.
  val invSharedCourt = PEOPLE.forall(p => not(_offline.contains(p)) implies paddlePlace.get(p) == _positions)
  /// An offline person keeps the court last shown before losing the connection.
  val invOfflineCourt = PEOPLE.forall(p => _offline.contains(p) implies paddlePlace.get(p) == _lastCourt.get(p))
  /// Each person guides only their own paddle, and only while both players have a connection.
  val invOwnControls = PEOPLE.forall(p => controlledPaddles.get(p) == (if (_canGuide(p, _offline)) ASSIGNED.get(p) else Set()))
  /// Refused guidance moves neither paddle.
  val invRefusedControl = _refused implies _positions == _beforePositions
  /// A connection change does not hide the Pong court a person can see.
  val invGameShown = PEOPLE.forall(p => gameShown.get(p))
}
