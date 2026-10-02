// @spec-interpretation
// Sources: specs/auth, specs/billing, specs/chess, specs/friends, specs/matchmaking, specs/profile, specs/room, specs/spaces, specs/sync-engine
// All owned aggregates participate in one scheduler. Subsystem imports keep
// semantics shared with the smaller verification layers.
module whole_system {
  import system_actions.* from "./system-actions"
  export system_actions.*
  import universe.* from "./universe"
  export universe.*
  import product_state.* from "./product-state"
  import membership.* from "./membership"
  import identity.* from "./identity"
  action step = {
    nondet d = DEVICES.oneOf()
    nondet p = PEOPLE.oneOf()
    nondet other = PEOPLE.oneOf()
    nondet id = Set(0,1,2).oneOf()
    nondet value = Set(-2,0,1,2,3).oneOf()
    nondet kind = productKINDS.oneOf()
    nondet provider = billingPROVIDERS.oneOf()
    nondet status = billingSTATUSES.oneOf()
    nondet period = Set(-1,0,2,4).oneOf()
    nondet identity = authIDENTITIES.oneOf()
    any {
      emit(d,kind,id,value), tryUpload(d), acknowledge(d),
      requestSnapshot(d), receiveSnapshot(d), optimisticPeerPush(d,(d + 1) % DEVICES.size()), applyPush(d), dropReply(d),
      disconnect(d), reconnect(d), crash(d), restart(d),
      revoke(p), signIn(d,p), forgetSession(d), register(p), confirmDeletion(d),
      startLink(d,identity), finishLink(d,identity), unlinkMethod(d,identity), automaticLink(p,identity),
      providerChange(p,provider,status,period), advanceTime(value + 1), advanceTime(7), advanceTime(30),
      deliverInbox(p,other), retireInbox(p,other), interactInbox(d,p,"read"), interactInbox(d,p,"archive"), interactInbox(d,p,"dismiss"), matchPeople(p,other), finishMatch(p,other),
      roomMove(d,id), cachePuzzles(d), captureBoardOutcome(d), loseBoardNotification, recordBoardOutcome, proveAgain(d), requestExport(d), exportReady(p), exportFailure(p), downloadExport(d,p),
      cancellationConfirmed(p,provider), latePayment(p,id % 2), refundConfirmed(p,id % 2), failAttempt,
    }
  }
  val invSafety = and { invSubsystems, invDurableIntent, invNoTransitionViolation, invCheckpoints, invConvergenceWhenSettled }
}
