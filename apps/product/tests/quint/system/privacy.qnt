// @spec-interpretation
// Sources: specs/profile
// Logical privacy lifecycle. Durations are days; re-proof is represented by a
// separate recent/not-recent class, since every modeled time tick exceeds ten minutes.
// Delivery failures leave work pending; time-driven expiry is a contract obligation.
module privacy {
  import universe.* from "./universe"
  type PrivacyState = {
    stage: int -> str, exports: int -> str, retained: Set[int],
    deletedAt: int -> int, requestedAt: int -> int, readyAt: int -> int,
    recent: Set[int], cancellationPending: Set[(int,int)], refundsPending: Set[(int,int)], payments: Set[(int,int)], refunded: Set[(int,int)],
  }
  pure val privacyInitial: PrivacyState = {
    stage: PEOPLE.mapBy(_ => "active"), exports: PEOPLE.mapBy(_ => "none"), retained: PEOPLE,
    deletedAt: PEOPLE.mapBy(_ => -1), requestedAt: PEOPLE.mapBy(_ => -1), readyAt: PEOPLE.mapBy(_ => -1),
    recent: DEVICES, cancellationPending: Set(), refundsPending: Set(), payments: Set(), refunded: Set(),
  }
  pure def privacyDelete(s: PrivacyState, p: int, now: int): PrivacyState = {
    ...s, stage: s.stage.set(p,"deleting"), exports: s.exports.set(p,"expired"),
    deletedAt: s.deletedAt.set(p,now), cancellationPending: s.cancellationPending.union(Set((p,0),(p,1))),
  }
  pure def privacyRequest(s: PrivacyState, p: int, now: int): PrivacyState = {
    ...s, exports: s.exports.set(p,"preparing"), requestedAt: s.requestedAt.set(p,now),
  }
  pure def privacyReady(s: PrivacyState, p: int, now: int): PrivacyState =
    if (s.stage.get(p) != "active" or s.exports.get(p) != "preparing") s
    else { ...s, exports: s.exports.set(p,"ready"), readyAt: s.readyAt.set(p,now) }
  pure def privacyTick(s: PrivacyState, now: int): PrivacyState = {
    ...s, recent: Set(),
    stage: PEOPLE.mapBy(p => if (s.stage.get(p) == "deleting" and now >= s.deletedAt.get(p) + 30) "deleted" else s.stage.get(p)),
    retained: s.retained.filter(p => s.stage.get(p) == "active" or now < s.deletedAt.get(p) + 30),
    exports: PEOPLE.mapBy(p =>
      if (s.exports.get(p) == "ready" and now >= s.readyAt.get(p) + 7) "expired"
      else if (s.exports.get(p) == "preparing" and now > s.requestedAt.get(p) + 1) "failed"
      else s.exports.get(p)),
  }
  pure def privacyValid(s: PrivacyState, now: int): bool = and {
    PEOPLE.forall(p => s.stage.get(p) != "active" implies s.exports.get(p) == "expired"),
    PEOPLE.forall(p => s.stage.get(p) == "deleted" implies not(s.retained.contains(p))),
    PEOPLE.forall(p => s.exports.get(p) == "ready" implies now < s.readyAt.get(p) + 7),
    s.cancellationPending.forall(k => s.stage.get(k._1) != "active"),
    s.refundsPending.forall(k => s.stage.get(k._1) != "active"),
    s.payments == s.refundsPending.union(s.refunded), s.refundsPending.intersect(s.refunded) == Set(),
  }
}
