// Alice is the first player and Bob the second. Each places a fleet of five
// ships on their own board of 100 cells, columns A to J and rows 1 to 10. A
// ship lies horizontally or vertically, entirely inside the board and never on
// another of its player's ships; ships may touch. Each player sees their whole
// fleet and every shot at it on their own board, and on their targeting board
// only what their own shots found: each cell they shot at, as a hit or a miss,
// and the ships they sank.
// Once both players are ready with a complete fleet, Alice starts the game.
// The first player shoots first,
// and the turn passes after every hit and every miss. A shot at a cell with a ship is a hit, anywhere else a miss; the hit on
// a ship's last cell sinks it and names it. The 17th hit sinks the fifth ship
// and wins at once, and the game is over. A refused placing, rotation,
// readiness, start or shot changes nothing and keeps the turn.
// A game can be followed from its setup, from its start, or from one hit
// before the first player's victory.
// A player whose device has no connection keeps seeing their last boards and
// cannot become ready, start or shoot; a refused shot does not happen later.
// Alice hosts the space the game is played in: while she has no connection,
// Bob cannot become ready or shoot either.
// Once the connection returns, they see every shot made meanwhile.
module battleship_play {
  pure val PLAYERS = Set(1, 2)
  pure val SHIPS = Set("carrier", "battleship", "cruiser", "submarine", "destroyer")
  /// The board's cells: A1 to J1 are 0 to 9, A2 to J2 are 10 to 19, and so on to J10, 99.
  pure val CELLS = 0.to(99)
  pure val FLEET_CELLS = 17
  pure val UNPLACED = (-1, true)
  /// Two complete fleets a random fleet may be here: every ship horizontal, or every ship vertical.
  pure val HORIZONTAL_FLEET = Map("carrier" -> (0, true), "battleship" -> (20, true), "cruiser" -> (40, true), "submarine" -> (60, true), "destroyer" -> (80, true))
  pure val VERTICAL_FLEET = Map("carrier" -> (9, false), "battleship" -> (7, false), "cruiser" -> (5, false), "submarine" -> (3, false), "destroyer" -> (1, false))
  pure val RANDOM_FLEETS = Set(HORIZONTAL_FLEET, VERTICAL_FLEET)
  /// One hit from victory: the first player has hit every cell of the second player's
  /// fleet but B2, the destroyer's last, and the second player has missed 16 times.
  pure val LATE_FIRST_SHOTS = Set(9, 19, 29, 39, 49, 7, 17, 27, 37, 5, 15, 25, 3, 13, 23, 1)
  pure val LATE_SECOND_SHOTS = 10.to(15).union(90.to(99))

  /// Each player's ships: the first cell and whether the ship is horizontal; -1 when not placed.
  var fleet: int -> (str -> (int, bool))
  /// Which players are ready with their fleet.
  var ready: int -> bool
  /// The part of the game: "setup", "shooting" or "over".
  var phase: str
  /// The player who may make the next shot.
  var turn: int
  /// The cells each player has shot at on the other player's board.
  var shots: int -> Set[int]
  /// How many of each player's shots hit.
  var hits: int -> int
  /// The other player's ships each player has sunk.
  var sunk: int -> Set[str]
  /// The player who won, or 0 while nobody has.
  var winner: int
  /// Whether each player's device has a connection.
  var online: int -> bool
  /// What each player's targeting board shows: each cell they shot at, and whether it hit.
  var targetingBoard: int -> Set[(int, bool)]
  /// What each player's own board shows of the other player's shots: each cell, and whether it hit.
  var ownBoard: int -> Set[(int, bool)]
  var _savedTargetingBoard: int -> Set[(int, bool)]
  var _savedOwnBoard: int -> Set[(int, bool)]
  var _refused: bool
  var _before: (int -> (str -> (int, bool)), int -> bool, int -> Set[int], int, int, str)
  var _endShots: int -> Set[int]

