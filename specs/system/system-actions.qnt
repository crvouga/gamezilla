// @spec-interpretation
// Sources: specs/auth, specs/billing, specs/chess, specs/friends, specs/matchmaking, specs/profile, specs/room, specs/spaces, specs/sync-engine
// Composed actions: server acceptance, client persistence, and external events
// are separate steps so loss/delay/revocation can interleave at every boundary.
module system_actions {
  import universe.* from "./universe"
  export universe.*
  import product_state.* from "./product-state"
  import replication.* from "./replication"
  import client_image.* from "./client-image"
  import identity.* from "./identity"
  import membership.* from "./membership"
  import community.* from "./community"
  import play.* from "./play"
  import privacy.* from "./privacy"
  import notifications.* from "./notifications"
  import puzzle_board.* from "./puzzle-board"
  var server: ProductState
  var clients: ReplicationState
  // Transition monitors check relations between before/after states, rather
  // than relying exclusively on structural invariants of a single snapshot.
  var violation: Set[str]
  var covered: Set[str]
  var quiescent: bool
  var recoveryBudget: int

  // Joining and live room use need a connected host, independently of
  // retained access or participation on either person's device.
  def hostAvailable(id: int): bool = DEVICES.exists(d =>
    clients.owner.get(d) == server.social.spaces.get(id).owner and
      syncConnected(clients,d) and syncSession(clients,server,d))

