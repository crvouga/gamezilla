// @model-profile: local
// Alice plays South. In Classic, Bob plays North; in King of the Hill,
// Bob plays West, Carol plays North and Dave plays East. The board is nine
// squares wide and high, with South at e1. Classic has ten walls each and
// the opposite home row is the goal. King of the Hill has five walls each,
// clockwise turns South, West, North, East, and the first pawn on e5 wins
// immediately, with no hold. Neither mode allows a draw by its own rules.
// Every move or wall placement follows the rules described here, whether a
// person or bot chooses it. A refused choice changes nothing. Walls leave
// every goal reachable, considering walls alone. The board's rules have no
// connection dependency: the shared game's rules decide who may play when
// a device is offline, and keep its board and result through interruptions.
module quoridor_play {
  pure val CELLS = 0.to(80)
  pure val CLASSIC_PLAYERS = Set(0, 1)
  pure val HILL_PLAYERS = Set(0, 1, 2, 3)
  pure val WALLS = 0.to(127).map(n => (n % 8, (n / 8) % 8, n / 64))
  /// The selected mode, "classic" or "hill".
  var mode: str
  /// Each player's pawn square: a1 is 0, b1 is 1, and i9 is 80.
  var pawns: int -> int
  /// Placed walls: their left column, lower row and orientation, 0 horizontal or 1 vertical.
  var walls: Set[(int, int, int)]
  /// Each player's remaining walls.
  var remaining: int -> int
  /// The player whose turn it is.
  var turn: int
  /// The player who won, or -1 while nobody has.
  var winner: int
  var _plies: int
  var _refused: bool
  var _before: (int -> int, Set[(int, int, int)], int -> int, int, int)
  var _finished: (int -> int, Set[(int, int, int)], int -> int, int, int)