  pure def _other(p: int): int = 3 - p
  pure def _length(ship: str): int =
    if (ship == "carrier") 5 else if (ship == "battleship") 4 else if (ship == "destroyer") 2 else 3
  /// The cells a ship covers from its first cell; none when it would run off the board.
  pure def _cover(ship: str, first: int, horizontal: bool): Set[int] =
    if (first < 0 or first > 99) Set()
    else if (horizontal and first % 10 + _length(ship) <= 10) 0.to(4).filter(i => i < _length(ship)).map(i => first + i)
    else if (not(horizontal) and first / 10 + _length(ship) <= 10) 0.to(4).filter(i => i < _length(ship)).map(i => first + 10 * i)
    else Set()
  pure def _cells(placement: (int, bool), ship: str): Set[int] = _cover(ship, placement._1, placement._2)
  pure def _occupied(ships: str -> (int, bool)): Set[int] = SHIPS.map(s => _cells(ships.get(s), s)).flatten()
  pure def _complete(ships: str -> (int, bool)): bool =
    SHIPS.forall(s => _cells(ships.get(s), s).size() == _length(s)) and _occupied(ships).size() == FLEET_CELLS
  /// A ship fits where it stays on the board and covers no cell of its player's other ships.
  pure def _fits(ships: str -> (int, bool), ship: str, first: int, horizontal: bool): bool =
    _cover(ship, first, horizontal).size() > 0 and
    SHIPS.exclude(Set(ship)).forall(s => _cells(ships.get(s), s).intersect(_cover(ship, first, horizontal)) == Set())
  pure def _legal(ships: str -> (int, bool)): bool =
    SHIPS.forall(s => ships.get(s)._1 < 0 or _cells(ships.get(s), s).size() == _length(s)) and
    SHIPS.forall(a => SHIPS.forall(b => a == b or _cells(ships.get(a), a).intersect(_cells(ships.get(b), b)) == Set()))
  pure def _sunkShips(ships: str -> (int, bool), shotAt: Set[int]): Set[str] =
    SHIPS.filter(s => _cells(ships.get(s), s).size() > 0 and _cells(ships.get(s), s).subseteq(shotAt))
  /// Player p's shots at the board of player `at`, each marked whether it found a ship.
  pure def _marks(p: int, at: int, shotsNow: int -> Set[int], fleets: int -> (str -> (int, bool))): Set[(int, bool)] =
    shotsNow.get(p).map(c => (c, _occupied(fleets.get(at)).contains(c)))
  pure def _allowed(stage: str, mover: int, shotsNow: int -> Set[int], p: int, cell: int): bool =
    stage == "shooting" and mover == p and CELLS.contains(cell) and not(shotsNow.get(p).contains(cell))

  action _update(
    f: int -> (str -> (int, bool)), r: int -> bool, stage: str, mover: int, s: int -> Set[int],
    h: int -> int, sk: int -> Set[str], w: int, o: int -> bool, refused: bool,
  ): bool = all {
    fleet' = f, ready' = r, phase' = stage, turn' = mover, shots' = s,
    hits' = h, sunk' = sk, winner' = w, online' = o,
    targetingBoard' = PLAYERS.mapBy(p => if (o.get(p)) _marks(p, _other(p), s, f) else targetingBoard.get(p)),
    ownBoard' = PLAYERS.mapBy(p => if (o.get(p)) _marks(_other(p), p, s, f) else ownBoard.get(p)),
    _savedTargetingBoard' = PLAYERS.mapBy(p => if (online.get(p) and not(o.get(p))) targetingBoard.get(p) else _savedTargetingBoard.get(p)),
    _savedOwnBoard' = PLAYERS.mapBy(p => if (online.get(p) and not(o.get(p))) ownBoard.get(p) else _savedOwnBoard.get(p)),
    _refused' = refused,
    _before' = (fleet, ready, shots, turn, winner, phase),
    _endShots' = if (w != 0 and winner == 0) s else _endShots,
  }
  action _hold = _update(fleet, ready, phase, turn, shots, hits, sunk, winner, online, true)

