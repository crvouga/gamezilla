// @spec-interpretation
// Sources: specs/sync-engine
// Complete finite progress abstraction: one durable edit per representative
// device, permissions fixed after quiescence, and weakly fair recovery delivery.
// The broader recovery model additionally samples arbitrarily long queues.
module fair_recovery {
  import universe.* from "./universe"
  var dirty: Set[int]
  var frozen: bool
  var denied: Set[int]
  var online: Set[int]
  var pending: Set[int]
  var applied: Set[int]
  var rejected: Set[int]
  var seen: int -> Set[int]
  var unrelated: bool
  action init = all {
    dirty' = DEVICES, frozen' = false, denied' = Set(), online' = Set(), pending' = DEVICES,
    applied' = Set(), rejected' = Set(), seen' = DEVICES.mapBy(_ => Set()), unrelated' = false,
  }
  action freeze = all {
    not(frozen), dirty' = dirty, frozen' = true, denied' = denied, online' = online, pending' = pending,
    applied' = applied, rejected' = rejected, seen' = seen, unrelated' = unrelated,
  }
  action deny(p: int): bool = all {
    not(frozen), dirty' = dirty, denied' = denied.union(Set(p)), frozen' = frozen, online' = online, pending' = pending,
    applied' = applied, rejected' = rejected, seen' = seen, unrelated' = unrelated,
  }
  action noise = all {
    dirty' = dirty,
    frozen' = frozen, denied' = denied, online' = online, pending' = pending,
    applied' = applied, rejected' = rejected, seen' = seen, unrelated' = not(unrelated),
  }
  action recoverDevice(d: int): bool = all {
    frozen,
    frozen' = frozen, denied' = denied, unrelated' = unrelated,
    if (not(online.contains(d))) all {
      dirty' = dirty, online' = online.union(Set(d)), pending' = pending, applied' = applied, rejected' = rejected, seen' = seen,
    } else if (pending.contains(d) and not(applied.union(rejected).contains(d))) all {
      dirty' = dirty, applied' = if (denied.contains(personOn(d))) applied else applied.union(Set(d)),
      rejected' = if (denied.contains(personOn(d))) rejected.union(Set(d)) else rejected,
      online' = online, pending' = pending, seen' = seen,
    } else if (pending.contains(d)) all {
      dirty' = dirty, pending' = pending.exclude(Set(d)), online' = online, applied' = applied, rejected' = rejected, seen' = seen,
    } else all {
      seen.get(d) != applied or dirty.contains(d), dirty' = dirty.exclude(Set(d)), seen' = seen.set(d,applied),
      online' = online, pending' = pending, applied' = applied, rejected' = rejected,
    },
  }
  action recover = {
    nondet d = DEVICES.oneOf()
    recoverDevice(d)
  }
  action step = {
    nondet p = PEOPLE.oneOf()
    any { freeze, deny(p), recover, noise }
  }
  val done = dirty == Set() and pending == Set() and online == DEVICES and DEVICES.forall(d => seen.get(d) == applied)
  val invSafety = and {
    applied.intersect(rejected) == Set(), applied.subseteq(DEVICES), rejected.subseteq(DEVICES),
    DEVICES.exclude(pending).subseteq(applied.union(rejected)),
    applied.forall(d => not(denied.contains(personOn(d)))),
    DEVICES.forall(d => seen.get(d).subseteq(applied)),
  }
  temporal _fair = recover.weakFair((dirty,frozen,denied,online,pending,applied,rejected,seen,unrelated))
  temporal eventualConvergence = _fair.implies(always(frozen implies eventually(done)))
}
