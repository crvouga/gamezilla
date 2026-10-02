// @spec-meta — temporal-checker fixture
module progress_stuck {
  var done: bool
  var busy: bool

  action init = all { done' = false, busy' = false }
  action complete = all { false, done' = true, busy' = busy }
  action unrelated = all { done' = done, busy' = not(busy) }
  action step = any { complete, unrelated }

  val invSafe = done or not(done)
  temporal liveCompletion = complete.weakFair((done, busy)).implies(eventually(done))
}