  pure def _players(m: str): Set[int] = if (m == "classic") CLASSIC_PLAYERS else HILL_PLAYERS
  pure def _roundTurn(m: str, moves: int): int = if (m == "classic") moves % 2 else moves % 4
  pure def _x(square: int): int = square % 9
  pure def _y(square: int): int = square / 9
  pure def _abs(n: int): int = if (n < 0) -n else n
  pure def _nearby(square: int): Set[int] =
    Set(-18, -10, -9, -8, -2, -1, 1, 2, 8, 9, 10, 18).map(offset => square + offset)
  pure def _adjacent(a: int, b: int): bool =
    CELLS.contains(a) and CELLS.contains(b) and _abs(_x(a) - _x(b)) + _abs(_y(a) - _y(b)) == 1
  pure def _goal(m: str, player: int, square: int): bool =
    if (m == "hill") square == 40 else _y(square) == (if (player == 0) 8 else 0)
  pure def _blocked(a: int, b: int, placed: Set[(int, int, int)]): bool = placed.exists(w =>
    if (w._3 == 0) and {
      _x(a) == _x(b), Set(w._1, w._1 + 1).contains(_x(a)),
      Set(_y(a), _y(b)) == Set(w._2, w._2 + 1),
    } else and {
      _y(a) == _y(b), Set(w._2, w._2 + 1).contains(_y(a)),
      Set(_x(a), _x(b)) == Set(w._1, w._1 + 1),
    }
  )
  pure def _edge(a: int, b: int, placed: Set[(int, int, int)]): bool = _adjacent(a, b) and not(_blocked(a, b, placed))
  pure def _neighbors(square: int): Set[int] =
    Set(square - 9, square + 9, square - 1, square + 1).filter(other => _adjacent(square, other))
  pure def _expandReachable(seen: Set[int], placed: Set[(int, int, int)]): Set[int] =
    CELLS.filter(square => seen.contains(square) or
      _neighbors(square).exists(other => seen.contains(other) and not(_blocked(square, other, placed))))
  pure def _atMostOneWall(placed: Set[(int, int, int)]): bool =
    placed.forall(first => placed.forall(second => first == second))
  pure def _reachable(m: str, player: int, start: int, placed: Set[(int, int, int)]): bool =
    // One wall removes only two parallel boundaries; every square can still go around it.
    if (_atMostOneWall(placed)) CELLS.contains(start) else {
    val reachable = 0.to(80).fold(Set(start), (seen, _) =>
      if (seen.exists(c => _goal(m, player, c))) seen
      else _expandReachable(seen, placed))
    reachable.exists(c => _goal(m, player, c))
  }
  pure def _clear(m: str, positions: int -> int, square: int): bool =
    CELLS.contains(square) and _players(m).forall(p => positions.get(p) != square)
  pure def _pawnMove(m: str, positions: int -> int, placed: Set[(int, int, int)], p: int, destination: int): bool = {
    val from = positions.get(p)
    and {
      _clear(m, positions, destination),
      or {
        _edge(from, destination, placed),
        _players(m).exclude(Set(p)).exists(other => {
          val adjacent = positions.get(other)
          val dx = _x(adjacent) - _x(from)
          val dy = _y(adjacent) - _y(from)
          val behindX = _x(adjacent) + dx
          val behindY = _y(adjacent) + dy
          val behind = behindY * 9 + behindX
          val straight = behindX >= 0 and behindX < 9 and behindY >= 0 and behindY < 9 and
            _clear(m, positions, behind) and _edge(adjacent, behind, placed)
          and {
            _edge(from, adjacent, placed),
            if (straight) destination == behind else and {
              _edge(adjacent, destination, placed),
              if (dx == 0) _y(destination) == _y(adjacent) else _x(destination) == _x(adjacent),
            },
          }
        }),
      },
    }
  }
  pure def _conflict(a: (int, int, int), b: (int, int, int)): bool =
    if (a._3 != b._3) a._1 == b._1 and a._2 == b._2
    else if (a._3 == 0) a._2 == b._2 and _abs(a._1 - b._1) < 2
    else a._1 == b._1 and _abs(a._2 - b._2) < 2
  pure def _wallAllowed(m: str, positions: int -> int, placed: Set[(int, int, int)], w: (int, int, int)): bool = and {
    0.to(7).contains(w._1), 0.to(7).contains(w._2), Set(0, 1).contains(w._3),
    placed.forall(other => not(_conflict(w, other))),
    _players(m).forall(p => _reachable(m, p, positions.get(p), placed.union(Set(w)))),
  }
  action _update(positions: int -> int, placed: Set[(int, int, int)], stock: int -> int, mover: int, won: int, refused: bool): bool = all {
    mode' = mode, pawns' = positions, walls' = placed, remaining' = stock, turn' = mover, winner' = won,
    _plies' = if (refused) _plies else _plies + 1,
    _refused' = refused, _before' = (pawns, walls, remaining, turn, winner),
    _finished' = if (winner == -1 and won != -1) (positions, placed, stock, mover, won) else _finished,
  }
  action _hold = _update(pawns, walls, remaining, turn, winner, true)
  action init = {
    nondet selected = Set("classic", "hill").oneOf()
    nondet beginning = Set("start", "near goal").oneOf()
    val positions = if (selected == "classic")
      Map(0 -> (if (beginning == "start") 4 else 66), 1 -> 76)
      else Map(0 -> (if (beginning == "start") 4 else 22), 1 -> 36, 2 -> 76, 3 -> 44)
    val stock = _players(selected).mapBy(_ => if (selected == "classic") 10 else 5)
    all {
      mode' = selected, pawns' = positions, walls' = Set(), remaining' = stock,
      turn' = 0, winner' = -1, _plies' = 0, _refused' = false,
      _before' = (positions, Set(), stock, 0, -1),
      _finished' = (positions, Set(), stock, 0, -1),
    }
  }
  /// Move one's pawn to an allowed square, or keep the whole board when refused.
  action movePawn(player: int, square: int): bool =
    if (winner == -1 and _players(mode).contains(player) and turn == player and _pawnMove(mode, pawns, walls, player, square))
      _update(pawns.set(player, square), walls, remaining, _roundTurn(mode, turn + 1),
        if (_goal(mode, player, square)) player else -1, false)
    else _hold
  /// Place one wall while leaving every player a path to their goal, or keep the board and every wall when refused.
  action placeWall(player: int, column: int, row: int, direction: int): bool = {
    val wall = (column, row, direction)
    if (winner == -1 and _players(mode).contains(player) and turn == player and remaining.get(player) > 0 and _wallAllowed(mode, pawns, walls, wall))
      _update(pawns, walls.union(Set(wall)), remaining.set(player, remaining.get(player) - 1),
        _roundTurn(mode, turn + 1), -1, false)
    else _hold
  }
  /// In King of the Hill, pass only when no pawn move or wall placement is possible. The player stays in the game.
  action passTurn(player: int): bool =
    if (mode != "hill" or winner != -1 or player != turn) _hold
    else if (_nearby(pawns.get(player)).exists(c => _pawnMove(mode, pawns, walls, player, c))) _hold
    else if (remaining.get(player) == 0)
      _update(pawns, walls, remaining, _roundTurn(mode, turn + 1), winner, false)
    else if (WALLS.exists(w => _wallAllowed(mode, pawns, walls, w))) _hold
    else _update(pawns, walls, remaining, _roundTurn(mode, turn + 1), winner, false)
  action step = any {
    { nondet player = _players(mode).oneOf() nondet square = CELLS.oneOf() movePawn(player, square) },
    { nondet player = Set(turn).oneOf() nondet square = _nearby(pawns.get(turn)).filter(c => _pawnMove(mode, pawns, walls, turn, c)).union(Set(40)).oneOf() movePawn(player, square) },
    { nondet player = _players(mode).oneOf() nondet column = (-1).to(8).oneOf() nondet row = (-1).to(8).oneOf() nondet direction = Set(0, 1).oneOf() placeWall(player, column, row, direction) },
    { nondet player = _players(mode).oneOf() passTurn(player) },
  }
  /// Every pawn is on the board, and two pawns never share a square.
  val invPawns = _players(mode).forall(p => CELLS.contains(pawns.get(p)) and _players(mode).exclude(Set(p)).forall(q => pawns.get(p) != pawns.get(q)))
  /// Walls stay inside the board without crossing or overlapping.
  val invWalls = walls.forall(w => 0.to(7).contains(w._1) and 0.to(7).contains(w._2) and Set(0, 1).contains(w._3) and walls.exclude(Set(w)).forall(other => not(_conflict(w, other))))
  /// Every player has a path to the selected goal, considering the walls alone.
  val invPaths = _players(mode).forall(p => _reachable(mode, p, pawns.get(p), walls))
  /// Every wall is either on the board or still available to its player, and no inventory is negative.
  val invInventory = _players(mode).forall(p => remaining.get(p) >= 0) and _players(mode).fold(0, (total, p) => total + remaining.get(p)) + walls.size() == 20
  /// Allowed choices advance the clockwise turn once, while refusals keep it.
  val invTurns = turn == _roundTurn(mode, _plies)
  /// A player wins exactly when their pawn reaches the goal, and at most one player has done so.
  val invVictory = and {
    _players(mode).forall(p => (winner == p) iff _goal(mode, p, pawns.get(p))),
    _players(mode).filter(p => _goal(mode, p, pawns.get(p))).size() <= 1,
  }
  /// A refused choice changes no pawn, wall, inventory, turn or winner.
  val invRefusal = _refused implies (pawns, walls, remaining, turn, winner) == _before
  /// After a victory, no pawn, wall, inventory, turn or winner changes.
  val invFinality = winner != -1 implies (pawns, walls, remaining, turn, winner) == _finished
}
