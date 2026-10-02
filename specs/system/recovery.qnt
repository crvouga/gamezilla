// @spec-interpretation
// Sources: specs/sync-engine
// Conditional progress: after users/providers stop changing state, every active
// device returns and the scheduler delivers one recovery step. Permanent account
// deletion quarantines its unsendable intent; those devices are outside convergence.
// A strictly decreasing natural rank checks termination of this recovery protocol.
module recovery {
  import system_actions.* from "./system-actions"
  export system_actions.*
  import universe.* from "./universe"
  export universe.*
  import product_state.* from "./product-state"
  import replication.* from "./replication"
  import identity.* from "./identity"
  action setup = init
  def active(d: int): bool = authUsable(server.auth,clients.owner.get(d))
  def rank: int = syncRank(clients,server)
  action beginRecovery = all {
    not(quiescent), quiescent' = true, recoveryBudget' = rank + 1,
    server' = server, clients' = clients, covered' = covered.union(Set("begin-recovery")),
    violation' = violation,
  }
  action recover(d: int): bool = {
    val queue = clients.queue.get(d)
    val freshReply = clients.replies.keys().contains(d) and
      clients.replies.get(d).generation == clients.generation.get(d) and clients.replies.get(d).snapshotEpoch == clients.snapshotEpoch.get(d) and clients.replies.get(d).state.revision == server.revision
    all {
      quiescent, active(d), syncDeviceRank(clients,server,d) > 0,
      if (not(syncConnected(clients,d)))
        move(server,{ ...clients, online: clients.online.union(Set(d)), running: clients.running.union(Set(d)) },"recovery-connect")
      else if (not(syncSession(clients,server,d)))
        move(server,syncSwitchOwner(clients,server,d,clients.owner.get(d)),"recovery-session")
      else if (queue.length() > 0 and not(clients.decision.keys().contains(queue.nth(0)))) upload(d)
      else if (queue.length() > 0) acknowledge(d)
      else if (not(freshReply)) move(server,syncCapture(clients,server,d),"recovery-snapshot")
      else receiveSnapshot(d),
    }
  }
  action step = {
    nondet d = DEVICES.oneOf()
    nondet p = PEOPLE.oneOf()
    nondet id = Set(0,1,2).oneOf()
    nondet value = Set(0,1,2).oneOf()
    nondet kind = Set("write", "delete", "profile", "start", "finish").oneOf()
    if (quiescent) any {
      all { rank > 0, recover(d) },
      all { rank == 0, move(server,clients,"recovered") },
    } else all {
      any {
        emit(d,kind,id,value), upload(d), acknowledge(d), requestSnapshot(d), receiveSnapshot(d),
        optimisticPeerPush(d,(d + 1) % DEVICES.size()), disconnect(d), reconnect(d), crash(d), restart(d), revoke(p), signIn(d,p),
        eraseAccount(p), beginRecovery,
      },
    }
  }
  // Extended sampling folds the absorbing recovered suffix into one terminal state.
  // No changing transition is removed; the ordinary scheduler retains its stutter.
  action exploreStep = all { not(quiescent) or rank > 0, step }
  // A bounded response assertion is checked by literal recovery traces below.
  // This temporal declaration is an obligation, not a claim that random safety
  // exploration or Apalache's invariant mode establishes unbounded fairness.
  temporal eventuallyConverges = always(quiescent implies eventually(rank == 0))
  val invSafety = and { invSubsystems, invDurableIntent, invNoTransitionViolation, invCheckpoints, invConvergenceWhenSettled, (quiescent and recoveryBudget > 0 implies rank < recoveryBudget) }
  run offlineQueueRecoversTest = setup.then(disconnect(1)).then(emit(1,"write",0,2))
    .then(crash(1)).then(revoke(0)).then(beginRecovery)
    .then(recover(1)).then(recover(1)).then(recover(1)).then(recover(1)).then(recover(1)).then(recover(1))
    .expect(clients.queue.get(1).length() == 0 and clients.checkpoint.get(1) == server.revision and invDurableIntent)
}
