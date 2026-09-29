// A door counter that keeps the range up to a bound it draws: fine for the
// simulator, outside what Apalache can encode (a range needs constant ends).
module door_unbounded {
  var count: int
  var seen: Set[int]

  action init = all { count' = 0, seen' = Set() }
  action step = nondet n = Set(1, 2).oneOf() all {
    count' = if (n > count) n else count,
    seen' = 1.to(if (n > count) n else count),
  }

  val invCountsFromOne = seen.forall(i => i >= 1)
}
