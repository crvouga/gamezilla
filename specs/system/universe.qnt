// @spec-meta — finite bounds shared by interpretation models
// Representative people and devices, including two devices for one person.
// Bounds are intentionally small; sequence numbers and queues are not truncated.
module universe {
  pure val PEOPLE = Set(0, 1, 2)
  pure val DEVICES = Set(0, 1, 2, 3)
  pure val SPACES = Set(0, 1)
  pure val PUZZLES = Set(0, 1, 2)
  pure def personOn(d: int): int = if (d < 2) 0 else d - 1
  pure val deviceOwners = DEVICES.mapBy(d => personOn(d))
}
