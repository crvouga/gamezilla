// Red and Yellow drop discs into seven columns with six places each.
// Places count from left to right, starting at the bottom row.
// A winning alignment ends play before a full board becomes a draw.
// When both players have no connection, they keep their last board and cannot
// drop a disc. Returning online restores that same board and turn.
module connect_four_play {
  type Board = int -> int
  type Columns = int -> int
  var board: Board
  var _heights: Columns
  var turn: int
  var result: int
  var drops: int
  var _count: int
  var online: bool
  var _atDisconnect: (Board, int, int, int, int)
  pure val _empty = 0.to(41).mapBy(_ => 0)
  pure val _zero = 0.to(6).mapBy(_ => 0)
  pure def _height(h: Columns, c: int): int = h.get(c)
  pure def _won(b: Board, p: int): bool = or {
    and { b.get(0) == p, b.get(1) == p, b.get(2) == p, b.get(3) == p },
    and { b.get(0) == p, b.get(7) == p, b.get(14) == p, b.get(21) == p },
    and { b.get(0) == p, b.get(8) == p, b.get(16) == p, b.get(24) == p },
    and { b.get(1) == p, b.get(2) == p, b.get(3) == p, b.get(4) == p },
    and { b.get(1) == p, b.get(8) == p, b.get(15) == p, b.get(22) == p },
    and { b.get(1) == p, b.get(9) == p, b.get(17) == p, b.get(25) == p },
    and { b.get(2) == p, b.get(3) == p, b.get(4) == p, b.get(5) == p },
    and { b.get(2) == p, b.get(9) == p, b.get(16) == p, b.get(23) == p },
    and { b.get(2) == p, b.get(10) == p, b.get(18) == p, b.get(26) == p },
    and { b.get(3) == p, b.get(4) == p, b.get(5) == p, b.get(6) == p },
    and { b.get(3) == p, b.get(10) == p, b.get(17) == p, b.get(24) == p },
    and { b.get(3) == p, b.get(11) == p, b.get(19) == p, b.get(27) == p },
    and { b.get(4) == p, b.get(11) == p, b.get(18) == p, b.get(25) == p },
    and { b.get(5) == p, b.get(12) == p, b.get(19) == p, b.get(26) == p },
    and { b.get(6) == p, b.get(13) == p, b.get(20) == p, b.get(27) == p },
    and { b.get(7) == p, b.get(8) == p, b.get(9) == p, b.get(10) == p },
    and { b.get(7) == p, b.get(14) == p, b.get(21) == p, b.get(28) == p },
    and { b.get(7) == p, b.get(15) == p, b.get(23) == p, b.get(31) == p },
    and { b.get(8) == p, b.get(9) == p, b.get(10) == p, b.get(11) == p },
    and { b.get(8) == p, b.get(15) == p, b.get(22) == p, b.get(29) == p },
    and { b.get(8) == p, b.get(16) == p, b.get(24) == p, b.get(32) == p },
    and { b.get(9) == p, b.get(10) == p, b.get(11) == p, b.get(12) == p },
    and { b.get(9) == p, b.get(16) == p, b.get(23) == p, b.get(30) == p },
    and { b.get(9) == p, b.get(17) == p, b.get(25) == p, b.get(33) == p },
    and { b.get(10) == p, b.get(11) == p, b.get(12) == p, b.get(13) == p },
    and { b.get(10) == p, b.get(17) == p, b.get(24) == p, b.get(31) == p },
    and { b.get(10) == p, b.get(18) == p, b.get(26) == p, b.get(34) == p },
    and { b.get(11) == p, b.get(18) == p, b.get(25) == p, b.get(32) == p },
    and { b.get(12) == p, b.get(19) == p, b.get(26) == p, b.get(33) == p },
    and { b.get(13) == p, b.get(20) == p, b.get(27) == p, b.get(34) == p },
    and { b.get(14) == p, b.get(15) == p, b.get(16) == p, b.get(17) == p },
    and { b.get(14) == p, b.get(21) == p, b.get(28) == p, b.get(35) == p },
    and { b.get(14) == p, b.get(22) == p, b.get(30) == p, b.get(38) == p },
    and { b.get(15) == p, b.get(16) == p, b.get(17) == p, b.get(18) == p },
    and { b.get(15) == p, b.get(22) == p, b.get(29) == p, b.get(36) == p },
    and { b.get(15) == p, b.get(23) == p, b.get(31) == p, b.get(39) == p },
    and { b.get(16) == p, b.get(17) == p, b.get(18) == p, b.get(19) == p },
    and { b.get(16) == p, b.get(23) == p, b.get(30) == p, b.get(37) == p },
    and { b.get(16) == p, b.get(24) == p, b.get(32) == p, b.get(40) == p },
    and { b.get(17) == p, b.get(18) == p, b.get(19) == p, b.get(20) == p },
    and { b.get(17) == p, b.get(24) == p, b.get(31) == p, b.get(38) == p },
    and { b.get(17) == p, b.get(25) == p, b.get(33) == p, b.get(41) == p },
    and { b.get(18) == p, b.get(25) == p, b.get(32) == p, b.get(39) == p },
    and { b.get(19) == p, b.get(26) == p, b.get(33) == p, b.get(40) == p },
    and { b.get(20) == p, b.get(27) == p, b.get(34) == p, b.get(41) == p },
    and { b.get(21) == p, b.get(22) == p, b.get(23) == p, b.get(24) == p },
    and { b.get(21) == p, b.get(15) == p, b.get(9) == p, b.get(3) == p },
    and { b.get(22) == p, b.get(23) == p, b.get(24) == p, b.get(25) == p },
    and { b.get(22) == p, b.get(16) == p, b.get(10) == p, b.get(4) == p },
    and { b.get(23) == p, b.get(24) == p, b.get(25) == p, b.get(26) == p },
    and { b.get(23) == p, b.get(17) == p, b.get(11) == p, b.get(5) == p },
    and { b.get(24) == p, b.get(25) == p, b.get(26) == p, b.get(27) == p },
    and { b.get(24) == p, b.get(18) == p, b.get(12) == p, b.get(6) == p },
    and { b.get(28) == p, b.get(29) == p, b.get(30) == p, b.get(31) == p },
    and { b.get(28) == p, b.get(22) == p, b.get(16) == p, b.get(10) == p },
    and { b.get(29) == p, b.get(30) == p, b.get(31) == p, b.get(32) == p },
    and { b.get(29) == p, b.get(23) == p, b.get(17) == p, b.get(11) == p },
    and { b.get(30) == p, b.get(31) == p, b.get(32) == p, b.get(33) == p },
    and { b.get(30) == p, b.get(24) == p, b.get(18) == p, b.get(12) == p },
    and { b.get(31) == p, b.get(32) == p, b.get(33) == p, b.get(34) == p },
    and { b.get(31) == p, b.get(25) == p, b.get(19) == p, b.get(13) == p },
    and { b.get(35) == p, b.get(36) == p, b.get(37) == p, b.get(38) == p },
    and { b.get(35) == p, b.get(29) == p, b.get(23) == p, b.get(17) == p },
    and { b.get(36) == p, b.get(37) == p, b.get(38) == p, b.get(39) == p },
    and { b.get(36) == p, b.get(30) == p, b.get(24) == p, b.get(18) == p },
    and { b.get(37) == p, b.get(38) == p, b.get(39) == p, b.get(40) == p },
    and { b.get(37) == p, b.get(31) == p, b.get(25) == p, b.get(19) == p },
    and { b.get(38) == p, b.get(39) == p, b.get(40) == p, b.get(41) == p },
    and { b.get(38) == p, b.get(32) == p, b.get(26) == p, b.get(20) == p },
  }
  action init = all {
    board' = _empty, _heights' = _zero, turn' = 1, result' = 0,
    drops' = 0, _count' = 0, online' = true, _atDisconnect' = (_empty, 0, 1, 0, 0),
  }
  /// Drop one disc, or keep the same board if that column cannot be played.
  action drop(column: int): bool =
    if (online and result == 0 and column >= 0 and column < 7 and _height(_heights, column) < 6) {
      val cell = _height(_heights, column) * 7 + column
      val b = board.put(cell, turn)
      val h = _heights.put(column, _heights.get(column) + 1)
      val played = drops * 8 + column + 1
      all {
        board' = b, _heights' = h, drops' = played, _count' = _count + 1, turn' = 3 - turn,
        online' = online, _atDisconnect' = _atDisconnect,
        result' = if (_won(b, turn)) turn else if (_count + 1 == 42) 3 else 0,
      }
    } else all { board' = board, _heights' = _heights, turn' = turn, result' = result, drops' = drops, _count' = _count, online' = online, _atDisconnect' = _atDisconnect }
  /// Both players lose their connection and keep their last board.
  action loseConnection = all {
    online, online' = false, _atDisconnect' = (board, drops, turn, result, _count),
    board' = board, _heights' = _heights, turn' = turn, result' = result, drops' = drops, _count' = _count,
  }
  /// Both players return to the same board and turn.
  action connectionReturns = all {
    not(online), online' = true, _atDisconnect' = _atDisconnect,
    board' = board, _heights' = _heights, turn' = turn, result' = result, drops' = drops, _count' = _count,
  }
  action step = any {
    { nondet column = (-1).to(7).oneOf(); drop(column) }, loseConnection, connectionReturns,
  }
  /// Each player takes alternate turns, beginning with Red.
  val invTurn = turn == (if (_count % 2 == 0) 1 else 2)
  /// The board and turn stay unchanged while neither player has a connection.
  val invOfflineBoard = not(online) implies ((board, drops, turn, result, _count) == _atDisconnect)
  /// Bookkeeping: a column holds at most six discs.
  val invCapacity = and { (_heights.get(0) >= 0 and _heights.get(0) <= 6), (_heights.get(1) >= 0 and _heights.get(1) <= 6), (_heights.get(2) >= 0 and _heights.get(2) <= 6), (_heights.get(3) >= 0 and _heights.get(3) <= 6), (_heights.get(4) >= 0 and _heights.get(4) <= 6), (_heights.get(5) >= 0 and _heights.get(5) <= 6), (_heights.get(6) >= 0 and _heights.get(6) <= 6) }
  /// Bookkeeping: discs cannot float above an empty place.
  val invGravity = and { ((board.get(0) != 0) == (0 < _heights.get(0))), ((board.get(1) != 0) == (0 < _heights.get(1))), ((board.get(2) != 0) == (0 < _heights.get(2))), ((board.get(3) != 0) == (0 < _heights.get(3))), ((board.get(4) != 0) == (0 < _heights.get(4))), ((board.get(5) != 0) == (0 < _heights.get(5))), ((board.get(6) != 0) == (0 < _heights.get(6))), ((board.get(7) != 0) == (1 < _heights.get(0))), ((board.get(8) != 0) == (1 < _heights.get(1))), ((board.get(9) != 0) == (1 < _heights.get(2))), ((board.get(10) != 0) == (1 < _heights.get(3))), ((board.get(11) != 0) == (1 < _heights.get(4))), ((board.get(12) != 0) == (1 < _heights.get(5))), ((board.get(13) != 0) == (1 < _heights.get(6))), ((board.get(14) != 0) == (2 < _heights.get(0))), ((board.get(15) != 0) == (2 < _heights.get(1))), ((board.get(16) != 0) == (2 < _heights.get(2))), ((board.get(17) != 0) == (2 < _heights.get(3))), ((board.get(18) != 0) == (2 < _heights.get(4))), ((board.get(19) != 0) == (2 < _heights.get(5))), ((board.get(20) != 0) == (2 < _heights.get(6))), ((board.get(21) != 0) == (3 < _heights.get(0))), ((board.get(22) != 0) == (3 < _heights.get(1))), ((board.get(23) != 0) == (3 < _heights.get(2))), ((board.get(24) != 0) == (3 < _heights.get(3))), ((board.get(25) != 0) == (3 < _heights.get(4))), ((board.get(26) != 0) == (3 < _heights.get(5))), ((board.get(27) != 0) == (3 < _heights.get(6))), ((board.get(28) != 0) == (4 < _heights.get(0))), ((board.get(29) != 0) == (4 < _heights.get(1))), ((board.get(30) != 0) == (4 < _heights.get(2))), ((board.get(31) != 0) == (4 < _heights.get(3))), ((board.get(32) != 0) == (4 < _heights.get(4))), ((board.get(33) != 0) == (4 < _heights.get(5))), ((board.get(34) != 0) == (4 < _heights.get(6))), ((board.get(35) != 0) == (5 < _heights.get(0))), ((board.get(36) != 0) == (5 < _heights.get(1))), ((board.get(37) != 0) == (5 < _heights.get(2))), ((board.get(38) != 0) == (5 < _heights.get(3))), ((board.get(39) != 0) == (5 < _heights.get(4))), ((board.get(40) != 0) == (5 < _heights.get(5))), ((board.get(41) != 0) == (5 < _heights.get(6))) }
  /// Bookkeeping: every accepted drop adds one disc.
  val invConservation = (_heights.get(0) + _heights.get(1) + _heights.get(2) + _heights.get(3) + _heights.get(4) + _heights.get(5) + _heights.get(6)) == _count
  /// Bookkeeping: only Red, Yellow, empty and draw have meanings here.
  val invOwnership = and { Set(0, 1, 2, 3).contains(result), Set(0, 1, 2).contains(board.get(0)), Set(0, 1, 2).contains(board.get(1)), Set(0, 1, 2).contains(board.get(2)), Set(0, 1, 2).contains(board.get(3)), Set(0, 1, 2).contains(board.get(4)), Set(0, 1, 2).contains(board.get(5)), Set(0, 1, 2).contains(board.get(6)), Set(0, 1, 2).contains(board.get(7)), Set(0, 1, 2).contains(board.get(8)), Set(0, 1, 2).contains(board.get(9)), Set(0, 1, 2).contains(board.get(10)), Set(0, 1, 2).contains(board.get(11)), Set(0, 1, 2).contains(board.get(12)), Set(0, 1, 2).contains(board.get(13)), Set(0, 1, 2).contains(board.get(14)), Set(0, 1, 2).contains(board.get(15)), Set(0, 1, 2).contains(board.get(16)), Set(0, 1, 2).contains(board.get(17)), Set(0, 1, 2).contains(board.get(18)), Set(0, 1, 2).contains(board.get(19)), Set(0, 1, 2).contains(board.get(20)), Set(0, 1, 2).contains(board.get(21)), Set(0, 1, 2).contains(board.get(22)), Set(0, 1, 2).contains(board.get(23)), Set(0, 1, 2).contains(board.get(24)), Set(0, 1, 2).contains(board.get(25)), Set(0, 1, 2).contains(board.get(26)), Set(0, 1, 2).contains(board.get(27)), Set(0, 1, 2).contains(board.get(28)), Set(0, 1, 2).contains(board.get(29)), Set(0, 1, 2).contains(board.get(30)), Set(0, 1, 2).contains(board.get(31)), Set(0, 1, 2).contains(board.get(32)), Set(0, 1, 2).contains(board.get(33)), Set(0, 1, 2).contains(board.get(34)), Set(0, 1, 2).contains(board.get(35)), Set(0, 1, 2).contains(board.get(36)), Set(0, 1, 2).contains(board.get(37)), Set(0, 1, 2).contains(board.get(38)), Set(0, 1, 2).contains(board.get(39)), Set(0, 1, 2).contains(board.get(40)), Set(0, 1, 2).contains(board.get(41)) }
  /// Bookkeeping: an empty history means no disc has been dropped.
  val invHistory = drops >= 0 and ((drops == 0) == (_count == 0))
  /// Bookkeeping: a recorded victory has a winning alignment.
  val invVictory = (result == 1 implies _won(board, 1)) and (result == 2 implies _won(board, 2))
  /// Bookkeeping: a drawn board is full and has no winning alignment.
  val invDraw = result == 3 implies (_count == 42 and not(_won(board, 1)) and not(_won(board, 2)))
  // An unfinished game has no winning alignment yet.
  val _unfinished = result == 0 implies (not(_won(board, 1)) and not(_won(board, 2)))
  pure val _BOARDS = 0.to(41).setOfMaps(Set(0, 1, 2))
  pure val _COLUMNS = 0.to(6).setOfMaps(0.to(6))
  val _inductive = all {
    board.in(_BOARDS), _heights.in(_COLUMNS), drops.in(Nat), _count.in(0.to(42)),
    turn.in(Set(1, 2)), result.in(Set(0, 1, 2, 3)), online.in(Set(false, true)),
    _atDisconnect.in(tuples(_BOARDS, Nat, Set(1, 2), Set(0, 1, 2, 3), 0.to(42))),
    invTurn, invOfflineBoard, invCapacity, invGravity, invConservation,
    invOwnership, invHistory, invVictory, invDraw, _unfinished,
  }
}
