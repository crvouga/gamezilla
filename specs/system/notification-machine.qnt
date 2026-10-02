// @spec-interpretation
// Sources: specs/friends
// Two source generations expose close-before-send and stale-event ABA schedules.
module notification_machine {
  import notifications.* from "./notifications"
  // Two different senders are source equivalence classes for old/new request ids.
  pure val sources = Set((0,2),(1,2))
  var state: NotificationState
  var pending: Set[(int,int)]
  var attempted: Set[(int,int)]
  var violation: bool
  action init = all { state' = inboxInitial, pending' = sources, attempted' = Set(), violation' = false }
  action deliver(key: (int,int)): bool = all {
    state' = inboxPublish(state,key,pending.contains(key)), pending' = pending,
    attempted' = attempted.union(Set(key)), violation' = (violation or
      (not(pending.contains(key)) and not(state.active.contains(key)) and inboxPublish(state,key,pending.contains(key)).active.contains(key))),
  }
  action close(key: (int,int)): bool = all {
    pending' = pending.exclude(Set(key)), state' = inboxDeactivate(state,key), attempted' = attempted, violation' = violation,
  }
  action interact(key: (int,int), actor: int, kind: str): bool = all {
    val changed = inboxInteract(state,key,actor,kind)
    all { state' = changed, pending' = pending, attempted' = attempted,
      violation' = (violation or (actor != key._2 and changed != state)), }
  }
  action step = {
    nondet key = sources.oneOf()
    nondet actor = Set(0,1,2).oneOf()
    nondet kind = Set("read","archive","dismiss").oneOf()
    any { deliver(key), close(key), interact(key,actor,kind) }
  }
  val invSafety = inboxValid(state) and not(violation) and state.active.subseteq(pending)
  run closedSourceCannotReturnTest = init.then(close((0,2))).then(deliver((1,2))).then(deliver((0,2)))
    .expect(state.active == Set((1,2)) and invSafety)
  run duplicateDeliveryPreservesDismissalTest = init.then(deliver((0,2))).then(interact((0,2),2,"dismiss")).then(deliver((0,2)))
    .expect(state.dismissed == Set((0,2)) and state.read == Set((0,2)) and state.rows == Set((0,2)) and invSafety)
}
