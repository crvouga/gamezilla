// @spec-meta — Quint runner fixture: a door whose init can never hold; `state' = "closed" and false` reads as
// `(state' = "closed") and false`.
module door_shut {
  var state: str

  action init = state' = "closed" and false
  action step = state' = state
}
