// Red and Yellow drop discs into seven columns with six places each.
// Places count from left to right, starting at the bottom row.
// A winning alignment ends play before a full board becomes a draw.
// When both players have no connection, they keep their last board and cannot
// drop a disc. Returning online restores that same board and turn.
module connect_four_play {
  type Board = (int, int, int, int, int, int, int, int, int, int, int, int, int, int, int, int, int, int, int, int, int, int, int, int, int, int, int, int, int, int, int, int, int, int, int, int, int, int, int, int, int, int)
  type Columns = (int, int, int, int, int, int, int)
  var _p0: int
  var _p1: int
  var _p2: int
  var _p3: int
  var _p4: int
  var _p5: int
  var _p6: int
  var _p7: int
  var _p8: int
  var _p9: int
  var _p10: int
  var _p11: int
  var _p12: int
  var _p13: int
  var _p14: int
  var _p15: int
  var _p16: int
  var _p17: int
  var _p18: int
  var _p19: int
  var _p20: int
  var _p21: int
  var _p22: int
  var _p23: int
  var _p24: int
  var _p25: int
  var _p26: int
  var _p27: int
  var _p28: int
  var _p29: int
  var _p30: int
  var _p31: int
  var _p32: int
  var _p33: int
  var _p34: int
  var _p35: int
  var _p36: int
  var _p37: int
  var _p38: int
  var _p39: int
  var _p40: int
  var _p41: int
  var _h0: int
  var _h1: int
  var _h2: int
  var _h3: int
  var _h4: int
  var _h5: int
  var _h6: int
  var turn: int
  var result: int
  var drops: int
  var _count: int
  var online: bool
  var _savedP0: int
  var _savedP1: int
  var _savedP2: int
  var _savedP3: int
  var _savedP4: int
  var _savedP5: int
  var _savedP6: int
  var _savedP7: int
  var _savedP8: int
  var _savedP9: int
  var _savedP10: int
  var _savedP11: int
  var _savedP12: int
  var _savedP13: int
  var _savedP14: int
  var _savedP15: int
  var _savedP16: int
  var _savedP17: int
  var _savedP18: int
  var _savedP19: int
  var _savedP20: int
  var _savedP21: int
  var _savedP22: int
  var _savedP23: int
  var _savedP24: int
  var _savedP25: int
  var _savedP26: int
  var _savedP27: int
  var _savedP28: int
  var _savedP29: int
  var _savedP30: int
  var _savedP31: int
  var _savedP32: int
  var _savedP33: int
  var _savedP34: int
  var _savedP35: int
  var _savedP36: int
  var _savedP37: int
  var _savedP38: int
  var _savedP39: int
  var _savedP40: int
  var _savedP41: int
  var _dropsAtDisconnect: int
  var _turnAtDisconnect: int
  var _resultAtDisconnect: int
  var _countAtDisconnect: int
  val board = (_p0, _p1, _p2, _p3, _p4, _p5, _p6, _p7, _p8, _p9, _p10, _p11, _p12, _p13, _p14, _p15, _p16, _p17, _p18, _p19, _p20, _p21, _p22, _p23, _p24, _p25, _p26, _p27, _p28, _p29, _p30, _p31, _p32, _p33, _p34, _p35, _p36, _p37, _p38, _p39, _p40, _p41)
  val _heights = (_h0, _h1, _h2, _h3, _h4, _h5, _h6)
  val _boardAtDisconnect = (_savedP0, _savedP1, _savedP2, _savedP3, _savedP4, _savedP5, _savedP6, _savedP7, _savedP8, _savedP9, _savedP10, _savedP11, _savedP12, _savedP13, _savedP14, _savedP15, _savedP16, _savedP17, _savedP18, _savedP19, _savedP20, _savedP21, _savedP22, _savedP23, _savedP24, _savedP25, _savedP26, _savedP27, _savedP28, _savedP29, _savedP30, _savedP31, _savedP32, _savedP33, _savedP34, _savedP35, _savedP36, _savedP37, _savedP38, _savedP39, _savedP40, _savedP41)
  pure val _empty = (0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0)
  pure val _zero = (0, 0, 0, 0, 0, 0, 0)
  pure def _height(h: Columns, c: int): int = if (c == 0) h._1 else if (c == 1) h._2 else if (c == 2) h._3 else if (c == 3) h._4 else if (c == 4) h._5 else if (c == 5) h._6 else h._7
  pure def _won(position: Board, p: int): bool = {
    pure val b: Board = position
    pure val _d0: int = b._1
    pure val _d1: int = b._2
    pure val _d2: int = b._3
    pure val _d3: int = b._4
    pure val _d4: int = b._5
    pure val _d5: int = b._6
    pure val _d6: int = b._7
    pure val _d7: int = b._8
    pure val _d8: int = b._9
    pure val _d9: int = b._10
    pure val _d10: int = b._11
    pure val _d11: int = b._12
    pure val _d12: int = b._13
    pure val _d13: int = b._14
    pure val _d14: int = b._15
    pure val _d15: int = b._16
    pure val _d16: int = b._17
    pure val _d17: int = b._18
    pure val _d18: int = b._19
    pure val _d19: int = b._20
    pure val _d20: int = b._21
    pure val _d21: int = b._22
    pure val _d22: int = b._23
    pure val _d23: int = b._24
    pure val _d24: int = b._25
    pure val _d25: int = b._26
    pure val _d26: int = b._27
    pure val _d27: int = b._28
    pure val _d28: int = b._29
    pure val _d29: int = b._30
    pure val _d30: int = b._31
    pure val _d31: int = b._32
    pure val _d32: int = b._33
    pure val _d33: int = b._34
    pure val _d34: int = b._35
    pure val _d35: int = b._36
    pure val _d36: int = b._37
    pure val _d37: int = b._38
    pure val _d38: int = b._39
    pure val _d39: int = b._40
    pure val _d40: int = b._41
    pure val _d41: int = b._42
    or {
    and { _d0 == p, _d1 == p, _d2 == p, _d3 == p },
    and { _d0 == p, _d7 == p, _d14 == p, _d21 == p },
    and { _d0 == p, _d8 == p, _d16 == p, _d24 == p },
    and { _d1 == p, _d2 == p, _d3 == p, _d4 == p },
    and { _d1 == p, _d8 == p, _d15 == p, _d22 == p },
    and { _d1 == p, _d9 == p, _d17 == p, _d25 == p },
    and { _d2 == p, _d3 == p, _d4 == p, _d5 == p },
    and { _d2 == p, _d9 == p, _d16 == p, _d23 == p },
    and { _d2 == p, _d10 == p, _d18 == p, _d26 == p },
    and { _d3 == p, _d4 == p, _d5 == p, _d6 == p },
    and { _d3 == p, _d10 == p, _d17 == p, _d24 == p },
    and { _d3 == p, _d11 == p, _d19 == p, _d27 == p },
    and { _d4 == p, _d11 == p, _d18 == p, _d25 == p },
    and { _d5 == p, _d12 == p, _d19 == p, _d26 == p },
    and { _d6 == p, _d13 == p, _d20 == p, _d27 == p },
    and { _d7 == p, _d8 == p, _d9 == p, _d10 == p },
    and { _d7 == p, _d14 == p, _d21 == p, _d28 == p },
    and { _d7 == p, _d15 == p, _d23 == p, _d31 == p },
    and { _d8 == p, _d9 == p, _d10 == p, _d11 == p },
    and { _d8 == p, _d15 == p, _d22 == p, _d29 == p },
    and { _d8 == p, _d16 == p, _d24 == p, _d32 == p },
    and { _d9 == p, _d10 == p, _d11 == p, _d12 == p },
    and { _d9 == p, _d16 == p, _d23 == p, _d30 == p },
    and { _d9 == p, _d17 == p, _d25 == p, _d33 == p },
    and { _d10 == p, _d11 == p, _d12 == p, _d13 == p },
    and { _d10 == p, _d17 == p, _d24 == p, _d31 == p },
    and { _d10 == p, _d18 == p, _d26 == p, _d34 == p },
    and { _d11 == p, _d18 == p, _d25 == p, _d32 == p },
    and { _d12 == p, _d19 == p, _d26 == p, _d33 == p },
    and { _d13 == p, _d20 == p, _d27 == p, _d34 == p },
    and { _d14 == p, _d15 == p, _d16 == p, _d17 == p },
    and { _d14 == p, _d21 == p, _d28 == p, _d35 == p },
    and { _d14 == p, _d22 == p, _d30 == p, _d38 == p },
    and { _d15 == p, _d16 == p, _d17 == p, _d18 == p },
    and { _d15 == p, _d22 == p, _d29 == p, _d36 == p },
    and { _d15 == p, _d23 == p, _d31 == p, _d39 == p },
    and { _d16 == p, _d17 == p, _d18 == p, _d19 == p },
    and { _d16 == p, _d23 == p, _d30 == p, _d37 == p },
    and { _d16 == p, _d24 == p, _d32 == p, _d40 == p },
    and { _d17 == p, _d18 == p, _d19 == p, _d20 == p },
    and { _d17 == p, _d24 == p, _d31 == p, _d38 == p },
    and { _d17 == p, _d25 == p, _d33 == p, _d41 == p },
    and { _d18 == p, _d25 == p, _d32 == p, _d39 == p },
    and { _d19 == p, _d26 == p, _d33 == p, _d40 == p },
    and { _d20 == p, _d27 == p, _d34 == p, _d41 == p },
    and { _d21 == p, _d22 == p, _d23 == p, _d24 == p },
    and { _d21 == p, _d15 == p, _d9 == p, _d3 == p },
    and { _d22 == p, _d23 == p, _d24 == p, _d25 == p },
    and { _d22 == p, _d16 == p, _d10 == p, _d4 == p },
    and { _d23 == p, _d24 == p, _d25 == p, _d26 == p },
    and { _d23 == p, _d17 == p, _d11 == p, _d5 == p },
    and { _d24 == p, _d25 == p, _d26 == p, _d27 == p },
    and { _d24 == p, _d18 == p, _d12 == p, _d6 == p },
    and { _d28 == p, _d29 == p, _d30 == p, _d31 == p },
    and { _d28 == p, _d22 == p, _d16 == p, _d10 == p },
    and { _d29 == p, _d30 == p, _d31 == p, _d32 == p },
    and { _d29 == p, _d23 == p, _d17 == p, _d11 == p },
    and { _d30 == p, _d31 == p, _d32 == p, _d33 == p },
    and { _d30 == p, _d24 == p, _d18 == p, _d12 == p },
    and { _d31 == p, _d32 == p, _d33 == p, _d34 == p },
    and { _d31 == p, _d25 == p, _d19 == p, _d13 == p },
    and { _d35 == p, _d36 == p, _d37 == p, _d38 == p },
    and { _d35 == p, _d29 == p, _d23 == p, _d17 == p },
    and { _d36 == p, _d37 == p, _d38 == p, _d39 == p },
    and { _d36 == p, _d30 == p, _d24 == p, _d18 == p },
    and { _d37 == p, _d38 == p, _d39 == p, _d40 == p },
    and { _d37 == p, _d31 == p, _d25 == p, _d19 == p },
    and { _d38 == p, _d39 == p, _d40 == p, _d41 == p },
    and { _d38 == p, _d32 == p, _d26 == p, _d20 == p },
  }
  }
  action init = all {
    _p0' = 0, _p1' = 0, _p2' = 0, _p3' = 0, _p4' = 0, _p5' = 0, _p6' = 0, _p7' = 0, _p8' = 0, _p9' = 0, _p10' = 0, _p11' = 0, _p12' = 0, _p13' = 0, _p14' = 0, _p15' = 0, _p16' = 0, _p17' = 0, _p18' = 0, _p19' = 0, _p20' = 0, _p21' = 0, _p22' = 0, _p23' = 0, _p24' = 0, _p25' = 0, _p26' = 0, _p27' = 0, _p28' = 0, _p29' = 0, _p30' = 0, _p31' = 0, _p32' = 0, _p33' = 0, _p34' = 0, _p35' = 0, _p36' = 0, _p37' = 0, _p38' = 0, _p39' = 0, _p40' = 0, _p41' = 0, _h0' = 0, _h1' = 0, _h2' = 0, _h3' = 0, _h4' = 0, _h5' = 0, _h6' = 0, turn' = 1, result' = 0,
    drops' = 0, _count' = 0, online' = true, _savedP0' = 0, _savedP1' = 0, _savedP2' = 0, _savedP3' = 0, _savedP4' = 0, _savedP5' = 0, _savedP6' = 0, _savedP7' = 0, _savedP8' = 0, _savedP9' = 0, _savedP10' = 0, _savedP11' = 0, _savedP12' = 0, _savedP13' = 0, _savedP14' = 0, _savedP15' = 0, _savedP16' = 0, _savedP17' = 0, _savedP18' = 0, _savedP19' = 0, _savedP20' = 0, _savedP21' = 0, _savedP22' = 0, _savedP23' = 0, _savedP24' = 0, _savedP25' = 0, _savedP26' = 0, _savedP27' = 0, _savedP28' = 0, _savedP29' = 0, _savedP30' = 0, _savedP31' = 0, _savedP32' = 0, _savedP33' = 0, _savedP34' = 0, _savedP35' = 0, _savedP36' = 0, _savedP37' = 0, _savedP38' = 0, _savedP39' = 0, _savedP40' = 0, _savedP41' = 0, _dropsAtDisconnect' = 0, _turnAtDisconnect' = 1, _resultAtDisconnect' = 0, _countAtDisconnect' = 0,
  }
  /// Drop one disc, or keep the same board if that column cannot be played.
  action drop(column: int): bool =
    if (online and result == 0 and column >= 0 and column < 7 and _height(_heights, column) < 6) {
      val cell = _height(_heights, column) * 7 + column
      val b = (if (cell == 0) turn else board._1, if (cell == 1) turn else board._2, if (cell == 2) turn else board._3, if (cell == 3) turn else board._4, if (cell == 4) turn else board._5, if (cell == 5) turn else board._6, if (cell == 6) turn else board._7, if (cell == 7) turn else board._8, if (cell == 8) turn else board._9, if (cell == 9) turn else board._10, if (cell == 10) turn else board._11, if (cell == 11) turn else board._12, if (cell == 12) turn else board._13, if (cell == 13) turn else board._14, if (cell == 14) turn else board._15, if (cell == 15) turn else board._16, if (cell == 16) turn else board._17, if (cell == 17) turn else board._18, if (cell == 18) turn else board._19, if (cell == 19) turn else board._20, if (cell == 20) turn else board._21, if (cell == 21) turn else board._22, if (cell == 22) turn else board._23, if (cell == 23) turn else board._24, if (cell == 24) turn else board._25, if (cell == 25) turn else board._26, if (cell == 26) turn else board._27, if (cell == 27) turn else board._28, if (cell == 28) turn else board._29, if (cell == 29) turn else board._30, if (cell == 30) turn else board._31, if (cell == 31) turn else board._32, if (cell == 32) turn else board._33, if (cell == 33) turn else board._34, if (cell == 34) turn else board._35, if (cell == 35) turn else board._36, if (cell == 36) turn else board._37, if (cell == 37) turn else board._38, if (cell == 38) turn else board._39, if (cell == 39) turn else board._40, if (cell == 40) turn else board._41, if (cell == 41) turn else board._42)
      val played = drops * 8 + column + 1
      all {
        _p0' = (if (cell == 0) turn else _p0), _p1' = (if (cell == 1) turn else _p1), _p2' = (if (cell == 2) turn else _p2), _p3' = (if (cell == 3) turn else _p3), _p4' = (if (cell == 4) turn else _p4), _p5' = (if (cell == 5) turn else _p5), _p6' = (if (cell == 6) turn else _p6), _p7' = (if (cell == 7) turn else _p7), _p8' = (if (cell == 8) turn else _p8), _p9' = (if (cell == 9) turn else _p9), _p10' = (if (cell == 10) turn else _p10), _p11' = (if (cell == 11) turn else _p11), _p12' = (if (cell == 12) turn else _p12), _p13' = (if (cell == 13) turn else _p13), _p14' = (if (cell == 14) turn else _p14), _p15' = (if (cell == 15) turn else _p15), _p16' = (if (cell == 16) turn else _p16), _p17' = (if (cell == 17) turn else _p17), _p18' = (if (cell == 18) turn else _p18), _p19' = (if (cell == 19) turn else _p19), _p20' = (if (cell == 20) turn else _p20), _p21' = (if (cell == 21) turn else _p21), _p22' = (if (cell == 22) turn else _p22), _p23' = (if (cell == 23) turn else _p23), _p24' = (if (cell == 24) turn else _p24), _p25' = (if (cell == 25) turn else _p25), _p26' = (if (cell == 26) turn else _p26), _p27' = (if (cell == 27) turn else _p27), _p28' = (if (cell == 28) turn else _p28), _p29' = (if (cell == 29) turn else _p29), _p30' = (if (cell == 30) turn else _p30), _p31' = (if (cell == 31) turn else _p31), _p32' = (if (cell == 32) turn else _p32), _p33' = (if (cell == 33) turn else _p33), _p34' = (if (cell == 34) turn else _p34), _p35' = (if (cell == 35) turn else _p35), _p36' = (if (cell == 36) turn else _p36), _p37' = (if (cell == 37) turn else _p37), _p38' = (if (cell == 38) turn else _p38), _p39' = (if (cell == 39) turn else _p39), _p40' = (if (cell == 40) turn else _p40), _p41' = (if (cell == 41) turn else _p41), _h0' = (if (column == 0) _h0 + 1 else _h0), _h1' = (if (column == 1) _h1 + 1 else _h1), _h2' = (if (column == 2) _h2 + 1 else _h2), _h3' = (if (column == 3) _h3 + 1 else _h3), _h4' = (if (column == 4) _h4 + 1 else _h4), _h5' = (if (column == 5) _h5 + 1 else _h5), _h6' = (if (column == 6) _h6 + 1 else _h6), drops' = played, _count' = _count + 1, turn' = 3 - turn,
        online' = online, _savedP0' = _savedP0, _savedP1' = _savedP1, _savedP2' = _savedP2, _savedP3' = _savedP3, _savedP4' = _savedP4, _savedP5' = _savedP5, _savedP6' = _savedP6, _savedP7' = _savedP7, _savedP8' = _savedP8, _savedP9' = _savedP9, _savedP10' = _savedP10, _savedP11' = _savedP11, _savedP12' = _savedP12, _savedP13' = _savedP13, _savedP14' = _savedP14, _savedP15' = _savedP15, _savedP16' = _savedP16, _savedP17' = _savedP17, _savedP18' = _savedP18, _savedP19' = _savedP19, _savedP20' = _savedP20, _savedP21' = _savedP21, _savedP22' = _savedP22, _savedP23' = _savedP23, _savedP24' = _savedP24, _savedP25' = _savedP25, _savedP26' = _savedP26, _savedP27' = _savedP27, _savedP28' = _savedP28, _savedP29' = _savedP29, _savedP30' = _savedP30, _savedP31' = _savedP31, _savedP32' = _savedP32, _savedP33' = _savedP33, _savedP34' = _savedP34, _savedP35' = _savedP35, _savedP36' = _savedP36, _savedP37' = _savedP37, _savedP38' = _savedP38, _savedP39' = _savedP39, _savedP40' = _savedP40, _savedP41' = _savedP41, _dropsAtDisconnect' = _dropsAtDisconnect, _turnAtDisconnect' = _turnAtDisconnect, _resultAtDisconnect' = _resultAtDisconnect, _countAtDisconnect' = _countAtDisconnect,
        result' = if (_won(b, turn)) turn else if (_count + 1 == 42) 3 else 0,
      }
    } else all { _p0' = _p0, _p1' = _p1, _p2' = _p2, _p3' = _p3, _p4' = _p4, _p5' = _p5, _p6' = _p6, _p7' = _p7, _p8' = _p8, _p9' = _p9, _p10' = _p10, _p11' = _p11, _p12' = _p12, _p13' = _p13, _p14' = _p14, _p15' = _p15, _p16' = _p16, _p17' = _p17, _p18' = _p18, _p19' = _p19, _p20' = _p20, _p21' = _p21, _p22' = _p22, _p23' = _p23, _p24' = _p24, _p25' = _p25, _p26' = _p26, _p27' = _p27, _p28' = _p28, _p29' = _p29, _p30' = _p30, _p31' = _p31, _p32' = _p32, _p33' = _p33, _p34' = _p34, _p35' = _p35, _p36' = _p36, _p37' = _p37, _p38' = _p38, _p39' = _p39, _p40' = _p40, _p41' = _p41, _h0' = _h0, _h1' = _h1, _h2' = _h2, _h3' = _h3, _h4' = _h4, _h5' = _h5, _h6' = _h6, turn' = turn, result' = result, drops' = drops, _count' = _count, online' = online, _savedP0' = _savedP0, _savedP1' = _savedP1, _savedP2' = _savedP2, _savedP3' = _savedP3, _savedP4' = _savedP4, _savedP5' = _savedP5, _savedP6' = _savedP6, _savedP7' = _savedP7, _savedP8' = _savedP8, _savedP9' = _savedP9, _savedP10' = _savedP10, _savedP11' = _savedP11, _savedP12' = _savedP12, _savedP13' = _savedP13, _savedP14' = _savedP14, _savedP15' = _savedP15, _savedP16' = _savedP16, _savedP17' = _savedP17, _savedP18' = _savedP18, _savedP19' = _savedP19, _savedP20' = _savedP20, _savedP21' = _savedP21, _savedP22' = _savedP22, _savedP23' = _savedP23, _savedP24' = _savedP24, _savedP25' = _savedP25, _savedP26' = _savedP26, _savedP27' = _savedP27, _savedP28' = _savedP28, _savedP29' = _savedP29, _savedP30' = _savedP30, _savedP31' = _savedP31, _savedP32' = _savedP32, _savedP33' = _savedP33, _savedP34' = _savedP34, _savedP35' = _savedP35, _savedP36' = _savedP36, _savedP37' = _savedP37, _savedP38' = _savedP38, _savedP39' = _savedP39, _savedP40' = _savedP40, _savedP41' = _savedP41, _dropsAtDisconnect' = _dropsAtDisconnect, _turnAtDisconnect' = _turnAtDisconnect, _resultAtDisconnect' = _resultAtDisconnect, _countAtDisconnect' = _countAtDisconnect }
  /// Both players lose their connection and keep their last board.
  action loseConnection = all {
    online, online' = false, _savedP0' = _p0, _savedP1' = _p1, _savedP2' = _p2, _savedP3' = _p3, _savedP4' = _p4, _savedP5' = _p5, _savedP6' = _p6, _savedP7' = _p7, _savedP8' = _p8, _savedP9' = _p9, _savedP10' = _p10, _savedP11' = _p11, _savedP12' = _p12, _savedP13' = _p13, _savedP14' = _p14, _savedP15' = _p15, _savedP16' = _p16, _savedP17' = _p17, _savedP18' = _p18, _savedP19' = _p19, _savedP20' = _p20, _savedP21' = _p21, _savedP22' = _p22, _savedP23' = _p23, _savedP24' = _p24, _savedP25' = _p25, _savedP26' = _p26, _savedP27' = _p27, _savedP28' = _p28, _savedP29' = _p29, _savedP30' = _p30, _savedP31' = _p31, _savedP32' = _p32, _savedP33' = _p33, _savedP34' = _p34, _savedP35' = _p35, _savedP36' = _p36, _savedP37' = _p37, _savedP38' = _p38, _savedP39' = _p39, _savedP40' = _p40, _savedP41' = _p41, _dropsAtDisconnect' = drops, _turnAtDisconnect' = turn, _resultAtDisconnect' = result, _countAtDisconnect' = _count,
    _p0' = _p0, _p1' = _p1, _p2' = _p2, _p3' = _p3, _p4' = _p4, _p5' = _p5, _p6' = _p6, _p7' = _p7, _p8' = _p8, _p9' = _p9, _p10' = _p10, _p11' = _p11, _p12' = _p12, _p13' = _p13, _p14' = _p14, _p15' = _p15, _p16' = _p16, _p17' = _p17, _p18' = _p18, _p19' = _p19, _p20' = _p20, _p21' = _p21, _p22' = _p22, _p23' = _p23, _p24' = _p24, _p25' = _p25, _p26' = _p26, _p27' = _p27, _p28' = _p28, _p29' = _p29, _p30' = _p30, _p31' = _p31, _p32' = _p32, _p33' = _p33, _p34' = _p34, _p35' = _p35, _p36' = _p36, _p37' = _p37, _p38' = _p38, _p39' = _p39, _p40' = _p40, _p41' = _p41, _h0' = _h0, _h1' = _h1, _h2' = _h2, _h3' = _h3, _h4' = _h4, _h5' = _h5, _h6' = _h6, turn' = turn, result' = result, drops' = drops, _count' = _count,
  }
  /// Both players return to the same board and turn.
  action connectionReturns = all {
    not(online), online' = true, _savedP0' = _savedP0, _savedP1' = _savedP1, _savedP2' = _savedP2, _savedP3' = _savedP3, _savedP4' = _savedP4, _savedP5' = _savedP5, _savedP6' = _savedP6, _savedP7' = _savedP7, _savedP8' = _savedP8, _savedP9' = _savedP9, _savedP10' = _savedP10, _savedP11' = _savedP11, _savedP12' = _savedP12, _savedP13' = _savedP13, _savedP14' = _savedP14, _savedP15' = _savedP15, _savedP16' = _savedP16, _savedP17' = _savedP17, _savedP18' = _savedP18, _savedP19' = _savedP19, _savedP20' = _savedP20, _savedP21' = _savedP21, _savedP22' = _savedP22, _savedP23' = _savedP23, _savedP24' = _savedP24, _savedP25' = _savedP25, _savedP26' = _savedP26, _savedP27' = _savedP27, _savedP28' = _savedP28, _savedP29' = _savedP29, _savedP30' = _savedP30, _savedP31' = _savedP31, _savedP32' = _savedP32, _savedP33' = _savedP33, _savedP34' = _savedP34, _savedP35' = _savedP35, _savedP36' = _savedP36, _savedP37' = _savedP37, _savedP38' = _savedP38, _savedP39' = _savedP39, _savedP40' = _savedP40, _savedP41' = _savedP41, _dropsAtDisconnect' = _dropsAtDisconnect, _turnAtDisconnect' = _turnAtDisconnect, _resultAtDisconnect' = _resultAtDisconnect, _countAtDisconnect' = _countAtDisconnect,
    _p0' = _p0, _p1' = _p1, _p2' = _p2, _p3' = _p3, _p4' = _p4, _p5' = _p5, _p6' = _p6, _p7' = _p7, _p8' = _p8, _p9' = _p9, _p10' = _p10, _p11' = _p11, _p12' = _p12, _p13' = _p13, _p14' = _p14, _p15' = _p15, _p16' = _p16, _p17' = _p17, _p18' = _p18, _p19' = _p19, _p20' = _p20, _p21' = _p21, _p22' = _p22, _p23' = _p23, _p24' = _p24, _p25' = _p25, _p26' = _p26, _p27' = _p27, _p28' = _p28, _p29' = _p29, _p30' = _p30, _p31' = _p31, _p32' = _p32, _p33' = _p33, _p34' = _p34, _p35' = _p35, _p36' = _p36, _p37' = _p37, _p38' = _p38, _p39' = _p39, _p40' = _p40, _p41' = _p41, _h0' = _h0, _h1' = _h1, _h2' = _h2, _h3' = _h3, _h4' = _h4, _h5' = _h5, _h6' = _h6, turn' = turn, result' = result, drops' = drops, _count' = _count,
  }
  action step = any {
    { nondet column = (-1).to(7).oneOf(); drop(column) }, loseConnection, connectionReturns,
  }
  /// Each player takes alternate turns, beginning with Red.
  val invTurn = turn == (if (_count % 2 == 0) 1 else 2)
  /// The board and turn stay unchanged while neither player has a connection.
  val invOfflineBoard = not(online) implies ((board, drops, turn, result, _count) == (_boardAtDisconnect, _dropsAtDisconnect, _turnAtDisconnect, _resultAtDisconnect, _countAtDisconnect))
  /// Bookkeeping: a column holds at most six discs.
  val invCapacity = and { (_h0 >= 0 and _h0 <= 6), (_h1 >= 0 and _h1 <= 6), (_h2 >= 0 and _h2 <= 6), (_h3 >= 0 and _h3 <= 6), (_h4 >= 0 and _h4 <= 6), (_h5 >= 0 and _h5 <= 6), (_h6 >= 0 and _h6 <= 6) }
  /// Bookkeeping: discs cannot float above an empty place.
  val invGravity = and { ((_p0 != 0) == (0 < _h0)), ((_p1 != 0) == (0 < _h1)), ((_p2 != 0) == (0 < _h2)), ((_p3 != 0) == (0 < _h3)), ((_p4 != 0) == (0 < _h4)), ((_p5 != 0) == (0 < _h5)), ((_p6 != 0) == (0 < _h6)), ((_p7 != 0) == (1 < _h0)), ((_p8 != 0) == (1 < _h1)), ((_p9 != 0) == (1 < _h2)), ((_p10 != 0) == (1 < _h3)), ((_p11 != 0) == (1 < _h4)), ((_p12 != 0) == (1 < _h5)), ((_p13 != 0) == (1 < _h6)), ((_p14 != 0) == (2 < _h0)), ((_p15 != 0) == (2 < _h1)), ((_p16 != 0) == (2 < _h2)), ((_p17 != 0) == (2 < _h3)), ((_p18 != 0) == (2 < _h4)), ((_p19 != 0) == (2 < _h5)), ((_p20 != 0) == (2 < _h6)), ((_p21 != 0) == (3 < _h0)), ((_p22 != 0) == (3 < _h1)), ((_p23 != 0) == (3 < _h2)), ((_p24 != 0) == (3 < _h3)), ((_p25 != 0) == (3 < _h4)), ((_p26 != 0) == (3 < _h5)), ((_p27 != 0) == (3 < _h6)), ((_p28 != 0) == (4 < _h0)), ((_p29 != 0) == (4 < _h1)), ((_p30 != 0) == (4 < _h2)), ((_p31 != 0) == (4 < _h3)), ((_p32 != 0) == (4 < _h4)), ((_p33 != 0) == (4 < _h5)), ((_p34 != 0) == (4 < _h6)), ((_p35 != 0) == (5 < _h0)), ((_p36 != 0) == (5 < _h1)), ((_p37 != 0) == (5 < _h2)), ((_p38 != 0) == (5 < _h3)), ((_p39 != 0) == (5 < _h4)), ((_p40 != 0) == (5 < _h5)), ((_p41 != 0) == (5 < _h6)) }
  /// Bookkeeping: every accepted drop adds one disc.
  val invConservation = (_h0 + _h1 + _h2 + _h3 + _h4 + _h5 + _h6) == _count
  /// Bookkeeping: only Red, Yellow, empty and draw have meanings here.
  val invOwnership = and { (result >= 0 and result <= 3), (_p0 >= 0 and _p0 <= 2), (_p1 >= 0 and _p1 <= 2), (_p2 >= 0 and _p2 <= 2), (_p3 >= 0 and _p3 <= 2), (_p4 >= 0 and _p4 <= 2), (_p5 >= 0 and _p5 <= 2), (_p6 >= 0 and _p6 <= 2), (_p7 >= 0 and _p7 <= 2), (_p8 >= 0 and _p8 <= 2), (_p9 >= 0 and _p9 <= 2), (_p10 >= 0 and _p10 <= 2), (_p11 >= 0 and _p11 <= 2), (_p12 >= 0 and _p12 <= 2), (_p13 >= 0 and _p13 <= 2), (_p14 >= 0 and _p14 <= 2), (_p15 >= 0 and _p15 <= 2), (_p16 >= 0 and _p16 <= 2), (_p17 >= 0 and _p17 <= 2), (_p18 >= 0 and _p18 <= 2), (_p19 >= 0 and _p19 <= 2), (_p20 >= 0 and _p20 <= 2), (_p21 >= 0 and _p21 <= 2), (_p22 >= 0 and _p22 <= 2), (_p23 >= 0 and _p23 <= 2), (_p24 >= 0 and _p24 <= 2), (_p25 >= 0 and _p25 <= 2), (_p26 >= 0 and _p26 <= 2), (_p27 >= 0 and _p27 <= 2), (_p28 >= 0 and _p28 <= 2), (_p29 >= 0 and _p29 <= 2), (_p30 >= 0 and _p30 <= 2), (_p31 >= 0 and _p31 <= 2), (_p32 >= 0 and _p32 <= 2), (_p33 >= 0 and _p33 <= 2), (_p34 >= 0 and _p34 <= 2), (_p35 >= 0 and _p35 <= 2), (_p36 >= 0 and _p36 <= 2), (_p37 >= 0 and _p37 <= 2), (_p38 >= 0 and _p38 <= 2), (_p39 >= 0 and _p39 <= 2), (_p40 >= 0 and _p40 <= 2), (_p41 >= 0 and _p41 <= 2) }
  /// Bookkeeping: an empty history means no disc has been dropped.
  val invHistory = drops >= 0 and ((drops == 0) == (_count == 0))
  /// Bookkeeping: a recorded victory has a winning alignment.
  val invVictory = (result == 1 implies _won(board, 1)) and (result == 2 implies _won(board, 2))
  /// Bookkeeping: a drawn board is full and has no winning alignment.
  val invDraw = result == 3 implies (_count == 42 and not(_won(board, 1)) and not(_won(board, 2)))
  // An unfinished game has no winning alignment yet.
  val _unfinished = result == 0 implies (not(_won(board, 1)) and not(_won(board, 2)))
  val _inductive = all {
    _p0.in(Int), _p1.in(Int), _p2.in(Int), _p3.in(Int), _p4.in(Int), _p5.in(Int), _p6.in(Int), _p7.in(Int), _p8.in(Int), _p9.in(Int), _p10.in(Int), _p11.in(Int), _p12.in(Int), _p13.in(Int), _p14.in(Int), _p15.in(Int), _p16.in(Int), _p17.in(Int), _p18.in(Int), _p19.in(Int), _p20.in(Int), _p21.in(Int), _p22.in(Int), _p23.in(Int), _p24.in(Int), _p25.in(Int), _p26.in(Int), _p27.in(Int), _p28.in(Int), _p29.in(Int), _p30.in(Int), _p31.in(Int), _p32.in(Int), _p33.in(Int), _p34.in(Int), _p35.in(Int), _p36.in(Int), _p37.in(Int), _p38.in(Int), _p39.in(Int), _p40.in(Int), _p41.in(Int),
    _h0.in(Int), _h1.in(Int), _h2.in(Int), _h3.in(Int), _h4.in(Int), _h5.in(Int), _h6.in(Int),
    drops.in(Nat), _count.in(Int), _count >= 0, _count <= 42,
    turn.in(Int), result.in(Int), online.in(Set(false, true)),
    _savedP0.in(Int), _savedP1.in(Int), _savedP2.in(Int), _savedP3.in(Int), _savedP4.in(Int), _savedP5.in(Int), _savedP6.in(Int), _savedP7.in(Int), _savedP8.in(Int), _savedP9.in(Int), _savedP10.in(Int), _savedP11.in(Int), _savedP12.in(Int), _savedP13.in(Int), _savedP14.in(Int), _savedP15.in(Int), _savedP16.in(Int), _savedP17.in(Int), _savedP18.in(Int), _savedP19.in(Int), _savedP20.in(Int), _savedP21.in(Int), _savedP22.in(Int), _savedP23.in(Int), _savedP24.in(Int), _savedP25.in(Int), _savedP26.in(Int), _savedP27.in(Int), _savedP28.in(Int), _savedP29.in(Int), _savedP30.in(Int), _savedP31.in(Int), _savedP32.in(Int), _savedP33.in(Int), _savedP34.in(Int), _savedP35.in(Int), _savedP36.in(Int), _savedP37.in(Int), _savedP38.in(Int), _savedP39.in(Int), _savedP40.in(Int), _savedP41.in(Int), _dropsAtDisconnect.in(Nat),
    _turnAtDisconnect.in(Int), _resultAtDisconnect.in(Int), _countAtDisconnect.in(Int),
    invTurn, invOfflineBoard, invCapacity, invGravity, invConservation,
    invOwnership, invHistory, invVictory, invDraw, _unfinished,
  }
}
