// @spec-interpretation
// Sources: specs/profile
// Normalized usernames are equivalence classes: two letter cases of the same
// name share one value. Invalid/offensive text is the separate refused class -2.
module public_profile {
  import universe.* from "./universe"
  type PublicProfileState = { names: int -> int, changedAt: int -> int }
  pure val profileInitial: PublicProfileState = { names: PEOPLE.mapBy(p => p), changedAt: PEOPLE.mapBy(_ => -1) }
  pure def profileCanRename(s: PublicProfileState, p: int, name: int, now: int): bool =
    name >= 0 and (s.names.get(p) == name or
      (s.changedAt.get(p) != now and PEOPLE.forall(other => other == p or s.names.get(other) != name)))
  pure def profileRename(s: PublicProfileState, p: int, name: int, now: int): PublicProfileState =
    if (s.names.get(p) == name) s else { ...s, names: s.names.set(p,name), changedAt: s.changedAt.set(p,now) }
  pure def profileErase(s: PublicProfileState, p: int): PublicProfileState = { ...s, names: s.names.set(p,-1) }
  pure def profileValid(s: PublicProfileState): bool = PEOPLE.forall(p =>
    s.names.get(p) == -1 or PEOPLE.forall(other => p == other or s.names.get(p) != s.names.get(other)))
}
