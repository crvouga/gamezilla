// @spec-interpretation
// Sources: specs/chess, specs/friends, specs/matchmaking, specs/room, specs/spaces
// Spaces, friends/inbox, matchmaking and room commands share current authority.
module multiplayer {
  import system_actions.* from "./system-actions"
  export system_actions.*
  import universe.* from "./universe"
  import puzzle_board.* from "./puzzle-board"
  export universe.*
  action step = {
    nondet d = DEVICES.oneOf()
    nondet p = PEOPLE.oneOf()
    nondet other = PEOPLE.oneOf()
    nondet id = SPACES.oneOf()
    nondet value = Set(0,1,2).oneOf()
    nondet kind = boardKINDS.union(Set("create", "join", "leave", "end", "select", "add-member", "remove-member", "request", "accept", "block", "unblock", "decline", "cancel-request", "remove-friend", "wait", "cancel")).oneOf()
    any {
      emit(d,kind,id,value), tryUpload(d), acknowledge(d),
      requestSnapshot(d), receiveSnapshot(d), optimisticPeerPush(d,(d + 1) % DEVICES.size()), applyPush(d), dropReply(d),
      disconnect(d), reconnect(d), revoke(p), signIn(d,p), register(p), eraseAccount(p),
      deliverInbox(p,other), retireInbox(p,other), interactInbox(d,p,"read"), interactInbox(d,p,"archive"), interactInbox(d,p,"dismiss"), matchPeople(p,other), finishMatch(p,other), roomMove(d,id), cachePuzzles(d), captureBoardOutcome(d), loseBoardNotification, recordBoardOutcome, failAttempt,
    }
  }
  val invSafety = and { invSubsystems, invDurableIntent, invNoTransitionViolation, invCheckpoints, invConvergenceWhenSettled }
}
