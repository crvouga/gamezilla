// Red and Yellow drop discs into seven columns with six places each.
// Places count from left to right, starting at the bottom row.
// A winning alignment ends play before a full board becomes a draw.
// When both players have no connection, they keep their last board and cannot
// drop a disc. Returning online restores that same board and turn.
module connect_four_play {
  type Board = { p0: int, p1: int, p2: int, p3: int, p4: int, p5: int, p6: int, p7: int, p8: int, p9: int, p10: int, p11: int, p12: int, p13: int, p14: int, p15: int, p16: int, p17: int, p18: int, p19: int, p20: int, p21: int, p22: int, p23: int, p24: int, p25: int, p26: int, p27: int, p28: int, p29: int, p30: int, p31: int, p32: int, p33: int, p34: int, p35: int, p36: int, p37: int, p38: int, p39: int, p40: int, p41: int }
  type Columns = { c0: int, c1: int, c2: int, c3: int, c4: int, c5: int, c6: int }
  var board: Board
  var _heights: Columns
  var turn: int
  var result: int
  var drops: List[int]
  var online: bool
  var _atDisconnect: (Board, List[int], int, int)
  pure val _empty = { p0: 0, p1: 0, p2: 0, p3: 0, p4: 0, p5: 0, p6: 0, p7: 0, p8: 0, p9: 0, p10: 0, p11: 0, p12: 0, p13: 0, p14: 0, p15: 0, p16: 0, p17: 0, p18: 0, p19: 0, p20: 0, p21: 0, p22: 0, p23: 0, p24: 0, p25: 0, p26: 0, p27: 0, p28: 0, p29: 0, p30: 0, p31: 0, p32: 0, p33: 0, p34: 0, p35: 0, p36: 0, p37: 0, p38: 0, p39: 0, p40: 0, p41: 0 }
  pure val _zero = { c0: 0, c1: 0, c2: 0, c3: 0, c4: 0, c5: 0, c6: 0 }
  pure def _height(h: Columns, c: int): int = if (c == 0) h.c0 else if (c == 1) h.c1 else if (c == 2) h.c2 else if (c == 3) h.c3 else if (c == 4) h.c4 else if (c == 5) h.c5 else h.c6
  pure def _won(b: Board, p: int): bool = or {
    and { b.p0 == p, b.p1 == p, b.p2 == p, b.p3 == p },
    and { b.p0 == p, b.p7 == p, b.p14 == p, b.p21 == p },
    and { b.p0 == p, b.p8 == p, b.p16 == p, b.p24 == p },
    and { b.p1 == p, b.p2 == p, b.p3 == p, b.p4 == p },
    and { b.p1 == p, b.p8 == p, b.p15 == p, b.p22 == p },
    and { b.p1 == p, b.p9 == p, b.p17 == p, b.p25 == p },
    and { b.p2 == p, b.p3 == p, b.p4 == p, b.p5 == p },
    and { b.p2 == p, b.p9 == p, b.p16 == p, b.p23 == p },
    and { b.p2 == p, b.p10 == p, b.p18 == p, b.p26 == p },
    and { b.p3 == p, b.p4 == p, b.p5 == p, b.p6 == p },
    and { b.p3 == p, b.p10 == p, b.p17 == p, b.p24 == p },
    and { b.p3 == p, b.p11 == p, b.p19 == p, b.p27 == p },
    and { b.p4 == p, b.p11 == p, b.p18 == p, b.p25 == p },
    and { b.p5 == p, b.p12 == p, b.p19 == p, b.p26 == p },
    and { b.p6 == p, b.p13 == p, b.p20 == p, b.p27 == p },
    and { b.p7 == p, b.p8 == p, b.p9 == p, b.p10 == p },
    and { b.p7 == p, b.p14 == p, b.p21 == p, b.p28 == p },
    and { b.p7 == p, b.p15 == p, b.p23 == p, b.p31 == p },
    and { b.p8 == p, b.p9 == p, b.p10 == p, b.p11 == p },
    and { b.p8 == p, b.p15 == p, b.p22 == p, b.p29 == p },
    and { b.p8 == p, b.p16 == p, b.p24 == p, b.p32 == p },
    and { b.p9 == p, b.p10 == p, b.p11 == p, b.p12 == p },
    and { b.p9 == p, b.p16 == p, b.p23 == p, b.p30 == p },
    and { b.p9 == p, b.p17 == p, b.p25 == p, b.p33 == p },
    and { b.p10 == p, b.p11 == p, b.p12 == p, b.p13 == p },
    and { b.p10 == p, b.p17 == p, b.p24 == p, b.p31 == p },
    and { b.p10 == p, b.p18 == p, b.p26 == p, b.p34 == p },
    and { b.p11 == p, b.p18 == p, b.p25 == p, b.p32 == p },
    and { b.p12 == p, b.p19 == p, b.p26 == p, b.p33 == p },
    and { b.p13 == p, b.p20 == p, b.p27 == p, b.p34 == p },
    and { b.p14 == p, b.p15 == p, b.p16 == p, b.p17 == p },
    and { b.p14 == p, b.p21 == p, b.p28 == p, b.p35 == p },
    and { b.p14 == p, b.p22 == p, b.p30 == p, b.p38 == p },
    and { b.p15 == p, b.p16 == p, b.p17 == p, b.p18 == p },
    and { b.p15 == p, b.p22 == p, b.p29 == p, b.p36 == p },
    and { b.p15 == p, b.p23 == p, b.p31 == p, b.p39 == p },
    and { b.p16 == p, b.p17 == p, b.p18 == p, b.p19 == p },
    and { b.p16 == p, b.p23 == p, b.p30 == p, b.p37 == p },
    and { b.p16 == p, b.p24 == p, b.p32 == p, b.p40 == p },
    and { b.p17 == p, b.p18 == p, b.p19 == p, b.p20 == p },
    and { b.p17 == p, b.p24 == p, b.p31 == p, b.p38 == p },
    and { b.p17 == p, b.p25 == p, b.p33 == p, b.p41 == p },
    and { b.p18 == p, b.p25 == p, b.p32 == p, b.p39 == p },
    and { b.p19 == p, b.p26 == p, b.p33 == p, b.p40 == p },
    and { b.p20 == p, b.p27 == p, b.p34 == p, b.p41 == p },
    and { b.p21 == p, b.p22 == p, b.p23 == p, b.p24 == p },
    and { b.p21 == p, b.p15 == p, b.p9 == p, b.p3 == p },
    and { b.p22 == p, b.p23 == p, b.p24 == p, b.p25 == p },
    and { b.p22 == p, b.p16 == p, b.p10 == p, b.p4 == p },
    and { b.p23 == p, b.p24 == p, b.p25 == p, b.p26 == p },
    and { b.p23 == p, b.p17 == p, b.p11 == p, b.p5 == p },
    and { b.p24 == p, b.p25 == p, b.p26 == p, b.p27 == p },
    and { b.p24 == p, b.p18 == p, b.p12 == p, b.p6 == p },
    and { b.p28 == p, b.p29 == p, b.p30 == p, b.p31 == p },
    and { b.p28 == p, b.p22 == p, b.p16 == p, b.p10 == p },
    and { b.p29 == p, b.p30 == p, b.p31 == p, b.p32 == p },
    and { b.p29 == p, b.p23 == p, b.p17 == p, b.p11 == p },
    and { b.p30 == p, b.p31 == p, b.p32 == p, b.p33 == p },
    and { b.p30 == p, b.p24 == p, b.p18 == p, b.p12 == p },
    and { b.p31 == p, b.p32 == p, b.p33 == p, b.p34 == p },
    and { b.p31 == p, b.p25 == p, b.p19 == p, b.p13 == p },
    and { b.p35 == p, b.p36 == p, b.p37 == p, b.p38 == p },
    and { b.p35 == p, b.p29 == p, b.p23 == p, b.p17 == p },
    and { b.p36 == p, b.p37 == p, b.p38 == p, b.p39 == p },
    and { b.p36 == p, b.p30 == p, b.p24 == p, b.p18 == p },
    and { b.p37 == p, b.p38 == p, b.p39 == p, b.p40 == p },
    and { b.p37 == p, b.p31 == p, b.p25 == p, b.p19 == p },
    and { b.p38 == p, b.p39 == p, b.p40 == p, b.p41 == p },
    and { b.p38 == p, b.p32 == p, b.p26 == p, b.p20 == p },
  }
  action init = all {
    board' = _empty, _heights' = _zero, turn' = 1, result' = 0,
    drops' = [], online' = true, _atDisconnect' = (_empty, [], 1, 0),
  }
  /// Drop one disc, or keep the same board if that column cannot be played.
  action drop(column: int): bool =
    if (online and result == 0 and column >= 0 and column < 7 and _height(_heights, column) < 6) {
      val cell = _height(_heights, column) * 7 + column
      val b = { p0: if (cell == 0) turn else board.p0, p1: if (cell == 1) turn else board.p1, p2: if (cell == 2) turn else board.p2, p3: if (cell == 3) turn else board.p3, p4: if (cell == 4) turn else board.p4, p5: if (cell == 5) turn else board.p5, p6: if (cell == 6) turn else board.p6, p7: if (cell == 7) turn else board.p7, p8: if (cell == 8) turn else board.p8, p9: if (cell == 9) turn else board.p9, p10: if (cell == 10) turn else board.p10, p11: if (cell == 11) turn else board.p11, p12: if (cell == 12) turn else board.p12, p13: if (cell == 13) turn else board.p13, p14: if (cell == 14) turn else board.p14, p15: if (cell == 15) turn else board.p15, p16: if (cell == 16) turn else board.p16, p17: if (cell == 17) turn else board.p17, p18: if (cell == 18) turn else board.p18, p19: if (cell == 19) turn else board.p19, p20: if (cell == 20) turn else board.p20, p21: if (cell == 21) turn else board.p21, p22: if (cell == 22) turn else board.p22, p23: if (cell == 23) turn else board.p23, p24: if (cell == 24) turn else board.p24, p25: if (cell == 25) turn else board.p25, p26: if (cell == 26) turn else board.p26, p27: if (cell == 27) turn else board.p27, p28: if (cell == 28) turn else board.p28, p29: if (cell == 29) turn else board.p29, p30: if (cell == 30) turn else board.p30, p31: if (cell == 31) turn else board.p31, p32: if (cell == 32) turn else board.p32, p33: if (cell == 33) turn else board.p33, p34: if (cell == 34) turn else board.p34, p35: if (cell == 35) turn else board.p35, p36: if (cell == 36) turn else board.p36, p37: if (cell == 37) turn else board.p37, p38: if (cell == 38) turn else board.p38, p39: if (cell == 39) turn else board.p39, p40: if (cell == 40) turn else board.p40, p41: if (cell == 41) turn else board.p41 }
      val h = { c0: if (column == 0) _heights.c0 + 1 else _heights.c0, c1: if (column == 1) _heights.c1 + 1 else _heights.c1, c2: if (column == 2) _heights.c2 + 1 else _heights.c2, c3: if (column == 3) _heights.c3 + 1 else _heights.c3, c4: if (column == 4) _heights.c4 + 1 else _heights.c4, c5: if (column == 5) _heights.c5 + 1 else _heights.c5, c6: if (column == 6) _heights.c6 + 1 else _heights.c6 }
      val played = drops.append(column)
      all {
        board' = b, _heights' = h, drops' = played, turn' = 3 - turn,
        online' = online, _atDisconnect' = _atDisconnect,
        result' = if (_won(b, turn)) turn else if (played.length() == 42) 3 else 0,
      }
    } else all { board' = board, _heights' = _heights, turn' = turn, result' = result, drops' = drops, online' = online, _atDisconnect' = _atDisconnect }
  /// Both players lose their connection and keep their last board.
  action loseConnection = all {
    online, online' = false, _atDisconnect' = (board, drops, turn, result),
    board' = board, _heights' = _heights, turn' = turn, result' = result, drops' = drops,
  }
  /// Both players return to the same board and turn.
  action connectionReturns = all {
    not(online), online' = true, _atDisconnect' = _atDisconnect,
    board' = board, _heights' = _heights, turn' = turn, result' = result, drops' = drops,
  }
  action step = any {
    { nondet column = (-1).to(7).oneOf(); drop(column) }, loseConnection, connectionReturns,
  }
  /// Each player takes alternate turns, beginning with Red.
  val invTurn = turn == (if (drops.length() % 2 == 0) 1 else 2)
  /// The board and turn stay unchanged while neither player has a connection.
  val invOfflineBoard = not(online) implies ((board, drops, turn, result) == _atDisconnect)
  /// Bookkeeping: a column holds at most six discs.
  val invCapacity = and { (_heights.c0 >= 0 and _heights.c0 <= 6), (_heights.c1 >= 0 and _heights.c1 <= 6), (_heights.c2 >= 0 and _heights.c2 <= 6), (_heights.c3 >= 0 and _heights.c3 <= 6), (_heights.c4 >= 0 and _heights.c4 <= 6), (_heights.c5 >= 0 and _heights.c5 <= 6), (_heights.c6 >= 0 and _heights.c6 <= 6) }
  /// Bookkeeping: discs cannot float above an empty place.
  val invGravity = and { ((board.p0 != 0) == (0 < _heights.c0)), ((board.p1 != 0) == (0 < _heights.c1)), ((board.p2 != 0) == (0 < _heights.c2)), ((board.p3 != 0) == (0 < _heights.c3)), ((board.p4 != 0) == (0 < _heights.c4)), ((board.p5 != 0) == (0 < _heights.c5)), ((board.p6 != 0) == (0 < _heights.c6)), ((board.p7 != 0) == (1 < _heights.c0)), ((board.p8 != 0) == (1 < _heights.c1)), ((board.p9 != 0) == (1 < _heights.c2)), ((board.p10 != 0) == (1 < _heights.c3)), ((board.p11 != 0) == (1 < _heights.c4)), ((board.p12 != 0) == (1 < _heights.c5)), ((board.p13 != 0) == (1 < _heights.c6)), ((board.p14 != 0) == (2 < _heights.c0)), ((board.p15 != 0) == (2 < _heights.c1)), ((board.p16 != 0) == (2 < _heights.c2)), ((board.p17 != 0) == (2 < _heights.c3)), ((board.p18 != 0) == (2 < _heights.c4)), ((board.p19 != 0) == (2 < _heights.c5)), ((board.p20 != 0) == (2 < _heights.c6)), ((board.p21 != 0) == (3 < _heights.c0)), ((board.p22 != 0) == (3 < _heights.c1)), ((board.p23 != 0) == (3 < _heights.c2)), ((board.p24 != 0) == (3 < _heights.c3)), ((board.p25 != 0) == (3 < _heights.c4)), ((board.p26 != 0) == (3 < _heights.c5)), ((board.p27 != 0) == (3 < _heights.c6)), ((board.p28 != 0) == (4 < _heights.c0)), ((board.p29 != 0) == (4 < _heights.c1)), ((board.p30 != 0) == (4 < _heights.c2)), ((board.p31 != 0) == (4 < _heights.c3)), ((board.p32 != 0) == (4 < _heights.c4)), ((board.p33 != 0) == (4 < _heights.c5)), ((board.p34 != 0) == (4 < _heights.c6)), ((board.p35 != 0) == (5 < _heights.c0)), ((board.p36 != 0) == (5 < _heights.c1)), ((board.p37 != 0) == (5 < _heights.c2)), ((board.p38 != 0) == (5 < _heights.c3)), ((board.p39 != 0) == (5 < _heights.c4)), ((board.p40 != 0) == (5 < _heights.c5)), ((board.p41 != 0) == (5 < _heights.c6)) }
  /// Bookkeeping: every accepted drop adds one disc.
  val invConservation = (_heights.c0 + _heights.c1 + _heights.c2 + _heights.c3 + _heights.c4 + _heights.c5 + _heights.c6) == drops.length()
  /// Bookkeeping: only Red, Yellow, empty and draw have meanings here.
  val invOwnership = and { Set(0, 1, 2, 3).contains(result), Set(0, 1, 2).contains(board.p0), Set(0, 1, 2).contains(board.p1), Set(0, 1, 2).contains(board.p2), Set(0, 1, 2).contains(board.p3), Set(0, 1, 2).contains(board.p4), Set(0, 1, 2).contains(board.p5), Set(0, 1, 2).contains(board.p6), Set(0, 1, 2).contains(board.p7), Set(0, 1, 2).contains(board.p8), Set(0, 1, 2).contains(board.p9), Set(0, 1, 2).contains(board.p10), Set(0, 1, 2).contains(board.p11), Set(0, 1, 2).contains(board.p12), Set(0, 1, 2).contains(board.p13), Set(0, 1, 2).contains(board.p14), Set(0, 1, 2).contains(board.p15), Set(0, 1, 2).contains(board.p16), Set(0, 1, 2).contains(board.p17), Set(0, 1, 2).contains(board.p18), Set(0, 1, 2).contains(board.p19), Set(0, 1, 2).contains(board.p20), Set(0, 1, 2).contains(board.p21), Set(0, 1, 2).contains(board.p22), Set(0, 1, 2).contains(board.p23), Set(0, 1, 2).contains(board.p24), Set(0, 1, 2).contains(board.p25), Set(0, 1, 2).contains(board.p26), Set(0, 1, 2).contains(board.p27), Set(0, 1, 2).contains(board.p28), Set(0, 1, 2).contains(board.p29), Set(0, 1, 2).contains(board.p30), Set(0, 1, 2).contains(board.p31), Set(0, 1, 2).contains(board.p32), Set(0, 1, 2).contains(board.p33), Set(0, 1, 2).contains(board.p34), Set(0, 1, 2).contains(board.p35), Set(0, 1, 2).contains(board.p36), Set(0, 1, 2).contains(board.p37), Set(0, 1, 2).contains(board.p38), Set(0, 1, 2).contains(board.p39), Set(0, 1, 2).contains(board.p40), Set(0, 1, 2).contains(board.p41) }
  /// Bookkeeping: a recorded victory has a winning alignment.
  val invVictory = (result == 1 implies _won(board, 1)) and (result == 2 implies _won(board, 2))
  /// Bookkeeping: a drawn board is full and has no winning alignment.
  val invDraw = result == 3 implies (drops.length() == 42 and not(_won(board, 1)) and not(_won(board, 2)))
  // An unfinished game has no winning alignment yet.
  val _unfinished = result == 0 implies (not(_won(board, 1)) and not(_won(board, 2)))
  pure val _BOARDS = tuples(Set(0, 1, 2), Set(0, 1, 2), Set(0, 1, 2), Set(0, 1, 2), Set(0, 1, 2), Set(0, 1, 2), Set(0, 1, 2), Set(0, 1, 2), Set(0, 1, 2), Set(0, 1, 2), Set(0, 1, 2), Set(0, 1, 2), Set(0, 1, 2), Set(0, 1, 2), Set(0, 1, 2), Set(0, 1, 2), Set(0, 1, 2), Set(0, 1, 2), Set(0, 1, 2), Set(0, 1, 2), Set(0, 1, 2), Set(0, 1, 2), Set(0, 1, 2), Set(0, 1, 2), Set(0, 1, 2), Set(0, 1, 2), Set(0, 1, 2), Set(0, 1, 2), Set(0, 1, 2), Set(0, 1, 2), Set(0, 1, 2), Set(0, 1, 2), Set(0, 1, 2), Set(0, 1, 2), Set(0, 1, 2), Set(0, 1, 2), Set(0, 1, 2), Set(0, 1, 2), Set(0, 1, 2), Set(0, 1, 2), Set(0, 1, 2), Set(0, 1, 2)).map(t => { p0: t._1, p1: t._2, p2: t._3, p3: t._4, p4: t._5, p5: t._6, p6: t._7, p7: t._8, p8: t._9, p9: t._10, p10: t._11, p11: t._12, p12: t._13, p13: t._14, p14: t._15, p15: t._16, p16: t._17, p17: t._18, p18: t._19, p19: t._20, p20: t._21, p21: t._22, p22: t._23, p23: t._24, p24: t._25, p25: t._26, p26: t._27, p27: t._28, p28: t._29, p29: t._30, p30: t._31, p31: t._32, p32: t._33, p33: t._34, p34: t._35, p35: t._36, p36: t._37, p37: t._38, p38: t._39, p39: t._40, p40: t._41, p41: t._42 })
  pure val _COLUMNS = tuples(0.to(6), 0.to(6), 0.to(6), 0.to(6), 0.to(6), 0.to(6), 0.to(6)).map(t => { c0: t._1, c1: t._2, c2: t._3, c3: t._4, c4: t._5, c5: t._6, c6: t._7 })
  pure val _DROPS = 0.to(6).allListsUpTo(42)
  val _inductive = all {
    board.in(_BOARDS), _heights.in(_COLUMNS), drops.in(_DROPS),
    turn.in(Set(1, 2)), result.in(Set(0, 1, 2, 3)), online.in(Set(false, true)),
    _atDisconnect.in(tuples(_BOARDS, _DROPS, Set(1, 2), Set(0, 1, 2, 3))),
    invTurn, invOfflineBoard, invCapacity, invGravity, invConservation,
    invOwnership, invVictory, invDraw, _unfinished,
  }
}
