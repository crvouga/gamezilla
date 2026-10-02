// @spec-meta — temporal-checker fixture
module progress {
  var done: bool
  var busy: bool

  action init = all { done' = false, busy' = false }
  action complete = all { not(done), done' = true, busy' = busy }
  action unrelated = all { done' = done, busy' = not(busy) }
  action step = any { complete, unrelated }

  val invSafe = done or not(done)
  val invNeverFinishes = not(done)
  temporal liveCompletion = complete.weakFair((done, busy)).implies(eventually(done))
}
