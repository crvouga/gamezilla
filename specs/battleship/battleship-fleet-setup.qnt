// Alice is the first player and Bob the second. Each places a fleet of five
// ships on their own board of 100 cells, columns A to J and rows 1 to 10. A
// ship lies horizontally or vertically, entirely inside the board and never on
// another of its player's ships; ships may touch. A player may place, rotate
// and replace their ships with a random fleet until they are ready, and can
// become ready only with a complete fleet. Once both players are ready, Alice
// starts the game. A shot before the start is refused. A refused placing,
// rotation, readiness, start or shot changes nothing.
// Here a setup begins with no ship placed, with both fleets placed and nobody
// ready, or with both players ready.
// A player's ships stay where they are while their device has no
// connection: they cannot place, rotate or replace them, become ready or
// start. Alice hosts the space the game is played in: while she has no
// connection, Bob cannot become ready either.
// The shots after the start are a separate model.
module battleship_fleet_setup {
  pure val PLAYERS = Set(1, 2)
  pure val SHIPS = Set("carrier", "battleship", "cruiser", "submarine", "destroyer")
  /// Each pair of different ships once.
  pure val SHIP_PAIRS = Set(
    ("carrier", "battleship"), ("carrier", "cruiser"), ("carrier", "submarine"), ("carrier", "destroyer"),
    ("battleship", "cruiser"), ("battleship", "submarine"), ("battleship", "destroyer"),
    ("cruiser", "submarine"), ("cruiser", "destroyer"), ("submarine", "destroyer"),
  )
  /// A ship not on the board.
  pure val UNPLACED = (-1, -1, true)
  /// Two complete fleets a random fleet may be here: every ship along rows 1, 3, 5, 7 and 9
  /// from column A, or every ship down columns J, H, F, D and B from row 1.
  pure val HORIZONTAL_FLEET = Map("carrier" -> (0, 0, true), "battleship" -> (2, 0, true), "cruiser" -> (4, 0, true), "submarine" -> (6, 0, true), "destroyer" -> (8, 0, true))
  pure val VERTICAL_FLEET = Map("carrier" -> (0, 9, false), "battleship" -> (0, 7, false), "cruiser" -> (0, 5, false), "submarine" -> (0, 3, false), "destroyer" -> (0, 1, false))
  pure val RANDOM_FLEETS = Set(HORIZONTAL_FLEET, VERTICAL_FLEET)

  /// Each player's ships: the row (0 is row 1) and column (0 is column A) of the
  /// ship's first cell, and whether it lies along the row; row -1 when not placed.
  var fleet: int -> (str -> (int, int, bool))
  /// Which players are ready with their fleet.
  var ready: int -> bool
  /// The part of the game: "setup" until the start, then "shooting".
  var phase: str
  /// Whether each player's device has a connection.
  var online: int -> bool
  var _refused: bool
  var _before: (int -> (str -> (int, int, bool)), int -> bool, str)
  var _atCut: int -> (int -> (str -> (int, int, bool)), int -> bool, str)

  pure def _length(ship: str): int =
    if (ship == "carrier") 5 else if (ship == "battleship") 4 else if (ship == "destroyer") 2 else 3
  pure def _placed(at: (int, int, bool)): bool = at._1 >= 0
  /// A ship from this first cell lies entirely inside the board.
  pure def _inside(ship: str, at: (int, int, bool)): bool =
    at._1 >= 0 and at._1 <= 9 and at._2 >= 0 and at._2 <= 9 and
    (if (at._3) at._2 + _length(ship) <= 10 else at._1 + _length(ship) <= 10)
  /// Two ships from these first cells would share a cell.
  pure def _overlap(a: str, pa: (int, int, bool), b: str, pb: (int, int, bool)): bool =
    if (pa._3 and pb._3) pa._1 == pb._1 and pa._2 < pb._2 + _length(b) and pb._2 < pa._2 + _length(a)
    else if (not(pa._3) and not(pb._3)) pa._2 == pb._2 and pa._1 < pb._1 + _length(b) and pb._1 < pa._1 + _length(a)
    else if (pa._3) pb._2 >= pa._2 and pb._2 < pa._2 + _length(a) and pa._1 >= pb._1 and pa._1 < pb._1 + _length(b)
    else pa._2 >= pb._2 and pa._2 < pb._2 + _length(b) and pb._1 >= pa._1 and pb._1 < pa._1 + _length(a)
  /// No two placed ships share a cell.
  pure def _apart(ships: str -> (int, int, bool)): bool =
    SHIP_PAIRS.forall(pair =>
      not(_placed(ships.get(pair._1))) or not(_placed(ships.get(pair._2))) or
      not(_overlap(pair._1, ships.get(pair._1), pair._2, ships.get(pair._2))))
  pure def _complete(ships: str -> (int, int, bool)): bool = SHIPS.forall(s => _inside(s, ships.get(s))) and _apart(ships)
  /// A ship fits where it stays on the board and covers no cell of its player's other ships.
  pure def _fits(ships: str -> (int, int, bool), ship: str, at: (int, int, bool)): bool =
    _inside(ship, at) and SHIPS.forall(s => s == ship or not(_placed(ships.get(s))) or not(_overlap(ship, at, s, ships.get(s))))
  pure def _legal(ships: str -> (int, int, bool)): bool =
    SHIPS.forall(s => not(_placed(ships.get(s))) or _inside(s, ships.get(s))) and _apart(ships)

