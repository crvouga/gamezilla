// @spec-interpretation
// Sources: specs/sync-engine
// Deep exploration of independent connectivity, durable intent, optimistic
// rebasing, actor/session fences, lost acknowledgements and tombstones.
module offline_replication {
  import system_actions.* from "./system-actions"
  export system_actions.*
  import universe.* from "./universe"
  export universe.*
  action step = {
    nondet d = DEVICES.oneOf()
    nondet p = PEOPLE.oneOf()
    nondet id = Set(0,1).oneOf()
    nondet value = Set(0,1,2).oneOf()
    nondet kind = Set("write", "delete", "profile").oneOf()
    any {
      emit(d,kind,id,value), tryUpload(d), acknowledge(d),
      requestSnapshot(d), receiveSnapshot(d), optimisticPeerPush(d,(d + 1) % DEVICES.size()), applyPush(d), dropReply(d),
      disconnect(d), reconnect(d), crash(d), restart(d),
      revoke(p), signIn(d,p), eraseAccount(p), failAttempt,
    }
  }
  val invSafety = and { invSubsystems, invDurableIntent, invNoTransitionViolation, invCheckpoints, invConvergenceWhenSettled }
}
