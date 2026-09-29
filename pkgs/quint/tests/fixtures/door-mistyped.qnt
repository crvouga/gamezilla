// The door model with a type error: a state that is a string set to a number.
module door_mistyped {
  var state: str

  action init = state' = "closed"
  action step = state' = 1

  val invKnownState = state == "closed"
}
