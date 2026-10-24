// @model-profile: local
// Alice shares her device with Bob, or plays a bot on it. Her local game
// stays available at every stage without a connection. Carol can join the
// space to watch but cannot guide a paddle. A missing connection keeps the
// court last shown to Carol while Alice can keep playing. Returning shows
// the current court. Scoring belongs to Pong's scoring model.
module pong_local_play {
  pure val _PEOPLE = Set("alice", "carol")
  pure val _PADDLES = Set("left", "right")
  pure val _PLACES = Set("middle", "upper edge", "lower edge")
  var localOpponent: str
  var localStage: str
  var gameShown: str -> bool
  var controlledPaddles: str -> Set[str]
  var paddlePlace: str -> (str -> str)
  var _online: bool
  var _viewer: { online: bool, joined: bool }
  var _positions: str -> str
  var _lastCourt: str -> str
  var _beforePositions: str -> str
  var _refused: bool

  pure def _paddles(phase: str, opponent: str): Set[str] =
    if (phase == "playing") (if (opponent == "person") _PADDLES else Set("left")) else Set()

  action _show(phase: str, online: bool, viewer: { online: bool, joined: bool }, positions: str -> str): bool = all {
    localOpponent' = localOpponent, localStage' = phase,
    gameShown' = Map("alice" -> true, "carol" -> viewer.joined),
    controlledPaddles' = Map("alice" -> _paddles(phase, localOpponent), "carol" -> Set()),
    paddlePlace' = Map("alice" -> positions, "carol" ->
      (if (viewer.joined and viewer.online and online) positions else paddlePlace.get("carol"))),
    _lastCourt' = if (_viewer.joined and _viewer.online and _online and not(viewer.online and online))
      paddlePlace.get("carol") else _lastCourt,
    _positions' = positions, _beforePositions' = _positions,
    _online' = online, _viewer' = viewer,
  }

  action _keep(phase: str, online: bool): bool = all {
    _show(phase, online, _viewer, _positions), _refused' = false,
  }

  action init = {
    nondet opponent = Set("person", "bot").oneOf()
    val middle = _PADDLES.mapBy(_ => "middle")
    all {
      localOpponent' = opponent, localStage' = "ready",
      gameShown' = Map("alice" -> true, "carol" -> false),
      controlledPaddles' = _PEOPLE.mapBy(_ => Set()),
      paddlePlace' = _PEOPLE.mapBy(_ => middle),
      _online' = true, _viewer' = { online: true, joined: false },
      _positions' = middle, _lastCourt' = middle, _beforePositions' = middle,
      _refused' = false,
    }
  }

  /// Alice starts the local Pong game for which she is ready.
  action startLocalPong = all { localStage == "ready", _keep("playing", _online) }

  /// Carol joins Alice's space to see the local court, without a paddle.
  action joinSpace = all {
    _online, _viewer.online, not(_viewer.joined),
    _show(localStage, _online, { ..._viewer, joined: true }, _positions), _refused' = false,
  }

  /// Alice guides a paddle she controls; Carol cannot guide either paddle.
  action guidePaddle(person: str, paddle: str, place: str): bool = {
    val allowed = person == "alice" and _paddles(localStage, localOpponent).contains(paddle)
    all {
      person == "alice" or _viewer.joined,
      _show(localStage, _online, _viewer, if (allowed) _positions.set(paddle, place) else _positions),
      _refused' = not(allowed),
    }
  }

  /// Alice's device loses its connection to other people.
  action loseConnection = all { _online, _keep(localStage, false) }

  /// Alice's device can reach other people again, sharing its current local court.
  action connectionReturns = all { not(_online), _keep(localStage, true) }

  /// Carol loses her connection and keeps the court last shown to her.
  action viewerLosesConnection = all {
    _viewer.online,
    _show(localStage, _online, { ..._viewer, online: false }, _positions), _refused' = false,
  }

  /// Carol returns to the current court once Alice also has a connection.
  action viewerConnectionReturns = all {
    not(_viewer.online),
    _show(localStage, _online, { ..._viewer, online: true }, _positions), _refused' = false,
  }

  /// A victory finishes the local game, whether or not the device has a connection.
  action finishLocalPong = all { localStage == "playing", _keep("finished", _online) }

  /// Opening the app again keeps the local game and its stage.
  action reopenApp = _keep(localStage, _online)

  action step = {
    nondet person = _PEOPLE.oneOf()
    nondet paddle = _PADDLES.oneOf()
    nondet place = _PLACES.oneOf()
    any {
      startLocalPong, joinSpace, guidePaddle(person, paddle, place),
      loseConnection, connectionReturns, viewerLosesConnection, viewerConnectionReturns,
      finishLocalPong, reopenApp,
    }
  }

  /// Local Pong remains available without needing a connection.
  val invLocalAvailability = gameShown.get("alice")
  /// Two people share both paddles; against a bot, Alice guides only her own.
  val invLocalPaddles = controlledPaddles.get("alice") == _paddles(localStage, localOpponent)
  /// A finished local game has no paddle Alice can keep guiding.
  val invFinishedPaddles = localStage == "finished" implies controlledPaddles.get("alice") == Set()
  /// Carol never gains control of either paddle by watching local play.
  val invViewerPaddles = controlledPaddles.get("carol") == Set()
  /// Connected Carol sees the current local court whenever Alice also has a connection.
  val invSharedCourt = _viewer.joined and _viewer.online and _online implies paddlePlace.get("carol") == _positions
  /// A missing connection keeps the court last shown to Carol.
  val invOfflineCourt = _viewer.joined and not(_viewer.online and _online) implies paddlePlace.get("carol") == _lastCourt
  /// Refused paddle guidance changes neither paddle.
  val invRefusedControl = _refused implies _positions == _beforePositions
}