  action init = {
    nondet beginning = Set("new", "started", "one hit from victory").oneOf()
    val f = if (beginning == "new") PLAYERS.mapBy(_ => SHIPS.mapBy(_ => UNPLACED)) else Map(1 -> HORIZONTAL_FLEET, 2 -> VERTICAL_FLEET)
    val r = PLAYERS.mapBy(_ => beginning != "new")
    val s = if (beginning == "one hit from victory") Map(1 -> LATE_FIRST_SHOTS, 2 -> LATE_SECOND_SHOTS) else PLAYERS.mapBy(_ => Set())
    val stage = if (beginning == "new") "setup" else "shooting"
    all {
      fleet' = f,
      ready' = r,
      phase' = stage,
      turn' = 1,
      shots' = s,
      hits' = PLAYERS.mapBy(p => s.get(p).intersect(_occupied(f.get(_other(p)))).size()),
      sunk' = PLAYERS.mapBy(p => _sunkShips(f.get(_other(p)), s.get(p))),
      winner' = 0,
      online' = PLAYERS.mapBy(_ => true),
      targetingBoard' = PLAYERS.mapBy(p => _marks(p, _other(p), s, f)),
      ownBoard' = PLAYERS.mapBy(p => _marks(_other(p), p, s, f)),
      _savedTargetingBoard' = PLAYERS.mapBy(_ => Set()),
      _savedOwnBoard' = PLAYERS.mapBy(_ => Set()),
      _refused' = false,
      _before' = (f, r, s, 1, 0, stage),
      _endShots' = PLAYERS.mapBy(_ => Set()),
    }
  }
  /// Place a ship from a cell, horizontally or vertically, or keep every ship where it was if it cannot go there.
  action placeShip(p: int, ship: str, first: int, horizontal: bool): bool =
    if (phase == "setup" and not(ready.get(p)) and _fits(fleet.get(p), ship, first, horizontal))
      _update(fleet.set(p, fleet.get(p).set(ship, (first, horizontal))), ready, phase, turn, shots, hits, sunk, winner, online, false)
    else _hold
  /// Turn a placed ship between horizontal and vertical from its first cell, or keep it where it was.
  action rotateShip(p: int, ship: str): bool = {
    val placement = fleet.get(p).get(ship)
    if (phase == "setup" and not(ready.get(p)) and placement._1 >= 0 and _fits(fleet.get(p), ship, placement._1, not(placement._2)))
      _update(fleet.set(p, fleet.get(p).set(ship, (placement._1, not(placement._2)))), ready, phase, turn, shots, hits, sunk, winner, online, false)
    else _hold
  }
  /// Replace a player's ships with a complete random fleet during setup.
  action randomFleet(p: int, layout: str -> (int, bool)): bool =
    if (phase == "setup" and not(ready.get(p)))
      _update(fleet.set(p, layout), ready, phase, turn, shots, hits, sunk, winner, online, false)
    else _hold
  /// Confirm a complete fleet, which needs a connection.
  action becomeReady(p: int): bool =
    if (phase == "setup" and online.get(p) and online.get(1) and not(ready.get(p)) and _complete(fleet.get(p)))
      _update(fleet, ready.set(p, true), phase, turn, shots, hits, sunk, winner, online, false)
    else _hold
  /// Alice starts the game once both players are ready, with the first player to shoot.
  action startGame: bool =
    if (phase == "setup" and online.get(1) and PLAYERS.forall(q => ready.get(q)))
      _update(fleet, ready, "shooting", 1, shots, hits, sunk, winner, online, false)
    else _hold
  /// Shoot at a cell of the other player's board: a hit or a miss, any sinking it makes, and the victory with the 17th hit.
  action shoot(p: int, cell: int): bool =
    if (online.get(p) and online.get(1) and _allowed(phase, turn, shots, p, cell)) {
      val newShots = shots.set(p, shots.get(p).union(Set(cell)))
      val found = _occupied(fleet.get(_other(p))).contains(cell)
      val newHits = hits.set(p, if (found) hits.get(p) + 1 else hits.get(p))
      val won = newHits.get(p) == FLEET_CELLS
      _update(
        fleet, ready, if (won) "over" else "shooting", if (won) turn else _other(p), newShots,
        newHits, sunk.set(p, _sunkShips(fleet.get(_other(p)), newShots.get(p))), if (won) p else 0,
        online, false,
      )
    } else _hold
  /// A player's device loses its connection and keeps their last boards.
  action loseConnection(p: int): bool = all {
    online.get(p),
    _update(fleet, ready, phase, turn, shots, hits, sunk, winner, online.set(p, false), false),
  }
  /// The connection returns, and both boards show every shot made meanwhile.
  action connectionReturns(p: int): bool = all {
    not(online.get(p)),
    _update(fleet, ready, phase, turn, shots, hits, sunk, winner, online.set(p, true), false),
  }
  action step = any {
    {
      nondet p = PLAYERS.oneOf()
      nondet ship = SHIPS.oneOf()
      nondet first = (-1).to(100).oneOf()
      nondet horizontal = Set(false, true).oneOf()
      placeShip(p, ship, first, horizontal)
    },
    { nondet p = PLAYERS.oneOf() nondet ship = SHIPS.oneOf() rotateShip(p, ship) },
    { nondet p = PLAYERS.oneOf() nondet layout = RANDOM_FLEETS.oneOf() randomFleet(p, layout) },
    { nondet p = PLAYERS.oneOf() becomeReady(p) },
    startGame,
    { nondet p = PLAYERS.oneOf() nondet cell = (-1).to(100).oneOf() shoot(p, cell) },
    // Shots aimed at the other player's ships not yet hit, so traces reach sinkings and victories.
    { nondet p = PLAYERS.oneOf() nondet cell = _occupied(fleet.get(_other(p))).exclude(shots.get(p)).union(Set(0)).oneOf() shoot(p, cell) },
    { nondet p = PLAYERS.oneOf() loseConnection(p) },
    { nondet p = PLAYERS.oneOf() connectionReturns(p) },
  }

