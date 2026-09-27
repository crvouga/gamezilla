// A door two people use: the smallest model with state, arguments and an
// invariant, for the Quint bridge's own tests.
module door {
  val PEOPLE = Set("ana", "ben")

  var state: str
  var lastBy: str

  action init = all { state' = "closed", lastBy' = "" }

  action open(who: str): bool = all { state == "closed", state' = "open", lastBy' = who }
  action close(who: str): bool = all { state == "open", state' = "closed", lastBy' = who }
  action lock(who: str): bool = all { state == "closed", state' = "locked", lastBy' = who }
  action unlock(who: str): bool = all { state == "locked", state' = "closed", lastBy' = who }

  action step = nondet who = PEOPLE.oneOf() any { open(who), close(who), lock(who), unlock(who) }

  val invKnownState = Set("closed", "open", "locked").contains(state)
}
