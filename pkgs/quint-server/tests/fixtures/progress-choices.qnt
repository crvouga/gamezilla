// @spec-meta — unused choices must not multiply complete-graph transitions.
module progress_choices {
  var done: bool
  var busy: bool
  action init = all { done' = false, busy' = false }
  action complete = all { not(done), done' = true, busy' = busy }
  action unrelated = all { done' = done, busy' = not(busy) }
  action step = {
    nondet actor = Set("alice", "bob", "carol").oneOf()
    nondet wait = Set(1, 2, 4).oneOf()
    any { complete, unrelated }
  }
  val invSafe = done or not(done)
  temporal liveCompletion = complete.weakFair((done, busy)).implies(eventually(done))
}
