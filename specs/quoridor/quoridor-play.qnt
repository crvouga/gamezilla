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
  /// Whether this game uses Four-Player King of the Hill.
  const HILL: bool
  pure val CELLS = 0.to(80)
  pure val CLASSIC_PLAYERS = Set(0, 1)
  pure val HILL_PLAYERS = Set(0, 1, 2, 3)
  pure val WALLS = 0.to(127).map(n => (n % 8, (n / 8) % 8, n / 64))
  pure val _CORNER_REGIONS = Set(
    Set(0), Set(0, 1), Set(0, 9), Set(0, 1, 9, 10),
    Set(8), Set(7, 8), Set(8, 17), Set(7, 8, 16, 17),
    Set(72), Set(72, 73), Set(63, 72), Set(63, 64, 72, 73),
    Set(80), Set(79, 80), Set(71, 80), Set(70, 71, 79, 80),
  )
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

  pure val _PLAYERS = if (HILL) HILL_PLAYERS else CLASSIC_PLAYERS
  pure def _roundTurn(moves: int): int = if (HILL) moves % 4 else moves % 2
  pure def _x(square: int): int = square % 9
  pure def _y(square: int): int = square / 9
  pure def _abs(n: int): int = if (n < 0) -n else n
  pure def _nearby(square: int): Set[int] =
    Set(-18, -10, -9, -8, -2, -1, 1, 2, 8, 9, 10, 18).map(offset => square + offset)
  pure def _adjacent(a: int, b: int): bool =
    CELLS.contains(a) and CELLS.contains(b) and _abs(_x(a) - _x(b)) + _abs(_y(a) - _y(b)) == 1
  pure def _goal(player: int, square: int): bool =
    if (HILL) square == 40 else _y(square) == (if (player == 0) 8 else 0)
  pure def _spans(first: int, second: int, anchor: int): bool =
    (first == anchor and second == anchor + 1) or (second == anchor and first == anchor + 1)
  pure def _blocked(a: int, b: int, placed: Set[(int, int, int)]): bool = placed.exists(w =>
    if (w._3 == 0) and {
      _x(a) == _x(b), _x(a) == w._1 or _x(a) == w._1 + 1,
      _spans(_y(a), _y(b), w._2),
    } else and {
      _y(a) == _y(b), _y(a) == w._2 or _y(a) == w._2 + 1,
      _spans(_x(a), _x(b), w._1),
    }
  )
  pure def _edge(a: int, b: int, placed: Set[(int, int, int)]): bool = _adjacent(a, b) and not(_blocked(a, b, placed))
  pure def _neighbors(square: int): Set[int] =
    Set(square - 9, square + 9, square - 1, square + 1).filter(other => _adjacent(square, other))
  pure def _connections(placed: Set[(int, int, int)]): int -> Set[int] =
    CELLS.mapBy(square => _neighbors(square).filter(other => not(_blocked(square, other, placed))))
  pure def _expandReachable(seen: Set[int], connections: int -> Set[int]): Set[int] =
    CELLS.filter(square => seen.contains(square) or
      connections.get(square).exists(other => seen.contains(other)))
  pure def _atMostOneWall(placed: Set[(int, int, int)]): bool =
    placed.forall(first => placed.forall(second => first == second))
  pure def _boxed(region: Set[int], placed: Set[(int, int, int)]): bool =
    region.forall(square => _neighbors(square).exclude(region).forall(other => _blocked(square, other, placed)))
  pure def _smallReachable(player: int, start: int, placed: Set[(int, int, int)]): bool =
    CELLS.contains(start) and not(_CORNER_REGIONS.exists(region =>
      region.contains(start) and not(region.exists(square => _goal(player, square))) and _boxed(region, placed)))
  pure def _fullReachable(player: int, start: int, connections: int -> Set[int]): bool = {
    val reachable = 0.to(80).fold(Set(start), (seen, _) =>
      if (seen.exists(c => _goal(player, c))) seen
      else _expandReachable(seen, connections))
    reachable.exists(c => _goal(player, c))
  }
  pure def _smallPathVerdict(wantReachable: bool, player: int, start: int, placed: Set[(int, int, int)]): bool =
    // One wall removes only two parallel boundaries; every square can still go around it.
    if (_atMostOneWall(placed)) CELLS.contains(start) == wantReachable
    // Two walls can separate only a corner rectangle no more than two squares wide and high.
    else _smallReachable(player, start, placed) == wantReachable
  pure def _allPaths(positions: int -> int, placed: Set[(int, int, int)]): bool = or {
    placed.size() >= 3 and {
      val connections = _connections(placed)
      _PLAYERS.forall(player => _fullReachable(player, positions.get(player), connections))
    },
    placed.size() < 3 and _PLAYERS.forall(player => _smallPathVerdict(true, player, positions.get(player), placed)),
  }
  pure def _someBlocked(positions: int -> int, placed: Set[(int, int, int)]): bool = or {
    placed.size() >= 3 and {
      val connections = _connections(placed)
      _PLAYERS.exists(player => not(_fullReachable(player, positions.get(player), connections)))
    },
    placed.size() < 3 and _PLAYERS.exists(player => _smallPathVerdict(false, player, positions.get(player), placed)),
  }
  pure def _clear(positions: int -> int, square: int): bool =
    CELLS.contains(square) and _PLAYERS.forall(p => positions.get(p) != square)
  pure def _pawnMove(positions: int -> int, placed: Set[(int, int, int)], p: int, destination: int): bool = {
    val from = positions.get(p)
    and {
      _clear(positions, destination),
      or {
        _edge(from, destination, placed),
        _PLAYERS.exclude(Set(p)).exists(other => {
          val adjacent = positions.get(other)
          val dx = _x(adjacent) - _x(from)
          val dy = _y(adjacent) - _y(from)
          val behindX = _x(adjacent) + dx
          val behindY = _y(adjacent) + dy
          val behind = behindY * 9 + behindX
          val straight = behindX >= 0 and behindX < 9 and behindY >= 0 and behindY < 9 and
            _clear(positions, behind) and _edge(adjacent, behind, placed)
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
  pure def _wallAllowed(positions: int -> int, placed: Set[(int, int, int)], w: (int, int, int)): bool = and {
    0.to(7).contains(w._1), 0.to(7).contains(w._2), Set(0, 1).contains(w._3),
    placed.forall(other => not(_conflict(w, other))),
    _allPaths(positions, placed.union(Set(w))),
  }
  pure def _wallRefused(positions: int -> int, placed: Set[(int, int, int)], w: (int, int, int)): bool = or {
    not(0.to(7).contains(w._1)), not(0.to(7).contains(w._2)), not(Set(0, 1).contains(w._3)),
    placed.exists(other => _conflict(w, other)),
    _someBlocked(positions, placed.union(Set(w))),
  }
  // With at most two walls, a central wall fits without cutting any existing path.
  pure def _hasLegalWall(positions: int -> int, placed: Set[(int, int, int)]): bool = or {
    placed.size() >= 3 and WALLS.exists(w => _wallAllowed(positions, placed, w)),
    placed.size() < 3 and _allPaths(positions, placed),
  }
  pure def _noLegalWall(positions: int -> int, placed: Set[(int, int, int)]): bool = or {
    placed.size() >= 3 and WALLS.forall(w => _wallRefused(positions, placed, w)),
    placed.size() < 3 and _someBlocked(positions, placed),
  }
  action _update(positions: int -> int, placed: Set[(int, int, int)], stock: int -> int, mover: int, won: int, refused: bool): bool = all {
    mode' = mode, pawns' = positions, walls' = placed, remaining' = stock, turn' = mover, winner' = won,
    _plies' = if (refused) _plies else _plies + 1,
    _refused' = refused, _before' = (pawns, walls, remaining, turn, winner),
    _finished' = if (winner == -1 and won != -1) (positions, placed, stock, mover, won) else _finished,
  }
  action _hold = _update(pawns, walls, remaining, turn, winner, true)
  action init = {
    nondet selected = Set(if (HILL) "hill" else "classic").oneOf()
    nondet beginning = Set("start", "near goal").oneOf()
    val positions = if (not(HILL))
      Map(0 -> (if (beginning == "start") 4 else 66), 1 -> 76)
      else Map(0 -> (if (beginning == "start") 4 else 22), 1 -> 36, 2 -> 76, 3 -> 44)
    val stock = _PLAYERS.mapBy(_ => if (HILL) 5 else 10)
    all {
      mode' = selected, pawns' = positions, walls' = Set(), remaining' = stock,
      turn' = 0, winner' = -1, _plies' = 0, _refused' = false,
      _before' = (positions, Set(), stock, 0, -1),
      _finished' = (positions, Set(), stock, 0, -1),
    }
  }
  /// Move one's pawn to an allowed square, or keep the whole board when refused.
  action movePawn(player: int, square: int): bool =
    if (winner == -1 and _PLAYERS.contains(player) and turn == player and _pawnMove(pawns, walls, player, square))
      _update(pawns.set(player, square), walls, remaining, _roundTurn(turn + 1),
        if (_goal(player, square)) player else -1, false)
    else _hold
  /// Place one wall while leaving every player a path to their goal, or keep the board and every wall when refused.
  action placeWall(player: int, column: int, row: int, direction: int): bool = {
    val wall = (column, row, direction)
    if (winner == -1 and _PLAYERS.contains(player) and turn == player and remaining.get(player) > 0) {
      nondet _wallAccepted = Set(false, true).oneOf()
      all {
        or {
          _wallAccepted and _wallAllowed(pawns, walls, wall),
          not(_wallAccepted) and _wallRefused(pawns, walls, wall),
        },
        if (_wallAccepted)
          _update(pawns, walls.union(Set(wall)), remaining.set(player, remaining.get(player) - 1),
            _roundTurn(turn + 1), -1, false)
        else _hold,
      }
    }
    else _hold
  }
  /// In King of the Hill, pass only when no pawn move or wall placement is possible. The player stays in the game.
  action passTurn(player: int): bool =
    if (not(HILL) or winner != -1 or player != turn) _hold
    else if (_nearby(pawns.get(player)).exists(c => _pawnMove(pawns, walls, player, c))) _hold
    else if (remaining.get(player) == 0)
      _update(pawns, walls, remaining, _roundTurn(turn + 1), winner, false)
    else {
      nondet _wallAvailable = Set(false, true).oneOf()
      all {
        or {
          _wallAvailable and _hasLegalWall(pawns, walls),
          not(_wallAvailable) and _noLegalWall(pawns, walls),
        },
        if (_wallAvailable) _hold
        else _update(pawns, walls, remaining, _roundTurn(turn + 1), winner, false),
      }
    }
  action step = any {
    { nondet player = _PLAYERS.oneOf() nondet square = CELLS.oneOf() movePawn(player, square) },
    { nondet player = _PLAYERS.oneOf() nondet column = (-1).to(8).oneOf() nondet row = (-1).to(8).oneOf() nondet direction = Set(0, 1).oneOf() placeWall(player, column, row, direction) },
    { nondet player = _PLAYERS.oneOf() passTurn(player) },
  }
  /// Every pawn is on the board, and two pawns never share a square.
  val invPawns = _PLAYERS.forall(p => CELLS.contains(pawns.get(p)) and _PLAYERS.exclude(Set(p)).forall(q => pawns.get(p) != pawns.get(q)))
  /// Walls stay inside the board without crossing or overlapping.
  val invWalls = walls.forall(w => 0.to(7).contains(w._1) and 0.to(7).contains(w._2) and Set(0, 1).contains(w._3) and walls.exclude(Set(w)).forall(other => not(_conflict(w, other))))
  /// Every player has a path to the selected goal, considering the walls alone.
  val invPaths = not(_someBlocked(pawns, walls))
  /// Every wall is either on the board or still available to its player, and no inventory is negative.
  val invInventory = _PLAYERS.forall(p => remaining.get(p) >= 0) and _PLAYERS.fold(0, (total, p) => total + remaining.get(p)) + walls.size() == 20
  /// The game keeps its selected mode. Allowed choices advance the clockwise turn once, while refusals keep it.
  val invTurns = mode == (if (HILL) "hill" else "classic") and turn == _roundTurn(_plies)
  /// A player wins exactly when their pawn reaches the goal, and at most one player has done so.
  val invVictory = and {
    _PLAYERS.forall(p => (winner == p) iff _goal(p, pawns.get(p))),
    _PLAYERS.filter(p => _goal(p, pawns.get(p))).size() <= 1,
  }
  /// A refused choice changes no pawn, wall, inventory, turn or winner.
  val invRefusal = _refused implies (pawns, walls, remaining, turn, winner) == _before
  /// After a victory, no pawn, wall, inventory, turn or winner changes.
  val invFinality = winner != -1 implies (pawns, walls, remaining, turn, winner) == _finished
}