  action _update(f: int -> (str -> (int, int, bool)), r: int -> bool, stage: str, o: int -> bool, refused: bool): bool = all {
    fleet' = f, ready' = r, phase' = stage, online' = o,
    _refused' = refused,
    _before' = (fleet, ready, phase),
    _atCut' = PLAYERS.mapBy(p => if (online.get(p) and not(o.get(p))) (f, r, stage) else _atCut.get(p)),
  }
  action _hold = _update(fleet, ready, phase, online, true)

  action init = {
    nondet beginning = Set("new", "arranged", "ready").oneOf()
    val f = if (beginning == "new") PLAYERS.mapBy(_ => SHIPS.mapBy(_ => UNPLACED)) else Map(1 -> HORIZONTAL_FLEET, 2 -> VERTICAL_FLEET)
    val r = PLAYERS.mapBy(_ => beginning == "ready")
    all {
      fleet' = f,
      ready' = r,
      phase' = "setup",
      online' = PLAYERS.mapBy(_ => true),
      _refused' = false,
      _before' = (f, r, "setup"),
      _atCut' = PLAYERS.mapBy(_ => (f, r, "setup")),
    }
  }
  /// Place a ship from a cell, horizontally or vertically, or keep every ship where it was if it cannot go there or the device has no connection.
  action placeShip(p: int, ship: str, row: int, column: int, horizontal: bool): bool =
    if (phase == "setup" and online.get(p) and not(ready.get(p)) and _fits(fleet.get(p), ship, (row, column, horizontal)))
      _update(fleet.set(p, fleet.get(p).set(ship, (row, column, horizontal))), ready, phase, online, false)
    else _hold
  /// Turn a placed ship between horizontal and vertical from its first cell, or keep it where it was.
  action rotateShip(p: int, ship: str): bool = {
    val at = fleet.get(p).get(ship)
    val turned = (at._1, at._2, not(at._3))
    if (phase == "setup" and online.get(p) and not(ready.get(p)) and _placed(at) and _fits(fleet.get(p), ship, turned))
      _update(fleet.set(p, fleet.get(p).set(ship, turned)), ready, phase, online, false)
    else _hold
  }
  /// Replace a player's ships with a complete random fleet during setup, which needs a connection.
  action randomFleet(p: int, layout: str -> (int, int, bool)): bool =
    if (phase == "setup" and online.get(p) and not(ready.get(p)))
      _update(fleet.set(p, layout), ready, phase, online, false)
    else _hold
  /// Confirm a complete fleet, which needs a connection.
  action becomeReady(p: int): bool =
    if (phase == "setup" and online.get(p) and online.get(1) and not(ready.get(p)) and _complete(fleet.get(p)))
      _update(fleet, ready.set(p, true), phase, online, false)
    else _hold
  /// A shot before the start is refused.
  action shoot(p: int, cell: int): bool = all { phase == "setup", _hold }
  /// Alice starts the game once both players are ready.
  action startGame: bool =
    if (phase == "setup" and online.get(1) and PLAYERS.forall(q => ready.get(q)))
      _update(fleet, ready, "shooting", online, false)
    else _hold
  /// A player's device loses its connection.
  action loseConnection(p: int): bool = all {
    online.get(p),
    _update(fleet, ready, phase, online.set(p, false), false),
  }
  /// The connection returns.
  action connectionReturns(p: int): bool = all {
    not(online.get(p)),
    _update(fleet, ready, phase, online.set(p, true), false),
  }
  action step = any {
    {
      nondet p = PLAYERS.oneOf()
      nondet ship = SHIPS.oneOf()
      // One row and one column past each edge, so placings off the board are tried too.
      nondet row = (-1).to(10).oneOf()
      nondet column = (-1).to(10).oneOf()
      nondet horizontal = Set(false, true).oneOf()
      placeShip(p, ship, row, column, horizontal)
    },
    { nondet p = PLAYERS.oneOf() nondet ship = SHIPS.oneOf() rotateShip(p, ship) },
    { nondet p = PLAYERS.oneOf() nondet layout = RANDOM_FLEETS.oneOf() randomFleet(p, layout) },
    { nondet p = PLAYERS.oneOf() becomeReady(p) },
    startGame,
    { nondet p = PLAYERS.oneOf() nondet cell = 0.to(99).oneOf() shoot(p, cell) },
    { nondet p = PLAYERS.oneOf() loseConnection(p) },
    { nondet p = PLAYERS.oneOf() connectionReturns(p) },
  }

  /// Every placed ship lies horizontally or vertically inside the board, and no two ships share a cell.
  val invFleetLegal = PLAYERS.forall(p => _legal(fleet.get(p)))
  /// A ready fleet is complete, and the game starts only with both players ready.
  val invReadyFleet = and {
    PLAYERS.forall(p => ready.get(p) implies _complete(fleet.get(p))),
    phase != "setup" implies PLAYERS.forall(p => ready.get(p)),
  }
  /// A refused placing, rotation, readiness, start or shot changes no fleet, readiness or part of the game.
  val invRejection = _refused implies (fleet, ready, phase) == _before
  /// A player with no connection keeps their ships and does not become ready; while Alice has none, nobody becomes ready and the game does not start.
  val invOffline = and {
    PLAYERS.forall(p => not(online.get(p)) implies (fleet.get(p), ready.get(p)) == (_atCut.get(p)._1.get(p), _atCut.get(p)._2.get(p))),
    not(online.get(1)) implies (ready, phase) == (_atCut.get(1)._2, _atCut.get(1)._3),
  }
}
