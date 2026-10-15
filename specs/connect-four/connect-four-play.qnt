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
    _p0' = 0, _p1' = 0, _p2' = 0, _p3' = 0, _p4' = 0, _p5' = 0, _p6' = 0, _p7' = 0, _p8' = 0, _p9' = 0, _p10' = 0, _p11' = 0, _p12' = 0, _p13' = 0, _p14' = 0, _p15' = 0, _p16' = 0, _p17' = 0, _p18' = 0, _p19' = 0, _p20' = 0, _p21' = 0, _p22' = 0, _p23' = 0, _p24' = 0, _p25' = 0, _p26' = 0, _p27' = 0, _p28' = 0, _p29' = 0, _p30' = 0, _p31' = 0, _p32' = 0, _p33' = 0, _p34' = 0, _p35' = 0, _p36' = 0, _p37' = 0, _p38' = 0, _p39' = 0, _p40' = 0, _p41' = 0, _h0' = 0, _h1' = 0, _h2' = 0, _h3' = 0, _h4' = 0, _h5' = 0, _h6' = 0, turn' = 1, result' = 0,
    drops' = 0, _count' = 0, online' = true, _savedP0' = 0, _savedP1' = 0, _savedP2' = 0, _savedP3' = 0, _savedP4' = 0, _savedP5' = 0, _savedP6' = 0, _savedP7' = 0, _savedP8' = 0, _savedP9' = 0, _savedP10' = 0, _savedP11' = 0, _savedP12' = 0, _savedP13' = 0, _savedP14' = 0, _savedP15' = 0, _savedP16' = 0, _savedP17' = 0, _savedP18' = 0, _savedP19' = 0, _savedP20' = 0, _savedP21' = 0, _savedP22' = 0, _savedP23' = 0, _savedP24' = 0, _savedP25' = 0, _savedP26' = 0, _savedP27' = 0, _savedP28' = 0, _savedP29' = 0, _savedP30' = 0, _savedP31' = 0, _savedP32' = 0, _savedP33' = 0, _savedP34' = 0, _savedP35' = 0, _savedP36' = 0, _savedP37' = 0, _savedP38' = 0, _savedP39' = 0, _savedP40' = 0, _savedP41' = 0, _dropsAtDisconnect' = 0, _turnAtDisconnect' = 1, _resultAtDisconnect' = 0, _countAtDisconnect' = 0,
  }
  /// Drop one disc, or keep the same board if that column cannot be played.
  action drop(column: int): bool =
    if (online and result == 0 and column >= 0 and column < 7 and _height(_heights, column) < 6) {
      val cell = _height(_heights, column) * 7 + column
      val b = (if (cell == 0) turn else board._1, if (cell == 1) turn else board._2, if (cell == 2) turn else board._3, if (cell == 3) turn else board._4, if (cell == 4) turn else board._5, if (cell == 5) turn else board._6, if (cell == 6) turn else board._7, if (cell == 7) turn else board._8, if (cell == 8) turn else board._9, if (cell == 9) turn else board._10, if (cell == 10) turn else board._11, if (cell == 11) turn else board._12, if (cell == 12) turn else board._13, if (cell == 13) turn else board._14, if (cell == 14) turn else board._15, if (cell == 15) turn else board._16, if (cell == 16) turn else board._17, if (cell == 17) turn else board._18, if (cell == 18) turn else board._19, if (cell == 19) turn else board._20, if (cell == 20) turn else board._21, if (cell == 21) turn else board._22, if (cell == 22) turn else board._23, if (cell == 23) turn else board._24, if (cell == 24) turn else board._25, if (cell == 25) turn else board._26, if (cell == 26) turn else board._27, if (cell == 27) turn else board._28, if (cell == 28) turn else board._29, if (cell == 29) turn else board._30, if (cell == 30) turn else board._31, if (cell == 31) turn else board._32, if (cell == 32) turn else board._33, if (cell == 33) turn else board._34, if (cell == 34) turn else board._35, if (cell == 35) turn else board._36, if (cell == 36) turn else board._37, if (cell == 37) turn else board._38, if (cell == 38) turn else board._39, if (cell == 39) turn else board._40, if (cell == 40) turn else board._41, if (cell == 41) turn else board._42)
      val h = (if (column == 0) _heights._1 + 1 else _heights._1, if (column == 1) _heights._2 + 1 else _heights._2, if (column == 2) _heights._3 + 1 else _heights._3, if (column == 3) _heights._4 + 1 else _heights._4, if (column == 4) _heights._5 + 1 else _heights._5, if (column == 5) _heights._6 + 1 else _heights._6, if (column == 6) _heights._7 + 1 else _heights._7)
      val played = drops * 8 + column + 1
      all {
        _p0' = b._1, _p1' = b._2, _p2' = b._3, _p3' = b._4, _p4' = b._5, _p5' = b._6, _p6' = b._7, _p7' = b._8, _p8' = b._9, _p9' = b._10, _p10' = b._11, _p11' = b._12, _p12' = b._13, _p13' = b._14, _p14' = b._15, _p15' = b._16, _p16' = b._17, _p17' = b._18, _p18' = b._19, _p19' = b._20, _p20' = b._21, _p21' = b._22, _p22' = b._23, _p23' = b._24, _p24' = b._25, _p25' = b._26, _p26' = b._27, _p27' = b._28, _p28' = b._29, _p29' = b._30, _p30' = b._31, _p31' = b._32, _p32' = b._33, _p33' = b._34, _p34' = b._35, _p35' = b._36, _p36' = b._37, _p37' = b._38, _p38' = b._39, _p39' = b._40, _p40' = b._41, _p41' = b._42, _h0' = h._1, _h1' = h._2, _h2' = h._3, _h3' = h._4, _h4' = h._5, _h5' = h._6, _h6' = h._7, drops' = played, _count' = _count + 1, turn' = 3 - turn,
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
  val invOwnership = and { Set(0, 1, 2, 3).contains(result), Set(0, 1, 2).contains(_p0), Set(0, 1, 2).contains(_p1), Set(0, 1, 2).contains(_p2), Set(0, 1, 2).contains(_p3), Set(0, 1, 2).contains(_p4), Set(0, 1, 2).contains(_p5), Set(0, 1, 2).contains(_p6), Set(0, 1, 2).contains(_p7), Set(0, 1, 2).contains(_p8), Set(0, 1, 2).contains(_p9), Set(0, 1, 2).contains(_p10), Set(0, 1, 2).contains(_p11), Set(0, 1, 2).contains(_p12), Set(0, 1, 2).contains(_p13), Set(0, 1, 2).contains(_p14), Set(0, 1, 2).contains(_p15), Set(0, 1, 2).contains(_p16), Set(0, 1, 2).contains(_p17), Set(0, 1, 2).contains(_p18), Set(0, 1, 2).contains(_p19), Set(0, 1, 2).contains(_p20), Set(0, 1, 2).contains(_p21), Set(0, 1, 2).contains(_p22), Set(0, 1, 2).contains(_p23), Set(0, 1, 2).contains(_p24), Set(0, 1, 2).contains(_p25), Set(0, 1, 2).contains(_p26), Set(0, 1, 2).contains(_p27), Set(0, 1, 2).contains(_p28), Set(0, 1, 2).contains(_p29), Set(0, 1, 2).contains(_p30), Set(0, 1, 2).contains(_p31), Set(0, 1, 2).contains(_p32), Set(0, 1, 2).contains(_p33), Set(0, 1, 2).contains(_p34), Set(0, 1, 2).contains(_p35), Set(0, 1, 2).contains(_p36), Set(0, 1, 2).contains(_p37), Set(0, 1, 2).contains(_p38), Set(0, 1, 2).contains(_p39), Set(0, 1, 2).contains(_p40), Set(0, 1, 2).contains(_p41) }
  /// Bookkeeping: an empty history means no disc has been dropped.
  val invHistory = drops >= 0 and ((drops == 0) == (_count == 0))
  /// Bookkeeping: a recorded victory has a winning alignment.
  val invVictory = (result == 1 implies _won(board, 1)) and (result == 2 implies _won(board, 2))
  /// Bookkeeping: a drawn board is full and has no winning alignment.
  val invDraw = result == 3 implies (_count == 42 and not(_won(board, 1)) and not(_won(board, 2)))
  // An unfinished game has no winning alignment yet.
  val _unfinished = result == 0 implies (not(_won(board, 1)) and not(_won(board, 2)))
  val _inductive = all {
    _p0.in(Set(0, 1, 2)), _p1.in(Set(0, 1, 2)), _p2.in(Set(0, 1, 2)), _p3.in(Set(0, 1, 2)), _p4.in(Set(0, 1, 2)), _p5.in(Set(0, 1, 2)), _p6.in(Set(0, 1, 2)), _p7.in(Set(0, 1, 2)), _p8.in(Set(0, 1, 2)), _p9.in(Set(0, 1, 2)), _p10.in(Set(0, 1, 2)), _p11.in(Set(0, 1, 2)), _p12.in(Set(0, 1, 2)), _p13.in(Set(0, 1, 2)), _p14.in(Set(0, 1, 2)), _p15.in(Set(0, 1, 2)), _p16.in(Set(0, 1, 2)), _p17.in(Set(0, 1, 2)), _p18.in(Set(0, 1, 2)), _p19.in(Set(0, 1, 2)), _p20.in(Set(0, 1, 2)), _p21.in(Set(0, 1, 2)), _p22.in(Set(0, 1, 2)), _p23.in(Set(0, 1, 2)), _p24.in(Set(0, 1, 2)), _p25.in(Set(0, 1, 2)), _p26.in(Set(0, 1, 2)), _p27.in(Set(0, 1, 2)), _p28.in(Set(0, 1, 2)), _p29.in(Set(0, 1, 2)), _p30.in(Set(0, 1, 2)), _p31.in(Set(0, 1, 2)), _p32.in(Set(0, 1, 2)), _p33.in(Set(0, 1, 2)), _p34.in(Set(0, 1, 2)), _p35.in(Set(0, 1, 2)), _p36.in(Set(0, 1, 2)), _p37.in(Set(0, 1, 2)), _p38.in(Set(0, 1, 2)), _p39.in(Set(0, 1, 2)), _p40.in(Set(0, 1, 2)), _p41.in(Set(0, 1, 2)),
    _h0.in(0.to(6)), _h1.in(0.to(6)), _h2.in(0.to(6)), _h3.in(0.to(6)), _h4.in(0.to(6)), _h5.in(0.to(6)), _h6.in(0.to(6)),
    drops.in(Nat), _count.in(0.to(42)),
    turn.in(Set(1, 2)), result.in(Set(0, 1, 2, 3)), online.in(Set(false, true)),
    _savedP0.in(Set(0, 1, 2)), _savedP1.in(Set(0, 1, 2)), _savedP2.in(Set(0, 1, 2)), _savedP3.in(Set(0, 1, 2)), _savedP4.in(Set(0, 1, 2)), _savedP5.in(Set(0, 1, 2)), _savedP6.in(Set(0, 1, 2)), _savedP7.in(Set(0, 1, 2)), _savedP8.in(Set(0, 1, 2)), _savedP9.in(Set(0, 1, 2)), _savedP10.in(Set(0, 1, 2)), _savedP11.in(Set(0, 1, 2)), _savedP12.in(Set(0, 1, 2)), _savedP13.in(Set(0, 1, 2)), _savedP14.in(Set(0, 1, 2)), _savedP15.in(Set(0, 1, 2)), _savedP16.in(Set(0, 1, 2)), _savedP17.in(Set(0, 1, 2)), _savedP18.in(Set(0, 1, 2)), _savedP19.in(Set(0, 1, 2)), _savedP20.in(Set(0, 1, 2)), _savedP21.in(Set(0, 1, 2)), _savedP22.in(Set(0, 1, 2)), _savedP23.in(Set(0, 1, 2)), _savedP24.in(Set(0, 1, 2)), _savedP25.in(Set(0, 1, 2)), _savedP26.in(Set(0, 1, 2)), _savedP27.in(Set(0, 1, 2)), _savedP28.in(Set(0, 1, 2)), _savedP29.in(Set(0, 1, 2)), _savedP30.in(Set(0, 1, 2)), _savedP31.in(Set(0, 1, 2)), _savedP32.in(Set(0, 1, 2)), _savedP33.in(Set(0, 1, 2)), _savedP34.in(Set(0, 1, 2)), _savedP35.in(Set(0, 1, 2)), _savedP36.in(Set(0, 1, 2)), _savedP37.in(Set(0, 1, 2)), _savedP38.in(Set(0, 1, 2)), _savedP39.in(Set(0, 1, 2)), _savedP40.in(Set(0, 1, 2)), _savedP41.in(Set(0, 1, 2)), _dropsAtDisconnect.in(Nat),
    _turnAtDisconnect.in(Set(1, 2)), _resultAtDisconnect.in(Set(0, 1, 2, 3)), _countAtDisconnect.in(0.to(42)),
    invTurn, invOfflineBoard, invCapacity, invGravity, invConservation,
    invOwnership, invHistory, invVictory, invDraw, _unfinished,
  }
}
