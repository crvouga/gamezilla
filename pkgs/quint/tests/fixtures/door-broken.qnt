// The door model with an invariant its own actions break.
module door_broken {
  var state: str

  action init = state' = "closed"
  action open = all { state == "closed", state' = "open" }
  action close = all { state == "open", state' = "closed" }
  action step = any { open, close }

  val invNeverOpen = state != "open"
}
