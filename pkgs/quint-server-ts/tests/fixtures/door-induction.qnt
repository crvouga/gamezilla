// @spec-meta — Quint runner fixture
module door_induction {
  var state: str

  action init = state' = "closed"
  action open = all { state == "closed", state' = "open" }
  action close = all { state == "open", state' = "closed" }
  action step = any { open, close }

  val invKnownState = Set("closed", "open").contains(state)
  val invNeverOpen = state == "closed"
  val _inductive = invKnownState
  val _notInductive = state == "closed"
}
