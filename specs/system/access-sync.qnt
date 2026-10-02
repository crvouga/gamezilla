// @spec-interpretation
// Sources: specs/billing, specs/chess, specs/profile, specs/spaces
// Composition of billing, permissions, quota, session state and offline intent.
module access_sync {
  import system_actions.* from "./system-actions"
  export system_actions.*
  import universe.* from "./universe"
  export universe.*
  import membership.* from "./membership"
  action step = {
    nondet d = DEVICES.oneOf()
    nondet p = PEOPLE.oneOf()
    nondet id = Set(0,1,2).oneOf()
    nondet value = Set(0,1,2).oneOf()
    nondet kind = Set("customize", "create", "end", "start", "finish").oneOf()
    nondet provider = billingPROVIDERS.oneOf()
    nondet status = billingSTATUSES.oneOf()
    nondet period = Set(-1,0,2,4).oneOf()
    any {
      emit(d,kind,id,value), tryUpload(d), acknowledge(d),
      requestSnapshot(d), receiveSnapshot(d), applyPush(d), dropReply(d),
      disconnect(d), reconnect(d), revoke(p), signIn(d,p),
      register(p), eraseAccount(p), providerChange(p,provider,status,period), timePasses,
    }
  }
  val invSafety = and { invSubsystems, invDurableIntent, invNoTransitionViolation, invCheckpoints, invConvergenceWhenSettled }
}