  action init = all {
    server' = productInitial, clients' = syncInitial(productInitial),
    violation' = Set(), covered' = Set(), quiescent' = false, recoveryBudget' = 0,
  }
  action move(s: ProductState, c: ReplicationState, label: str): bool = all {
    server' = s, clients' = c, covered' = covered.union(Set(label)),
    violation' = violation.union(
      if (DEVICES.exists(d => c.generation.get(d) == clients.generation.get(d) and c.checkpoint.get(d) < clients.checkpoint.get(d)))
        Set("checkpoint-regressed") else Set()
    ).union(if (not(server.auth.removed.subseteq(s.auth.removed))) Set("account-resurrected") else Set()).union(
      if (server.game.outcomes.exists(o => not(s.auth.removed.contains(o._1)) and
        not(s.game.outcomes.contains(o)) and not(s.game.rated.contains((o._1,o._2))))) Set("saved-outcome-lost") else Set()
    ).union(if (label == "retry" and s != server) Set("duplicate-effect") else Set())
    .union(if (label == "unauthorized-acceptance") Set(label) else Set())
    .union(if (server.game.rated.exists(k => not(s.auth.removed.contains(k._1)) and
      (not(s.game.rated.contains(k)) or s.game.results.get(k) != server.game.results.get(k)))) Set("first-result-changed") else Set()),
    quiescent' = quiescent, recoveryBudget' = if (quiescent) syncRank(clients,server) else recoveryBudget,
  }
  action emit(d: int, kind: str, resource: int, value: int): bool = all {
    not(quiescent), clients.running.contains(d),
    if (Set("start", "finish").contains(kind)) PUZZLES.contains(resource) else SPACES.contains(resource),
    // An offline client cannot know that its remote session was revoked or
    // its account deleted. It may keep writing against its persisted picture.
    clients.held.contains(d), clients.base.get(d).available.contains(clients.owner.get(d)),
    productOFFLINE.contains(kind) or syncConnected(clients,d),
    not(boardKINDS.contains(kind)) or clients.puzzleCache.contains(d),
    move(server,syncEnqueue(clients,server,d,kind,resource,value),kind),
  }
  action uploadAt(d: int, index: int): bool = {
    val queue = clients.queue.get(d)
    all {
      syncConnected(clients,d), queue.indices().contains(index),
      // Admission uses the current capability and the command's original actor.
      syncSession(clients,server,d),
      val id = queue.nth(index)
      val before = queue.slice(0,index)
      val o = clients.ops.get(id)
      val fresh = not(clients.decision.keys().contains(id))
      val allowed = o.actor == clients.owner.get(d) and productAllowed(server,o) and
        (o.kind != "join" or hostAvailable(o.resource))
      // Independent proof of the before-state facts, confined to admission so
      // the symbolic compiler does not duplicate it into every unrelated action.
      val justified = clients.held.contains(d) and clients.owner.get(d) == o.actor and
        clients.token.get(d) == server.auth.epoch.get(o.actor) and authUsable(server.auth,o.actor) and productAllowed(server,o) and
        (o.kind != "join" or hostAvailable(o.resource))
      all {
        // SQL and room channels preserve their own order, not a shared order.
        before.indices().forall(i => clients.decision.keys().contains(before.nth(i)) or
          boardKINDS.contains(clients.ops.get(before.nth(i)).kind) != boardKINDS.contains(o.kind)),
        move(if (fresh and allowed) productEffect(server,o) else server,
          syncDecide(clients,id,allowed,if (allowed) server.revision + 1 else server.revision),if (fresh and allowed and not(justified)) "unauthorized-acceptance" else if (fresh) "upload" else "retry"),
      }
    }
  }
  action upload(d: int): bool = all {
    clients.queue.get(d).length() > 0,
    nondet index = clients.queue.get(d).indices().oneOf()
    uploadAt(d,index),
  }
  action tryUpload(d: int): bool = all {
    syncConnected(clients,d),
    if (syncSession(clients,server,d)) upload(d) else move(server,clients,"expired-upload"),
  }
  action acknowledge(d: int): bool = all {
    syncConnected(clients,d),
    clients.queue.get(d).indices().exists(i => clients.decision.keys().contains(clients.queue.get(d).nth(i))),
    move(server,syncAck(clients,d),"acknowledge"),
  }
  action requestSnapshot(d: int): bool = all {
    syncConnected(clients,d), syncSession(clients,server,d),
    not(clients.replies.keys().contains(d)),
    move(server,syncCapture(clients,server,d),"snapshot-request"),
  }
  action receiveSnapshot(d: int): bool = all {
    syncConnected(clients,d), clients.replies.keys().contains(d),
    move(server,syncReceive(clients,d),"snapshot-receive"),
  }
  // A committed push raises the snapshot fence in the same logical transaction.
  // A delayed older snapshot must not revive a note overwritten by this push.
  action applyPush(d: int): bool = all {
    syncConnected(clients,d), syncSession(clients,server,d),
    server.revision > clients.floor.get(d), productCanSeeNotes(server,clients.owner.get(d)),
    move(server,{ ...clients,
      peerNotes: clients.peerNotes.set(d,Map()), base: clients.base.set(d,{ ...clients.base.get(d), notes: server.notes }),
      floor: clients.floor.set(d,server.revision),
    },"push"),
  }
  // Provisional peer row images may precede authority, and may later be refused.
  // They do not raise a server checkpoint. A complete permitted snapshot heals them.
  action optimisticPeerPush(from: int, target: int): bool = {
    val available = clients.published.filter(id => clients.ops.get(id).device == from)
    all {
      not(quiescent), syncConnected(clients,target), from != target,
      productCanSeeNotes(server,clients.owner.get(target)), available != Set(),
      nondet id = available.oneOf()
      val op = clients.ops.get(id)
      all {
        Set("write","delete").contains(op.kind),
        // Already-published messages can arrive after acceptance, rejection,
        // sender disconnection or loss of acknowledgement, and can be duplicated.
        move(server,{ ...clients, peerNotes: clients.peerNotes.set(target,clients.peerNotes.get(target).put(op.resource,
          { value: op.value, deleted: op.kind == "delete", revision: 0 })) },"optimistic-peer-push"),
      }
    }
  }
  action dropReply(d: int): bool = all {
    clients.replies.keys().contains(d),
    move(server,{ ...clients, replies: clients.replies.keys().exclude(Set(d)).mapBy(k => clients.replies.get(k)) },"drop-reply"),
  }
  action disconnect(d: int): bool = all {
    not(quiescent), clients.online.contains(d),
    move(server,{ ...clients, online: clients.online.exclude(Set(d)) },"disconnect"),
  }
  action reconnect(d: int): bool = all {
    not(clients.online.contains(d)),
    move(server,{ ...clients, online: clients.online.union(Set(d)) },"reconnect"),
  }
  action crash(d: int): bool = all {
    not(quiescent), clients.running.contains(d),
    move(server,{ ...clients, running: clients.running.exclude(Set(d)) },"crash"),
  }
  action restart(d: int): bool = all {
    not(clients.running.contains(d)),
    move(server,{ ...clients, running: clients.running.union(Set(d)) },"restart"),
  }
  action revoke(p: int): bool = all {
    not(quiescent), authUsable(server.auth,p),
    move({ ...server, auth: authRevoke(server.auth,p), revision: server.revision + 1 },clients,"revoke"),
  }
  action signIn(d: int, p: int): bool = all {
    not(quiescent), syncConnected(clients,d), authUsable(server.auth,p),
    move(server,syncSwitchOwner(clients,server,d,p),"sign-in"),
  }
  action forgetSession(d: int): bool = all {
    not(quiescent), clients.running.contains(d), clients.held.contains(d),
    move(server,{ ...clients, held: clients.held.exclude(Set(d)), generation: clients.generation.set(d,clients.generation.get(d) + 1) },"forget-session"),
  }
  action register(p: int): bool = all {
    not(quiescent), authUsable(server.auth,p), not(server.auth.registered.contains(p)),
    move({ ...server, auth: authRegister(server.auth,p), revision: server.revision + 1 },clients,"register"),
  }
  action startLink(d: int, i: int): bool = {
    val p = clients.owner.get(d)
    val proposal = authPropose(server.auth,i,p,false)
    all {
      not(quiescent), syncConnected(clients,d), syncSession(clients,server,d), authAccount(server.auth,p),
      move({ ...server, auth: { ...proposal,
        pendingDevice: proposal.pendingDevice.set(i,d), pendingGeneration: proposal.pendingGeneration.set(i,clients.generation.get(d)),
      }, revision: server.revision + 1 },clients,"start-link"),
    }
  }
  action finishLink(d: int, i: int): bool = all {
    not(quiescent), syncConnected(clients,d), syncSession(clients,server,d),
    move({ ...server, auth: if (server.auth.pendingDevice.get(i) == d and server.auth.pendingGeneration.get(i) == clients.generation.get(d))
      authConfirm(server.auth,i,clients.owner.get(d)) else server.auth, revision: server.revision + 1 },clients,"finish-link"),
  }
  action unlinkMethod(d: int, i: int): bool = all {
    not(quiescent), syncConnected(clients,d), syncSession(clients,server,d),
    move({ ...server, auth: authUnlink(server.auth,i,clients.owner.get(d)), revision: server.revision + 1 },clients,"unlink"),
  }
  action automaticLink(p: int, i: int): bool = all {
    not(quiescent),
    move({ ...server, auth: authPropose(server.auth,i,p,true), revision: server.revision + 1 },clients,"automatic-link"),
  }
  action eraseAccount(p: int): bool = all {
    not(quiescent), authAccount(server.auth,p),
    move(productErase(server,p),clients,"erase-account"),
  }
  action providerChange(p: int, provider: int, status: str, period: int): bool = all {
    not(quiescent), authAccount(server.auth,p),
    move({ ...server, billing: billingChange(server.billing,p,provider,status,period),
      revision: server.revision + 1 },clients,"provider-change"),
  }
  action advanceTime(days: int): bool = all {
    not(quiescent),
    days > 0,
    move({ ...server, now: server.now + days, day: server.day + days,
      auth: authExpireProposals(server.auth), social: { ...server.social, cooldown: Set() },
      privacy: privacyTick(server.privacy,server.now + days), revision: server.revision + 1 },{ ...clients, clock: DEVICES.mapBy(d => clients.clock.get(d) + days) },"time"),
  }
  action timePasses: bool = advanceTime(1)
  action confirmDeletion(d: int): bool = all {
    syncConnected(clients,d), syncSession(clients,server,d), server.privacy.recent.contains(d),
    eraseAccount(clients.owner.get(d)),
  }
  action proveAgain(d: int): bool = all {
    not(quiescent), syncConnected(clients,d), syncSession(clients,server,d),
    move({ ...server, privacy: { ...server.privacy, recent: server.privacy.recent.union(Set(d)) }, revision: server.revision + 1 },clients,"prove-again"),
  }
  action requestExport(d: int): bool = {
    val p = clients.owner.get(d)
    all {
      not(quiescent), syncConnected(clients,d), syncSession(clients,server,d),
      authAccount(server.auth,p), server.privacy.recent.contains(d),
      server.privacy.exports.get(p) != "preparing",
      move({ ...server, privacy: privacyRequest(server.privacy,p,server.now), revision: server.revision + 1 },clients,"request-export"),
    }
  }
  action exportReady(p: int): bool = all {
    not(quiescent), server.privacy.exports.get(p) == "preparing",
    move({ ...server, privacy: privacyReady(server.privacy,p,server.now), revision: server.revision + 1 },clients,"export-ready"),
  }
  action exportFailure(p: int): bool = all {
    not(quiescent), server.privacy.exports.get(p) == "preparing",
    move({ ...server, privacy: { ...server.privacy, exports: server.privacy.exports.set(p,"failed") }, revision: server.revision + 1 },clients,"export-failure"),
  }
  action downloadExport(d: int, p: int): bool = all {
    not(quiescent), syncConnected(clients,d), syncSession(clients,server,d),
    clients.owner.get(d) == p, server.privacy.recent.contains(d),
    authAccount(server.auth,p), server.privacy.exports.get(p) == "ready",
    move(server,clients,"download-export"),
  }
  action cancellationConfirmed(p: int, provider: int): bool = all {
    not(quiescent), server.privacy.cancellationPending.contains((p,provider)),
    move({ ...server, privacy: { ...server.privacy, cancellationPending: server.privacy.cancellationPending.exclude(Set((p,provider))) }, revision: server.revision + 1 },clients,"cancel-confirmed"),
  }
  action latePayment(p: int, payment: int): bool = all {
    not(quiescent), server.auth.removed.contains(p),
    move({ ...server, privacy: { ...server.privacy, payments: server.privacy.payments.union(Set((p,payment))), refundsPending: if (server.privacy.refunded.contains((p,payment))) server.privacy.refundsPending else server.privacy.refundsPending.union(Set((p,payment))) }, revision: server.revision + 1 },clients,"late-payment"),
  }
  action refundConfirmed(p: int, payment: int): bool = all {
    not(quiescent), server.privacy.refundsPending.contains((p,payment)),
    move({ ...server, privacy: { ...server.privacy, refundsPending: server.privacy.refundsPending.exclude(Set((p,payment))), refunded: server.privacy.refunded.union(Set((p,payment))) }, revision: server.revision + 1 },clients,"refund-confirmed"),
  }
  action deliverInbox(a: int, b: int): bool = all {
    not(quiescent), authAccount(server.auth,a), authAccount(server.auth,b),
    move({ ...server, notifications: inboxPublish(server.notifications,(a,b),server.social.requests.contains((a,b)) and not(socialBlocked(server.social,a,b))), social: socialDeliver(server.social,a,b), revision: server.revision + 1 },clients,"inbox-delivery"),
  }
  action retireInbox(a: int, b: int): bool = all {
    not(quiescent), not(server.social.requests.contains((a,b))),
    move({ ...server, notifications: inboxDeactivate(server.notifications,(a,b)), revision: server.revision + 1 },clients,"retire-inbox"),
  }
  action interactInbox(d: int, sender: int, kind: str): bool = all {
    not(quiescent), syncConnected(clients,d), syncSession(clients,server,d), authAccount(server.auth,clients.owner.get(d)),
    move({ ...server, notifications: inboxInteract(server.notifications,(sender,clients.owner.get(d)),clients.owner.get(d),kind),
      revision: server.revision + 1 },clients,"inbox-interaction"),
  }
  action matchPeople(a: int, b: int): bool = all {
    not(quiescent),
    move({ ...server, game: gameMatchPair(server.game,a,b), revision: server.revision + 1 },clients,"match"),
  }
  action finishMatch(a: int, b: int): bool = {
    val pair = socialPair(a,b)
    val candidates = server.game.matches.keys().filter(id => server.game.matches.get(id) == pair and not(server.game.finished.contains(id)))
    all {
      not(quiescent), candidates != Set(),
      nondet id = candidates.oneOf()
      move({ ...server, game: { ...server.game, finished: server.game.finished.union(Set(id)) },
        revision: server.revision + 1 },clients,"finish-match"),
    }
  }
  action cachePuzzles(d: int): bool = all {
    not(quiescent), syncConnected(clients,d), syncSession(clients,server,d),
    move(server,{ ...clients, puzzleCache: clients.puzzleCache.union(Set(d)) },"cache-puzzles"),
  }
  // Only a live observer can turn a room transition into saved result work.
  // A lost notification followed by restoration need not record that transition.
  action captureBoardOutcome(d: int): bool = all {
    not(quiescent), syncConnected(clients,d), syncSession(clients,server,d),
    server.game.unobserved.exists(o => o._1 == clients.owner.get(d)),
    nondet outcome = server.game.unobserved.filter(o => o._1 == clients.owner.get(d)).oneOf()
    move({ ...server, game: { ...server.game, unobserved: server.game.unobserved.exclude(Set(outcome)),
      outcomes: server.game.outcomes.union(Set(outcome)) }, revision: server.revision + 1 },clients,"capture-outcome"),
  }
  action loseBoardNotification: bool = all {
    not(quiescent), server.game.unobserved != Set(),
    nondet outcome = server.game.unobserved.oneOf()
    move({ ...server, game: { ...server.game, unobserved: server.game.unobserved.exclude(Set(outcome)) },
      revision: server.revision + 1 },clients,"lost-room-notification"),
  }
  action recordBoardOutcome: bool = all {
    not(quiescent), server.game.outcomes != Set(),
    nondet outcome = server.game.outcomes.oneOf()
    all {
      authUsable(server.auth,outcome._1), gameCharged(server.game,outcome._1,outcome._2),
      val changed = gameFinish(server.game,outcome._1,outcome._2,outcome._3)
      move({ ...server, game: { ...changed, outcomes: changed.outcomes.exclude(Set(outcome)) }, revision: server.revision + 1 },clients,"board-outcome"),
    }
  }
  action roomMove(d: int, id: int): bool = {
    val r = if (SPACES.contains(id)) server.social.spaces.get(id) else socialEmptySpace
    val p = clients.owner.get(d)
    all {
      not(quiescent), syncConnected(clients,d), syncSession(clients,server,d),
      r.open, r.game != -1, r.members.contains(p), hostAvailable(id),
      move({ ...server, game: { ...server.game, roomMoves: server.game.roomMoves.set(id,server.game.roomMoves.get(id) + 1) },
        revision: server.revision + 1 },clients,"room-move"),
    }
  }
  // Infrastructure failure before transaction commit is a stutter; after commit
  // it is a lost acknowledgement, already represented by upload without ack.
  action failAttempt: bool = move(server,clients,"failed-attempt")

  val invSubsystems = productValid(server)
  val invDurableIntent = syncValid(clients)
  val invNoTransitionViolation = violation == Set()
  val invCheckpoints = DEVICES.forall(d => clients.checkpoint.get(d) <= server.revision)
  val invConvergenceWhenSettled = DEVICES.forall(d =>
    syncConnected(clients,d) and syncSession(clients,server,d) and
    clients.queue.get(d).length() == 0 and clients.checkpoint.get(d) == server.revision and
    (not(productCanSeeNotes(server,clients.owner.get(d))) or clients.peerNotes.get(d).keys() == Set())
      implies clients.base.get(d) == { ...imageProject(server), confirmedAt: clients.base.get(d).confirmedAt, notes: if (productCanSeeNotes(server,clients.owner.get(d))) server.notes else clients.base.get(d).notes, now: clients.base.get(d).now, day: clients.base.get(d).day })
}
