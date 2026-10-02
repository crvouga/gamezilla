// @spec-interpretation
// Sources: specs/sync-engine
// Durable queues and delayed snapshots. Transport loss never deletes durable intent.
// Queued operations retain their original actor; uploads need a current capability.
module replication {
  import universe.* from "./universe"
  export universe.*
  import product_state.* from "./product-state"
  import client_image.* from "./client-image"
  type SnapshotReply = { permittedNotes: bool, state: ClientImage, generation: int, snapshotEpoch: int, actor: int }
  type ReplicationState = {
    clock: int -> int, puzzleCache: Set[int], online: Set[int], running: Set[int], held: Set[int], owner: int -> int, token: int -> int,
    generation: int -> int, snapshotEpoch: int -> int, queue: int -> List[int], ops: int -> ProductOp,
    decision: int -> str, committedRevision: int -> int, effects: int -> int, authorized: Set[int],
    peerNotes: int -> (int -> ProductNote), base: int -> ClientImage, checkpoint: int -> int, floor: int -> int,
    replies: int -> SnapshotReply, published: Set[int], nextId: int, issued: Set[int], acknowledged: Set[int],
  }
  pure def syncInitial(s: ProductState): ReplicationState = {
    clock: DEVICES.mapBy(_ => s.now), puzzleCache: Set(0,1), online: DEVICES, running: DEVICES, held: DEVICES, owner: deviceOwners,
    token: DEVICES.mapBy(_ => 0), generation: DEVICES.mapBy(_ => 0), snapshotEpoch: DEVICES.mapBy(_ => 0),
    queue: DEVICES.mapBy(_ => []), ops: Map(), decision: Map(), committedRevision: Map(), effects: Map(), authorized: Set(),
    peerNotes: DEVICES.mapBy(_ => Map()), base: DEVICES.mapBy(_ => imageProject(s)), checkpoint: DEVICES.mapBy(_ => 0), floor: DEVICES.mapBy(_ => 0), replies: Map(),
    published: Set(), nextId: 0, issued: Set(), acknowledged: Set(),
  }
  pure def syncConnected(r: ReplicationState, d: int): bool = r.online.contains(d) and r.running.contains(d)
  pure def syncSession(r: ReplicationState, s: ProductState, d: int): bool =
    r.held.contains(d) and not(s.auth.removed.contains(r.owner.get(d))) and r.token.get(d) == s.auth.epoch.get(r.owner.get(d))
  pure def syncEnqueue(r: ReplicationState, s: ProductState, d: int, kind: str, resource: int, value: int): ReplicationState = {
    val id = r.nextId
    val o: ProductOp = { id: id, device: d, actor: r.owner.get(d), kind: kind, resource: resource, value: value, day: r.clock.get(d) }
    { ...r, published: if (syncConnected(r,d)) r.published.union(Set(id)) else r.published, ops: r.ops.put(id,o), nextId: id + 1, issued: r.issued.union(Set(id)),
      effects: r.effects.put(id,0), queue: r.queue.set(d,r.queue.get(d).append(id)) }
  }
  pure def syncDecide(r: ReplicationState, id: int, allowed: bool, revision: int): ReplicationState =
    if (r.decision.keys().contains(id)) r
    else { ...r, decision: r.decision.put(id,if (allowed) "applied" else "rejected"),
      committedRevision: r.committedRevision.put(id,revision), effects: r.effects.set(id,if (allowed) 1 else 0),
      authorized: if (allowed) r.authorized.union(Set(id)) else r.authorized }
  pure def syncAck(r: ReplicationState, d: int): ReplicationState = {
    val ids = r.queue.get(d).select(id => r.decision.keys().contains(id))
    val accepted = ids.select(id => r.decision.get(id) == "applied")
    // Ack removes retry metadata, not the actual local row image. Preserve
    // accepted local rows without reapplying them over a newer authoritative image.
    val base = accepted.foldl(r.base.get(d),(b,id) => {
      val o = r.ops.get(id)
      val watermark = if (Set("write","delete").contains(o.kind)) r.floor.get(d) else r.checkpoint.get(d)
      if (o.actor != r.owner.get(d) or watermark >= r.committedRevision.get(id)) b
      else { ...imageEffect(b,o), revision: b.revision }
    })
    { ...r, base: r.base.set(d,base), snapshotEpoch: r.snapshotEpoch.set(d,r.snapshotEpoch.get(d) + (if (accepted.length() > 0) 1 else 0)), queue: r.queue.set(d,r.queue.get(d).select(id => not(r.decision.keys().contains(id)))),
      acknowledged: r.acknowledged.union(ids.foldl(Set(),(xs,x) => xs.union(Set(x)))) }
  }
  pure def syncCapture(r: ReplicationState, s: ProductState, d: int): ReplicationState = {
    val permitted = productCanSeeNotes(s,r.owner.get(d))
    val scoped = if (permitted) imageProject(s) else { ...imageProject(s), notes: r.base.get(d).notes }
    { ...r, replies: r.replies.put(d,{ permittedNotes: permitted, state: scoped, generation: r.generation.get(d), snapshotEpoch: r.snapshotEpoch.get(d), actor: r.owner.get(d) }) }
  }
  pure def syncReceive(r: ReplicationState, d: int): ReplicationState = {
    val reply = r.replies.get(d)
    val current = reply.generation == r.generation.get(d) and reply.snapshotEpoch == r.snapshotEpoch.get(d) and reply.actor == r.owner.get(d)
    val newer = (reply.state.revision > r.checkpoint.get(d) or
      (reply.state.revision == r.checkpoint.get(d) and reply.permittedNotes and r.peerNotes.get(d).keys() != Set())) and reply.state.revision >= r.floor.get(d)
    if (not(current and newer)) { ...r, replies: r.replies.keys().exclude(Set(d)).mapBy(k => r.replies.get(k)) }
    else { ...r, peerNotes: if (reply.permittedNotes) r.peerNotes.set(d,Map()) else r.peerNotes, base: r.base.set(d,reply.state), checkpoint: r.checkpoint.set(d,reply.state.revision), floor: r.floor.set(d,reply.state.revision),
      replies: r.replies.keys().exclude(Set(d)).mapBy(k => r.replies.get(k)) }
  }
  pure def syncSwitchOwner(r: ReplicationState, s: ProductState, d: int, p: int): ReplicationState = {
    ...r, peerNotes: r.peerNotes.set(d,Map()), held: r.held.union(Set(d)), owner: r.owner.set(d,p), token: r.token.set(d,s.auth.epoch.get(p)),
    generation: r.generation.set(d,r.generation.get(d) + 1),
    base: r.base.set(d,imageProject(productInitial)), checkpoint: r.checkpoint.set(d,-1), floor: r.floor.set(d,-1),
  }
  // Optimistic content is a projection of the last baseline plus every still-pending
  // local operation in order. It is deliberately allowed to disagree with authority.
  pure def syncView(r: ReplicationState, d: int): ClientImage =
    if (r.queue.get(d).length() == 0 and r.peerNotes.get(d).keys() == Set()) { ...r.base.get(d), now: r.clock.get(d), day: r.clock.get(d) }
    else r.queue.get(d).foldl({ ...r.base.get(d), now: r.clock.get(d), day: r.clock.get(d), notes: productNOTES.mapBy(id =>
      if (r.peerNotes.get(d).keys().contains(id)) r.peerNotes.get(d).get(id) else r.base.get(d).notes.get(id)) },(s,id) => {
      val o = r.ops.get(id)
      if (o.actor == r.owner.get(d) and imageAllowed(s,o)) imageEffect(s,o) else s
    })
  pure def syncDeviceRank(c: ReplicationState, s: ProductState, d: int): int = {
    val q = c.queue.get(d)
    val pending = q.select(id => not(c.decision.keys().contains(id))).length()
    val connectedCost = if (syncConnected(c,d)) 0 else 2
    val tokenCost = if (syncSession(c,s,d)) 0 else 5
    val freshReply = c.replies.keys().contains(d) and
      c.replies.get(d).generation == c.generation.get(d) and c.replies.get(d).snapshotEpoch == c.snapshotEpoch.get(d) and c.replies.get(d).state.revision == s.revision
    val snapshotCost = if (c.checkpoint.get(d) == s.revision and
      (not(productCanSeeNotes(s,c.owner.get(d))) or c.peerNotes.get(d).keys() == Set())) 0 else if (freshReply) 1 else 2
    q.length() * 20 + pending * 20 + connectedCost + tokenCost + snapshotCost
  }
  pure def syncRank(c: ReplicationState, s: ProductState): int =
    DEVICES.filter(d => not(s.auth.removed.contains(c.owner.get(d))))
      .fold(0,(sum,d) => sum + syncDeviceRank(c,s,d))
  pure def syncValid(r: ReplicationState): bool = and {
    r.issued == r.ops.keys(), r.published.subseteq(r.issued),
    r.decision.keys().subseteq(r.issued), r.committedRevision.keys() == r.decision.keys(), r.acknowledged.subseteq(r.decision.keys()),
    r.effects.keys() == r.issued,
    r.issued.forall(id => r.effects.get(id) >= 0 and r.effects.get(id) <= 1),
    r.issued.forall(id => r.effects.get(id) == 1 implies
      r.decision.get(id) == "applied" and r.authorized.contains(id)),
    r.decision.keys().forall(id => r.decision.get(id) == "rejected" implies r.effects.get(id) == 0),
    DEVICES.forall(d => and {
      r.queue.get(d).foldl(Set(),(xs,x) => xs.union(Set(x))).subseteq(r.issued),
      r.queue.get(d).length() == r.queue.get(d).foldl(Set(),(xs,x) => xs.union(Set(x))).size(),
      r.queue.get(d).indices().forall(i => r.ops.get(r.queue.get(d).nth(i)).device == d),
      r.base.get(d).revision == r.checkpoint.get(d) or r.checkpoint.get(d) == -1,
    }),
    r.issued == r.acknowledged.union(DEVICES.fold(Set(),(ids,d) => ids.union(r.queue.get(d).foldl(Set(),(xs,x) => xs.union(Set(x)))))),
  }
}
