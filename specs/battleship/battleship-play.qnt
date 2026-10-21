// Alice is the first player and Bob the second. Each has a fleet of five
// ships on their own board of 100 cells, columns A to J and rows 1 to 10, and
// sees their whole fleet and every shot at it on their own board, and on their
// targeting board only what their own shots found: each cell they shot at, as
// a hit or a miss, and the ships they sank.
// The first player shoots first, and the turn passes after every hit and every
// miss. A shot at a cell with a ship is a hit, anywhere else a miss; the hit on
// a ship's last cell sinks it and names it. The 17th hit sinks the fifth ship
// and wins at once, and the game is over. A refused shot changes nothing and
// keeps the turn.
// A game can be followed from its start, or from one hit before the first
// player's victory. Placing the fleets and starting are in
// battleship-fleet-setup.qnt.
// A player whose device has no connection keeps seeing their last boards and
// cannot shoot; a refused shot does not happen later. Alice hosts the space
// the game is played in: while she has no connection, Bob cannot shoot either
// and keeps the boards he had. Once both a player and Alice have a
// connection, the player sees every shot made meanwhile.
module battleship_play {
  pure val PLAYERS = Set(1, 2)
  pure val SHIPS = Set("carrier", "battleship", "cruiser", "submarine", "destroyer")
  /// The board's cells: A1 to J1 are 0 to 9, A2 to J2 are 10 to 19, and so on to J10, 99.
  pure val CELLS = 0.to(99)
  pure val FLEET_CELLS = 17
  /// The cells each player's ships cover: Alice's lie along rows 1, 3, 5, 7 and 9
  /// from column A, Bob's down columns J, H, F, D and B from row 1.
  pure val SHIP_CELLS = Map(
    1 -> Map("carrier" -> Set(0, 1, 2, 3, 4), "battleship" -> Set(20, 21, 22, 23), "cruiser" -> Set(40, 41, 42), "submarine" -> Set(60, 61, 62), "destroyer" -> Set(80, 81)),
    2 -> Map("carrier" -> Set(9, 19, 29, 39, 49), "battleship" -> Set(7, 17, 27, 37), "cruiser" -> Set(5, 15, 25), "submarine" -> Set(3, 13, 23), "destroyer" -> Set(1, 11)),
  )
  /// Every cell of each player's fleet.
  pure val OCCUPIED = Map(
    1 -> Set(0, 1, 2, 3, 4, 20, 21, 22, 23, 40, 41, 42, 60, 61, 62, 80, 81),
    2 -> Set(9, 19, 29, 39, 49, 7, 17, 27, 37, 5, 15, 25, 3, 13, 23, 1, 11),
  )
  /// One hit from victory: the first player has hit every cell of the second player's
  /// fleet but B2, the destroyer's last, and the second player has missed 16 times.
  pure val LATE_FIRST_SHOTS = Set(9, 19, 29, 39, 49, 7, 17, 27, 37, 5, 15, 25, 3, 13, 23, 1)
  pure val LATE_SECOND_SHOTS = 10.to(15).union(90.to(99))

  /// The part of the game: "shooting" or "over".
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
  var _before: (int -> Set[int], int, int, str)
  var _endShots: int -> Set[int]

  pure def _other(p: int): int = 3 - p
  pure def _sunkShips(p: int, shotAt: Set[int]): Set[str] =
    SHIPS.filter(s => SHIP_CELLS.get(_other(p)).get(s).subseteq(shotAt))
  /// Whether player p's boards follow the game: p and the host, Alice, both have a connection.
  pure def _current(p: int, o: int -> bool): bool = o.get(p) and o.get(1)
  /// Player p's shots at the board of player `at`, each marked whether it found a ship.
  pure def _marks(p: int, at: int, shotsNow: int -> Set[int]): Set[(int, bool)] =
    shotsNow.get(p).map(c => (c, OCCUPIED.get(at).contains(c)))

  action _update(
    stage: str, mover: int, s: int -> Set[int], h: int -> int, sk: int -> Set[str], w: int, o: int -> bool, refused: bool,
  ): bool = all {
    phase' = stage, turn' = mover, shots' = s, hits' = h, sunk' = sk, winner' = w, online' = o,
    targetingBoard' = PLAYERS.mapBy(p => if (_current(p, o)) _marks(p, _other(p), s) else targetingBoard.get(p)),
    ownBoard' = PLAYERS.mapBy(p => if (_current(p, o)) _marks(_other(p), p, s) else ownBoard.get(p)),
    _savedTargetingBoard' = PLAYERS.mapBy(p => if (_current(p, online) and not(_current(p, o))) targetingBoard.get(p) else _savedTargetingBoard.get(p)),
    _savedOwnBoard' = PLAYERS.mapBy(p => if (_current(p, online) and not(_current(p, o))) ownBoard.get(p) else _savedOwnBoard.get(p)),
    _refused' = refused,
    _before' = (shots, turn, winner, phase),
    _endShots' = if (w != 0 and winner == 0) s else _endShots,
  }
  action _hold = _update(phase, turn, shots, hits, sunk, winner, online, true)

