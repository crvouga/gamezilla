// A door keeps a complete set of calibration readings while it stays shut.
module door_many_values {
  type Readings = (int, int, int, int, int, int, int, int, int, int, int, int, int, int, int, int, int, int, int, int, int, int, int, int, int, int, int, int, int, int, int, int, int, int, int, int, int, int, int, int, int, int)
  var state: str
  pure def _calibrated(readings: Readings): bool = {
    pure val _reading0: int = readings._1
    pure val _reading1: int = readings._2
    pure val _reading2: int = readings._3
    pure val _reading3: int = readings._4
    pure val _reading4: int = readings._5
    pure val _reading5: int = readings._6
    pure val _reading6: int = readings._7
    pure val _reading7: int = readings._8
    pure val _reading8: int = readings._9
    pure val _reading9: int = readings._10
    pure val _reading10: int = readings._11
    pure val _reading11: int = readings._12
    pure val _reading12: int = readings._13
    pure val _reading13: int = readings._14
    pure val _reading14: int = readings._15
    pure val _reading15: int = readings._16
    pure val _reading16: int = readings._17
    pure val _reading17: int = readings._18
    pure val _reading18: int = readings._19
    pure val _reading19: int = readings._20
    pure val _reading20: int = readings._21
    pure val _reading21: int = readings._22
    pure val _reading22: int = readings._23
    pure val _reading23: int = readings._24
    pure val _reading24: int = readings._25
    pure val _reading25: int = readings._26
    pure val _reading26: int = readings._27
    pure val _reading27: int = readings._28
    pure val _reading28: int = readings._29
    pure val _reading29: int = readings._30
    pure val _reading30: int = readings._31
    pure val _reading31: int = readings._32
    pure val _reading32: int = readings._33
    pure val _reading33: int = readings._34
    pure val _reading34: int = readings._35
    pure val _reading35: int = readings._36
    pure val _reading36: int = readings._37
    pure val _reading37: int = readings._38
    pure val _reading38: int = readings._39
    pure val _reading39: int = readings._40
    pure val _reading40: int = readings._41
    pure val _reading41: int = readings._42
    and {
      _reading0 == 0,
      _reading1 == 1,
      _reading2 == 2,
      _reading3 == 3,
      _reading4 == 4,
      _reading5 == 5,
      _reading6 == 6,
      _reading7 == 7,
      _reading8 == 8,
      _reading9 == 9,
      _reading10 == 10,
      _reading11 == 11,
      _reading12 == 12,
      _reading13 == 13,
      _reading14 == 14,
      _reading15 == 15,
      _reading16 == 16,
      _reading17 == 17,
      _reading18 == 18,
      _reading19 == 19,
      _reading20 == 20,
      _reading21 == 21,
      _reading22 == 22,
      _reading23 == 23,
      _reading24 == 24,
      _reading25 == 25,
      _reading26 == 26,
      _reading27 == 27,
      _reading28 == 28,
      _reading29 == 29,
      _reading30 == 30,
      _reading31 == 31,
      _reading32 == 32,
      _reading33 == 33,
      _reading34 == 34,
      _reading35 == 35,
      _reading36 == 36,
      _reading37 == 37,
      _reading38 == 38,
      _reading39 == 39,
      _reading40 == 40,
      _reading41 == 41,
    }
  }
  action init = state' = "shut"
  action step = state' = state
  val invKnownState = state == "shut" and _calibrated((0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41))
}
