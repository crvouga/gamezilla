// Red and Yellow drop discs into seven columns with six places each.
// Places count from left to right, starting at the bottom row.
// A winning alignment ends play before a full board becomes a draw.
// When both players have no connection, they keep their last board and cannot
// drop a disc. Returning online restores that same board and turn.
module connect_four_play {
  type Board = (int, int, int, int, int, int, int, int, int, int, int, int, int, int, int, int, int, int, int, int, int, int, int, int, int, int, int, int, int, int, int, int, int, int, int, int, int, int, int, int, int, int)
  type Columns = (int, int, int, int, int, int, int)
  var board: Board
  var _heights: Columns
  var turn: int
  var result: int
  var drops: int
  var _count: int
  var online: bool
  var _boardAtDisconnect: Board
  var _dropsAtDisconnect: int
  var _turnAtDisconnect: int
  var _resultAtDisconnect: int
  var _countAtDisconnect: int
  pure val _empty = (0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0)
  pure val _zero = (0, 0, 0, 0, 0, 0, 0)
  pure def _height(h: Columns, c: int): int = if (c == 0) h._1 else if (c == 1) h._2 else if (c == 2) h._3 else if (c == 3) h._4 else if (c == 4) h._5 else if (c == 5) h._6 else h._7
  pure def _won(b: Board, p: int): bool = or {
    and { b._1 == p, b._2 == p, b._3 == p, b._4 == p },
    and { b._1 == p, b._8 == p, b._15 == p, b._22 == p },
    and { b._1 == p, b._9 == p, b._17 == p, b._25 == p },
    and { b._2 == p, b._3 == p, b._4 == p, b._5 == p },
    and { b._2 == p, b._9 == p, b._16 == p, b._23 == p },
    and { b._2 == p, b._10 == p, b._18 == p, b._26 == p },
    and { b._3 == p, b._4 == p, b._5 == p, b._6 == p },
    and { b._3 == p, b._10 == p, b._17 == p, b._24 == p },
    and { b._3 == p, b._11 == p, b._19 == p, b._27 == p },
    and { b._4 == p, b._5 == p, b._6 == p, b._7 == p },
    and { b._4 == p, b._11 == p, b._18 == p, b._25 == p },
    and { b._4 == p, b._12 == p, b._20 == p, b._28 == p },
    and { b._5 == p, b._12 == p, b._19 == p, b._26 == p },
    and { b._6 == p, b._13 == p, b._20 == p, b._27 == p },
    and { b._7 == p, b._14 == p, b._21 == p, b._28 == p },
    and { b._8 == p, b._9 == p, b._10 == p, b._11 == p },
    and { b._8 == p, b._15 == p, b._22 == p, b._29 == p },
    and { b._8 == p, b._16 == p, b._24 == p, b._32 == p },
    and { b._9 == p, b._10 == p, b._11 == p, b._12 == p },
    and { b._9 == p, b._16 == p, b._23 == p, b._30 == p },
    and { b._9 == p, b._17 == p, b._25 == p, b._33 == p },
    and { b._10 == p, b._11 == p, b._12 == p, b._13 == p },
    and { b._10 == p, b._17 == p, b._24 == p, b._31 == p },
    and { b._10 == p, b._18 == p, b._26 == p, b._34 == p },
    and { b._11 == p, b._12 == p, b._13 == p, b._14 == p },
    and { b._11 == p, b._18 == p, b._25 == p, b._32 == p },
    and { b._11 == p, b._19 == p, b._27 == p, b._35 == p },
    and { b._12 == p, b._19 == p, b._26 == p, b._33 == p },
    and { b._13 == p, b._20 == p, b._27 == p, b._34 == p },
    and { b._14 == p, b._21 == p, b._28 == p, b._35 == p },
    and { b._15 == p, b._16 == p, b._17 == p, b._18 == p },
    and { b._15 == p, b._22 == p, b._29 == p, b._36 == p },
    and { b._15 == p, b._23 == p, b._31 == p, b._39 == p },
    and { b._16 == p, b._17 == p, b._18 == p, b._19 == p },
    and { b._16 == p, b._23 == p, b._30 == p, b._37 == p },
    and { b._16 == p, b._24 == p, b._32 == p, b._40 == p },
    and { b._17 == p, b._18 == p, b._19 == p, b._20 == p },
    and { b._17 == p, b._24 == p, b._31 == p, b._38 == p },
    and { b._17 == p, b._25 == p, b._33 == p, b._41 == p },
    and { b._18 == p, b._19 == p, b._20 == p, b._21 == p },
    and { b._18 == p, b._25 == p, b._32 == p, b._39 == p },
    and { b._18 == p, b._26 == p, b._34 == p, b._42 == p },
    and { b._19 == p, b._26 == p, b._33 == p, b._40 == p },
    and { b._20 == p, b._27 == p, b._34 == p, b._41 == p },
    and { b._21 == p, b._28 == p, b._35 == p, b._42 == p },
    and { b._22 == p, b._23 == p, b._24 == p, b._25 == p },
    and { b._22 == p, b._16 == p, b._10 == p, b._4 == p },
    and { b._23 == p, b._24 == p, b._25 == p, b._26 == p },
    and { b._23 == p, b._17 == p, b._11 == p, b._5 == p },
    and { b._24 == p, b._25 == p, b._26 == p, b._27 == p },
    and { b._24 == p, b._18 == p, b._12 == p, b._6 == p },
    and { b._25 == p, b._26 == p, b._27 == p, b._28 == p },
    and { b._25 == p, b._19 == p, b._13 == p, b._7 == p },
    and { b._29 == p, b._30 == p, b._31 == p, b._32 == p },
    and { b._29 == p, b._23 == p, b._17 == p, b._11 == p },
    and { b._30 == p, b._31 == p, b._32 == p, b._33 == p },
    and { b._30 == p, b._24 == p, b._18 == p, b._12 == p },
    and { b._31 == p, b._32 == p, b._33 == p, b._34 == p },
    and { b._31 == p, b._25 == p, b._19 == p, b._13 == p },
    and { b._32 == p, b._33 == p, b._34 == p, b._35 == p },
    and { b._32 == p, b._26 == p, b._20 == p, b._14 == p },
    and { b._36 == p, b._37 == p, b._38 == p, b._39 == p },
    and { b._36 == p, b._30 == p, b._24 == p, b._18 == p },
    and { b._37 == p, b._38 == p, b._39 == p, b._40 == p },
    and { b._37 == p, b._31 == p, b._25 == p, b._19 == p },
    and { b._38 == p, b._39 == p, b._40 == p, b._41 == p },
    and { b._38 == p, b._32 == p, b._26 == p, b._20 == p },
    and { b._39 == p, b._40 == p, b._41 == p, b._42 == p },
    and { b._39 == p, b._33 == p, b._27 == p, b._21 == p },
  }
  action init = all {
    board' = _empty, _heights' = _zero, turn' = 1, result' = 0,
    drops' = 0, _count' = 0, online' = true, _boardAtDisconnect' = _empty, _dropsAtDisconnect' = 0, _turnAtDisconnect' = 1, _resultAtDisconnect' = 0, _countAtDisconnect' = 0,
  }
  /// Drop one disc, or keep the same board if that column cannot be played.
  action drop(column: int): bool =
    if (online and result == 0 and column >= 0 and column < 7 and _height(_heights, column) < 6) {
      val cell = _height(_heights, column) * 7 + column
      val b = (if (cell == 0) turn else board._1, if (cell == 1) turn else board._2, if (cell == 2) turn else board._3, if (cell == 3) turn else board._4, if (cell == 4) turn else board._5, if (cell == 5) turn else board._6, if (cell == 6) turn else board._7, if (cell == 7) turn else board._8, if (cell == 8) turn else board._9, if (cell == 9) turn else board._10, if (cell == 10) turn else board._11, if (cell == 11) turn else board._12, if (cell == 12) turn else board._13, if (cell == 13) turn else board._14, if (cell == 14) turn else board._15, if (cell == 15) turn else board._16, if (cell == 16) turn else board._17, if (cell == 17) turn else board._18, if (cell == 18) turn else board._19, if (cell == 19) turn else board._20, if (cell == 20) turn else board._21, if (cell == 21) turn else board._22, if (cell == 22) turn else board._23, if (cell == 23) turn else board._24, if (cell == 24) turn else board._25, if (cell == 25) turn else board._26, if (cell == 26) turn else board._27, if (cell == 27) turn else board._28, if (cell == 28) turn else board._29, if (cell == 29) turn else board._30, if (cell == 30) turn else board._31, if (cell == 31) turn else board._32, if (cell == 32) turn else board._33, if (cell == 33) turn else board._34, if (cell == 34) turn else board._35, if (cell == 35) turn else board._36, if (cell == 36) turn else board._37, if (cell == 37) turn else board._38, if (cell == 38) turn else board._39, if (cell == 39) turn else board._40, if (cell == 40) turn else board._41, if (cell == 41) turn else board._42)
      val h = (if (column == 0) _heights._1 + 1 else _heights._1, if (column == 1) _heights._2 + 1 else _heights._2, if (column == 2) _heights._3 + 1 else _heights._3, if (column == 3) _heights._4 + 1 else _heights._4, if (column == 4) _heights._5 + 1 else _heights._5, if (column == 5) _heights._6 + 1 else _heights._6, if (column == 6) _heights._7 + 1 else _heights._7)
      val played = drops * 8 + column + 1
      all {
        board' = b, _heights' = h, drops' = played, _count' = _count + 1, turn' = 3 - turn,
        online' = online, _boardAtDisconnect' = _boardAtDisconnect, _dropsAtDisconnect' = _dropsAtDisconnect, _turnAtDisconnect' = _turnAtDisconnect, _resultAtDisconnect' = _resultAtDisconnect, _countAtDisconnect' = _countAtDisconnect,
        result' = if (_won(b, turn)) turn else if (_count + 1 == 42) 3 else 0,
      }
    } else all { board' = board, _heights' = _heights, turn' = turn, result' = result, drops' = drops, _count' = _count, online' = online, _boardAtDisconnect' = _boardAtDisconnect, _dropsAtDisconnect' = _dropsAtDisconnect, _turnAtDisconnect' = _turnAtDisconnect, _resultAtDisconnect' = _resultAtDisconnect, _countAtDisconnect' = _countAtDisconnect }
  /// Both players lose their connection and keep their last board.
  action loseConnection = all {
    online, online' = false, _boardAtDisconnect' = board, _dropsAtDisconnect' = drops, _turnAtDisconnect' = turn, _resultAtDisconnect' = result, _countAtDisconnect' = _count,
    board' = board, _heights' = _heights, turn' = turn, result' = result, drops' = drops, _count' = _count,
  }
  /// Both players return to the same board and turn.
  action connectionReturns = all {
    not(online), online' = true, _boardAtDisconnect' = _boardAtDisconnect, _dropsAtDisconnect' = _dropsAtDisconnect, _turnAtDisconnect' = _turnAtDisconnect, _resultAtDisconnect' = _resultAtDisconnect, _countAtDisconnect' = _countAtDisconnect,
    board' = board, _heights' = _heights, turn' = turn, result' = result, drops' = drops, _count' = _count,
  }
  action step = any {
    { nondet column = (-1).to(7).oneOf(); drop(column) }, loseConnection, connectionReturns,
  }
  /// Each player takes alternate turns, beginning with Red.
  val invTurn = turn == (if (_count % 2 == 0) 1 else 2)
  /// The board and turn stay unchanged while neither player has a connection.
  val invOfflineBoard = not(online) implies ((board, drops, turn, result, _count) == (_boardAtDisconnect, _dropsAtDisconnect, _turnAtDisconnect, _resultAtDisconnect, _countAtDisconnect))
  /// Bookkeeping: a column holds at most six discs.
  val invCapacity = and { (_heights._1 >= 0 and _heights._1 <= 6), (_heights._2 >= 0 and _heights._2 <= 6), (_heights._3 >= 0 and _heights._3 <= 6), (_heights._4 >= 0 and _heights._4 <= 6), (_heights._5 >= 0 and _heights._5 <= 6), (_heights._6 >= 0 and _heights._6 <= 6), (_heights._7 >= 0 and _heights._7 <= 6) }
  /// Bookkeeping: discs cannot float above an empty place.
  val invGravity = and { ((board._1 != 0) == (0 < _heights._1)), ((board._2 != 0) == (0 < _heights._2)), ((board._3 != 0) == (0 < _heights._3)), ((board._4 != 0) == (0 < _heights._4)), ((board._5 != 0) == (0 < _heights._5)), ((board._6 != 0) == (0 < _heights._6)), ((board._7 != 0) == (0 < _heights._7)), ((board._8 != 0) == (1 < _heights._1)), ((board._9 != 0) == (1 < _heights._2)), ((board._10 != 0) == (1 < _heights._3)), ((board._11 != 0) == (1 < _heights._4)), ((board._12 != 0) == (1 < _heights._5)), ((board._13 != 0) == (1 < _heights._6)), ((board._14 != 0) == (1 < _heights._7)), ((board._15 != 0) == (2 < _heights._1)), ((board._16 != 0) == (2 < _heights._2)), ((board._17 != 0) == (2 < _heights._3)), ((board._18 != 0) == (2 < _heights._4)), ((board._19 != 0) == (2 < _heights._5)), ((board._20 != 0) == (2 < _heights._6)), ((board._21 != 0) == (2 < _heights._7)), ((board._22 != 0) == (3 < _heights._1)), ((board._23 != 0) == (3 < _heights._2)), ((board._24 != 0) == (3 < _heights._3)), ((board._25 != 0) == (3 < _heights._4)), ((board._26 != 0) == (3 < _heights._5)), ((board._27 != 0) == (3 < _heights._6)), ((board._28 != 0) == (3 < _heights._7)), ((board._29 != 0) == (4 < _heights._1)), ((board._30 != 0) == (4 < _heights._2)), ((board._31 != 0) == (4 < _heights._3)), ((board._32 != 0) == (4 < _heights._4)), ((board._33 != 0) == (4 < _heights._5)), ((board._34 != 0) == (4 < _heights._6)), ((board._35 != 0) == (4 < _heights._7)), ((board._36 != 0) == (5 < _heights._1)), ((board._37 != 0) == (5 < _heights._2)), ((board._38 != 0) == (5 < _heights._3)), ((board._39 != 0) == (5 < _heights._4)), ((board._40 != 0) == (5 < _heights._5)), ((board._41 != 0) == (5 < _heights._6)), ((board._42 != 0) == (5 < _heights._7)) }
  /// Bookkeeping: every accepted drop adds one disc.
  val invConservation = (_heights._1 + _heights._2 + _heights._3 + _heights._4 + _heights._5 + _heights._6 + _heights._7) == _count
  /// Bookkeeping: only Red, Yellow, empty and draw have meanings here.
  val invOwnership = and { Set(0, 1, 2, 3).contains(result), Set(0, 1, 2).contains(board._1), Set(0, 1, 2).contains(board._2), Set(0, 1, 2).contains(board._3), Set(0, 1, 2).contains(board._4), Set(0, 1, 2).contains(board._5), Set(0, 1, 2).contains(board._6), Set(0, 1, 2).contains(board._7), Set(0, 1, 2).contains(board._8), Set(0, 1, 2).contains(board._9), Set(0, 1, 2).contains(board._10), Set(0, 1, 2).contains(board._11), Set(0, 1, 2).contains(board._12), Set(0, 1, 2).contains(board._13), Set(0, 1, 2).contains(board._14), Set(0, 1, 2).contains(board._15), Set(0, 1, 2).contains(board._16), Set(0, 1, 2).contains(board._17), Set(0, 1, 2).contains(board._18), Set(0, 1, 2).contains(board._19), Set(0, 1, 2).contains(board._20), Set(0, 1, 2).contains(board._21), Set(0, 1, 2).contains(board._22), Set(0, 1, 2).contains(board._23), Set(0, 1, 2).contains(board._24), Set(0, 1, 2).contains(board._25), Set(0, 1, 2).contains(board._26), Set(0, 1, 2).contains(board._27), Set(0, 1, 2).contains(board._28), Set(0, 1, 2).contains(board._29), Set(0, 1, 2).contains(board._30), Set(0, 1, 2).contains(board._31), Set(0, 1, 2).contains(board._32), Set(0, 1, 2).contains(board._33), Set(0, 1, 2).contains(board._34), Set(0, 1, 2).contains(board._35), Set(0, 1, 2).contains(board._36), Set(0, 1, 2).contains(board._37), Set(0, 1, 2).contains(board._38), Set(0, 1, 2).contains(board._39), Set(0, 1, 2).contains(board._40), Set(0, 1, 2).contains(board._41), Set(0, 1, 2).contains(board._42) }
  /// Bookkeeping: an empty history means no disc has been dropped.
  val invHistory = drops >= 0 and ((drops == 0) == (_count == 0))
  /// Bookkeeping: a recorded victory has a winning alignment.
  val invVictory = (result == 1 implies _won(board, 1)) and (result == 2 implies _won(board, 2))
  /// Bookkeeping: a drawn board is full and has no winning alignment.
  val invDraw = result == 3 implies (_count == 42 and not(_won(board, 1)) and not(_won(board, 2)))
  // An unfinished game has no winning alignment yet.
  val _unfinished = result == 0 implies (not(_won(board, 1)) and not(_won(board, 2)))
  pure val _BOARDS = tuples(Set(0, 1, 2), Set(0, 1, 2), Set(0, 1, 2), Set(0, 1, 2), Set(0, 1, 2), Set(0, 1, 2), Set(0, 1, 2), Set(0, 1, 2), Set(0, 1, 2), Set(0, 1, 2), Set(0, 1, 2), Set(0, 1, 2), Set(0, 1, 2), Set(0, 1, 2), Set(0, 1, 2), Set(0, 1, 2), Set(0, 1, 2), Set(0, 1, 2), Set(0, 1, 2), Set(0, 1, 2), Set(0, 1, 2), Set(0, 1, 2), Set(0, 1, 2), Set(0, 1, 2), Set(0, 1, 2), Set(0, 1, 2), Set(0, 1, 2), Set(0, 1, 2), Set(0, 1, 2), Set(0, 1, 2), Set(0, 1, 2), Set(0, 1, 2), Set(0, 1, 2), Set(0, 1, 2), Set(0, 1, 2), Set(0, 1, 2), Set(0, 1, 2), Set(0, 1, 2), Set(0, 1, 2), Set(0, 1, 2), Set(0, 1, 2), Set(0, 1, 2))
  pure val _COLUMNS = tuples(0.to(6), 0.to(6), 0.to(6), 0.to(6), 0.to(6), 0.to(6), 0.to(6))
  val _inductive = all {
    board.in(_BOARDS), _heights.in(_COLUMNS), drops.in(Nat), _count.in(0.to(42)),
    turn.in(Set(1, 2)), result.in(Set(0, 1, 2, 3)), online.in(Set(false, true)),
    _boardAtDisconnect.in(_BOARDS), _dropsAtDisconnect.in(Nat),
    _turnAtDisconnect.in(Set(1, 2)), _resultAtDisconnect.in(Set(0, 1, 2, 3)), _countAtDisconnect.in(0.to(42)),
    invTurn, invOfflineBoard, invCapacity, invGravity, invConservation,
    invOwnership, invHistory, invVictory, invDraw, _unfinished,
  }
}
