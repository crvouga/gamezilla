// @spec-interpretation
// Sources: specs/billing, specs/profile
// Privacy, sessions, billing cancellation and queued writes interact under delays.
module privacy_lifecycle {
  import system_actions.* from "./system-actions"
  export system_actions.*
  import universe.* from "./universe"
  action step = {
    nondet d = DEVICES.oneOf()
    nondet p = PEOPLE.oneOf()
    nondet record = Set(0,1).oneOf()
    any {
      proveAgain(d), requestExport(d), exportReady(p), exportFailure(p), downloadExport(d,p),
      confirmDeletion(d), cancellationConfirmed(p,record), latePayment(p,record), refundConfirmed(p,record),
      disconnect(d), reconnect(d), revoke(p), signIn(d,p), advanceTime(1), advanceTime(7), advanceTime(30),
      emit(d,"profile",0,1), upload(d), acknowledge(d), requestSnapshot(d), receiveSnapshot(d),
    }
  }
  val invSafety = and { invSubsystems, invDurableIntent, invNoTransitionViolation, invCheckpoints, invConvergenceWhenSettled }
}
