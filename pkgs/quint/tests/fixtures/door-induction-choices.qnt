// @spec-meta — Quint runner fixture
module door_induction_choices {
  var state: str
  action init = state' = "closed"
  action _choose(opening: bool): bool =
    if (opening) state' = "open" else state' = "closed"
  action step = {
    nondet choice = Set(0, 1).oneOf()
    nondet opening = Set(true, false).oneOf()
    any {
      all { choice == 0, state' = "closed" },
      all { choice == 1, _choose(opening) },
    }
  }
  val invKnownState = Set("closed", "open").contains(state)
  val invNeverOpen = state == "closed"
}