  /// Every placed ship lies horizontally or vertically inside the board, and no two ships share a cell.
  val invFleetLegal = PLAYERS.forall(p => _legal(fleet.get(p)))
  /// A ready fleet is complete, and shooting needs both players ready and the game started.
  val invReadyFleet = and {
    PLAYERS.forall(p => ready.get(p) implies _complete(fleet.get(p))),
    phase != "setup" implies PLAYERS.forall(p => ready.get(p)),
    phase == "setup" implies PLAYERS.forall(p => shots.get(p) == Set()),
  }
  /// Every shot is at a cell of the board, and each hit is one shot at a ship's cell, counted once.
  val invShotsUnique = PLAYERS.forall(p => and {
    shots.get(p).subseteq(CELLS),
    hits.get(p) == shots.get(p).intersect(_occupied(fleet.get(_other(p)))).size(),
  })
  /// The first player shoots first, and the turn passes after every hit and every miss.
  val invAlternation = and {
    shots.get(1).size() == shots.get(2).size() or shots.get(1).size() == shots.get(2).size() + 1,
    phase == "shooting" implies turn == (if (shots.get(1).size() == shots.get(2).size()) 1 else 2),
  }
  /// A ship is sunk exactly when every one of its cells has been hit.
  val invSinking = PLAYERS.forall(p => sunk.get(p) == _sunkShips(fleet.get(_other(p)), shots.get(p)))
  /// The 17th hit sinks the fifth ship and is the victory; only a victory makes the game over.
  val invVictory = and {
    (winner != 0) iff (phase == "over"),
    PLAYERS.forall(p => (winner == p) iff (hits.get(p) == FLEET_CELLS)),
    PLAYERS.forall(p => (winner == p) iff (sunk.get(p) == SHIPS)),
  }
  /// Once the game is over, no shot is ever added.
  val invFinality = phase == "over" implies shots == _endShots
  /// A refused placing, rotation, readiness, start or shot changes no fleet, readiness, shot, turn, victory or part of the game.
  val invRejection = _refused implies (fleet, ready, shots, turn, winner, phase) == _before
  /// The boards show only shots made, each marked a hit exactly when it found a ship, and are current with a connection.
  val invBoardsShowShots = PLAYERS.forall(p => and {
    targetingBoard.get(p).forall(m => shots.get(p).contains(m._1) and (m._2 iff _occupied(fleet.get(_other(p))).contains(m._1))),
    ownBoard.get(p).forall(m => shots.get(_other(p)).contains(m._1) and (m._2 iff _occupied(fleet.get(p)).contains(m._1))),
    online.get(p) implies (targetingBoard.get(p) == _marks(p, _other(p), shots, fleet) and ownBoard.get(p) == _marks(_other(p), p, shots, fleet)),
  })
  /// With no connection a player keeps their last boards.
  val invOffline = PLAYERS.forall(p => not(online.get(p)) implies (
    targetingBoard.get(p) == _savedTargetingBoard.get(p) and ownBoard.get(p) == _savedOwnBoard.get(p)
  ))
}
