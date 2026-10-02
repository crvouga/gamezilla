// @spec-interpretation
// Sources: specs/auth, specs/profile
// Verification abstraction of accounts, session revocation and identity linking.
// Signing in and linking methods follow the account rules.
module identity {
  import universe.* from "./universe"
  export universe.*
  type IdentityState = {
    registered: Set[int], removed: Set[int], epoch: int -> int,
    identityOwner: int -> int, pending: int -> int, pendingEpoch: int -> int, active: Set[int],
    pendingDevice: int -> int, pendingGeneration: int -> int,
  }
  pure val authIDENTITIES = Set(0,1,2,3,4)
  pure def authProvider(i: int): int = if (Set(2,3).contains(i)) 1 else 0
  pure def authMethods(s: IdentityState, p: int): Set[int] = s.active.filter(i => s.identityOwner.get(i) == p)
  pure def authFreeProvider(s: IdentityState, i: int, p: int): bool =
    authMethods(s,p).forall(j => authProvider(j) != authProvider(i))
  pure val authInitial: IdentityState = {
    registered: Set(0, 1), removed: Set(), epoch: PEOPLE.mapBy(_ => 0),
    identityOwner: Map(0 -> 0, 1 -> 1, 2 -> -1, 3 -> -1, 4 -> -1),
    pending: authIDENTITIES.mapBy(_ => -1), pendingEpoch: authIDENTITIES.mapBy(_ => -1), active: Set(0,1),
    pendingDevice: authIDENTITIES.mapBy(_ => -1), pendingGeneration: authIDENTITIES.mapBy(_ => -1),
  }
  pure def authUsable(s: IdentityState, p: int): bool = not(s.removed.contains(p))
  pure def authAccount(s: IdentityState, p: int): bool = authUsable(s, p) and s.registered.contains(p)
  pure def authRevoke(s: IdentityState, p: int): IdentityState = { ...s, epoch: s.epoch.set(p, s.epoch.get(p) + 1) }
  pure def authErase(s: IdentityState, p: int): IdentityState = { ...authRevoke(s, p), removed: s.removed.union(Set(p)) }
  pure def authRegister(s: IdentityState, p: int): IdentityState = { ...s, registered: s.registered.union(Set(p)) }
  // Trusted address linking requires verified addresses and excludes relay addresses.
  // Otherwise a person's explicit consent is required. An identity never moves.
  pure def authPropose(s: IdentityState, i: int, p: int, trusted: bool): IdentityState =
    if (s.identityOwner.get(i) != -1 or not(authAccount(s, p)) or not(authFreeProvider(s,i,p))) s
    else if (trusted and i != 3) { ...s, identityOwner: s.identityOwner.set(i, p), active: s.active.union(Set(i)) }
    else { ...s, pending: s.pending.set(i, p), pendingEpoch: s.pendingEpoch.set(i,s.epoch.get(p)) }
  pure def authConfirm(s: IdentityState, i: int, p: int): IdentityState =
    if (s.pending.get(i) == p and authAccount(s, p) and s.identityOwner.get(i) == -1 and s.pendingEpoch.get(i) == s.epoch.get(p) and authFreeProvider(s,i,p))
      { ...s, identityOwner: s.identityOwner.set(i, p), pending: s.pending.set(i, -1), active: s.active.union(Set(i)) }
    else s
  pure def authUnlink(s: IdentityState, i: int, p: int): IdentityState =
    if (s.active.contains(i) and s.identityOwner.get(i) == p and authMethods(s,p).size() > 1)
      { ...s, active: s.active.exclude(Set(i)) } else s
  pure def authExpireProposals(s: IdentityState): IdentityState = { ...s, pending: authIDENTITIES.mapBy(_ => -1) }
  pure def authValid(s: IdentityState): bool = and {
    s.active.subseteq(authIDENTITIES),
    PEOPLE.forall(p => authMethods(s,p).size() <= 2 and authMethods(s,p).forall(i => authMethods(s,p).filter(j => authProvider(j) == authProvider(i)).size() == 1)),
    s.removed.subseteq(PEOPLE), s.registered.subseteq(PEOPLE),
    PEOPLE.forall(p => s.epoch.get(p) >= 0),
    s.identityOwner.keys().forall(i => s.identityOwner.get(i) == -1 or PEOPLE.contains(s.identityOwner.get(i))),
    s.identityOwner.get(0) == 0, s.identityOwner.get(1) == 1,
  }
}