  action init = {
    nondet beginning = Set("started", "one hit from victory").oneOf()
    val s = if (beginning == "one hit from victory") Map(1 -> LATE_FIRST_SHOTS, 2 -> LATE_SECOND_SHOTS) else PLAYERS.mapBy(_ => Set())
    all {
      phase' = "shooting",
      turn' = 1,
      shots' = s,
      hits' = PLAYERS.mapBy(p => s.get(p).intersect(OCCUPIED.get(_other(p))).size()),
      sunk' = PLAYERS.mapBy(p => _sunkShips(p, s.get(p))),
      winner' = 0,
      online' = PLAYERS.mapBy(_ => true),
      targetingBoard' = PLAYERS.mapBy(p => _marks(p, _other(p), s)),
      ownBoard' = PLAYERS.mapBy(p => _marks(_other(p), p, s)),
      _savedTargetingBoard' = PLAYERS.mapBy(_ => Set()),
      _savedOwnBoard' = PLAYERS.mapBy(_ => Set()),
      _refused' = false,
      _before' = (s, 1, 0, "shooting"),
      _endShots' = PLAYERS.mapBy(_ => Set()),
    }
  }
  /// Shoot at a cell of the other player's board: a hit or a miss, any sinking it makes, and the victory with the 17th hit.
  action shoot(p: int, cell: int): bool =
    if (online.get(p) and online.get(1) and phase == "shooting" and turn == p and CELLS.contains(cell) and not(shots.get(p).contains(cell))) {
      val newShots = shots.set(p, shots.get(p).union(Set(cell)))
      val found = OCCUPIED.get(_other(p)).contains(cell)
      val newHits = hits.set(p, if (found) hits.get(p) + 1 else hits.get(p))
      val won = newHits.get(p) == FLEET_CELLS
      _update(
        if (won) "over" else "shooting", if (won) turn else _other(p), newShots, newHits,
        sunk.set(p, _sunkShips(p, newShots.get(p))), if (won) p else 0, online, false,
      )
    } else _hold
  /// A player's device loses its connection and keeps their last boards.
  action loseConnection(p: int): bool = all {
    online.get(p),
    _update(phase, turn, shots, hits, sunk, winner, online.set(p, false), false),
  }
  /// The connection returns; with Alice's too, both boards show every shot made meanwhile.
  action connectionReturns(p: int): bool = all {
    not(online.get(p)),
    _update(phase, turn, shots, hits, sunk, winner, online.set(p, true), false),
  }
  action step = any {
    { nondet p = PLAYERS.oneOf() nondet cell = (-1).to(100).oneOf() shoot(p, cell) },
    // Shots aimed at the other player's ships not yet hit, so traces reach sinkings and victories.
    { nondet p = PLAYERS.oneOf() nondet cell = OCCUPIED.get(_other(p)).exclude(shots.get(p)).union(Set(0)).oneOf() shoot(p, cell) },
    { nondet p = PLAYERS.oneOf() loseConnection(p) },
    { nondet p = PLAYERS.oneOf() connectionReturns(p) },
  }

  /// Every shot is at a cell of the board, and each hit is one shot at a ship's cell, counted once.
  val invShotsUnique = PLAYERS.forall(p => and {
    shots.get(p).subseteq(CELLS),
    hits.get(p) == shots.get(p).intersect(OCCUPIED.get(_other(p))).size(),
  })
  /// The first player shoots first, and the turn passes after every hit and every miss.
  val invAlternation = and {
    shots.get(1).size() == shots.get(2).size() or shots.get(1).size() == shots.get(2).size() + 1,
    phase == "shooting" implies turn == (if (shots.get(1).size() == shots.get(2).size()) 1 else 2),
  }
  /// A ship is sunk exactly when every one of its cells has been hit.
  val invSinking = PLAYERS.forall(p => sunk.get(p) == _sunkShips(p, shots.get(p)))
  /// The 17th hit sinks the fifth ship and is the victory; only a victory makes the game over.
  val invVictory = and {
    (winner != 0) iff (phase == "over"),
    PLAYERS.forall(p => (winner == p) iff (hits.get(p) == FLEET_CELLS)),
    PLAYERS.forall(p => (winner == p) iff (sunk.get(p) == SHIPS)),
  }
  /// Once the game is over, no shot is ever added.
  val invFinality = phase == "over" implies shots == _endShots
  /// A refused shot changes no shot, turn, victory or part of the game.
  val invRejection = _refused implies (shots, turn, winner, phase) == _before
  /// The boards show only shots made, each marked a hit exactly when it found a ship, and are current while the player and Alice have a connection.
  val invBoardsShowShots = PLAYERS.forall(p => and {
    targetingBoard.get(p).forall(m => shots.get(p).contains(m._1) and (m._2 iff OCCUPIED.get(_other(p)).contains(m._1))),
    ownBoard.get(p).forall(m => shots.get(_other(p)).contains(m._1) and (m._2 iff OCCUPIED.get(p).contains(m._1))),
    _current(p, online) implies (targetingBoard.get(p) == _marks(p, _other(p), shots) and ownBoard.get(p) == _marks(_other(p), p, shots)),
  })
  /// With no connection, or while Alice has none, a player keeps their last boards.
  val invOffline = PLAYERS.forall(p => not(_current(p, online)) implies (
    targetingBoard.get(p) == _savedTargetingBoard.get(p) and ownBoard.get(p) == _savedOwnBoard.get(p)
  ))
}
