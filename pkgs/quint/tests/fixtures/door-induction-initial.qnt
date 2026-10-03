// @spec-meta — Quint runner fixture
module door_induction_initial {
  var state: str
  action init = state' = "open"
  action step = state' = "closed"
  val invNeverOpen = state == "closed"
}
