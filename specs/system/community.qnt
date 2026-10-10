// @spec-interpretation
// Sources: specs/friends, specs/spaces
// Spaces, friendship and inbox delivery are separate owned aggregates.
// Disconnecting a device does not remove membership. Public links remain public.
module community {
  import universe.* from "./universe"
  export universe.*
  type CommunitySpace = { owner: int, open: bool, access: Set[int], members: Set[int], game: int }
  type CommunityState = {
    spaces: int -> CommunitySpace, friends: Set[(int, int)], blocked: Set[(int, int)],
    cooldown: Set[(int,int)], requests: Set[(int, int)], events: Set[(int, int)], inbox: Set[(int, int)],
  }
  pure val socialEmptySpace: CommunitySpace = { owner: -1, open: false, access: Set(), members: Set(), game: -1 }
  pure val socialInitial: CommunityState = {
    spaces: SPACES.mapBy(_ => socialEmptySpace), friends: Set(), blocked: Set(),
    cooldown: Set(), requests: Set(), events: Set(), inbox: Set(),
  }
  pure def socialPair(a: int, b: int): (int, int) = if (a < b) (a, b) else (b, a)
  pure def socialBlocked(s: CommunityState, a: int, b: int): bool = s.blocked.contains((a,b)) or s.blocked.contains((b,a))
  pure def socialHosted(s: CommunityState, p: int): int = s.spaces.keys().map(k => s.spaces.get(k)).filter(r => r.open and r.owner == p).size()
  pure def socialCreate(s: CommunityState, p: int, id: int): CommunityState = {
    val old = s.spaces.get(id)
    if (old.owner != -1) s else
      { ...s, spaces: s.spaces.set(id, { owner: p, open: true, access: Set(p), members: Set(p), game: -1 }) }
  }
  pure def socialJoin(s: CommunityState, p: int, id: int): CommunityState = {
    val r = s.spaces.get(id)
    if (not(r.open)) s else { ...s, spaces: s.spaces.set(id, { ...r, access: r.access.union(Set(p)), members: r.members.union(Set(p)) }) }
  }
  pure def socialAddPerson(s: CommunityState, p: int, id: int): CommunityState = {
    val r = s.spaces.get(id)
    if (not(r.open)) s else { ...s, spaces: s.spaces.set(id, { ...r, access: r.access.union(Set(p)) }) }
  }
  pure def socialRemoveMember(s: CommunityState, p: int, id: int): CommunityState = {
    val r = s.spaces.get(id)
    { ...s, spaces: s.spaces.set(id,{ ...r, access: r.access.exclude(Set(p)), members: r.members.exclude(Set(p)) }) }
  }
  pure def socialEnd(s: CommunityState, id: int): CommunityState = {
    val r = s.spaces.get(id)
    { ...s, spaces: s.spaces.set(id, { ...r, open: false, game: -1 }) }
  }
  pure def socialLeave(s: CommunityState, p: int, id: int): CommunityState = {
    val r = s.spaces.get(id)
    if (p == r.owner) socialEnd(s, id)
    else socialRemoveMember(s,p,id)
  }
  pure def socialSelectGame(s: CommunityState, id: int, game: int): CommunityState = {
    val r = s.spaces.get(id)
    { ...s, spaces: s.spaces.set(id, { ...r, game: game }) }
  }
  pure def socialBlock(s: CommunityState, a: int, b: int): CommunityState = {
    val ab = socialPair(a, b)
    { ...s, blocked: s.blocked.union(Set((a,b))), friends: s.friends.exclude(Set(ab)),
      requests: s.requests.exclude(Set((a,b), (b,a))), inbox: s.inbox.exclude(Set((a,b), (b,a))) }
  }
  pure def socialRequest(s: CommunityState, a: int, b: int): CommunityState =
    if (a == b or socialBlocked(s,a,b) or s.friends.contains(socialPair(a,b)) or s.cooldown.contains((a,b))) s
    else { ...s, requests: s.requests.union(Set((a,b))), events: s.events.union(Set((a,b))) }
  pure def socialUnblock(s: CommunityState, a: int, b: int): CommunityState = { ...s, blocked: s.blocked.exclude(Set((a,b))) }
  pure def socialRemoveFriend(s: CommunityState, a: int, b: int): CommunityState = { ...s, friends: s.friends.exclude(Set(socialPair(a,b))) }
  pure def socialCancelRequest(s: CommunityState, a: int, b: int): CommunityState = { ...s, requests: s.requests.exclude(Set((a,b))), inbox: s.inbox.exclude(Set((a,b))) }
  pure def socialDecline(s: CommunityState, recipient: int, sender: int): CommunityState = {
    ...socialCancelRequest(s,sender,recipient), cooldown: s.cooldown.union(Set((sender,recipient))),
  }
  pure def socialAccept(s: CommunityState, a: int, b: int): CommunityState =
    if (not(s.requests.contains((b,a))) or socialBlocked(s,a,b)) s
    else { ...s, friends: s.friends.union(Set(socialPair(a,b))), requests: s.requests.exclude(Set((a,b),(b,a))) }
  pure def socialDeliver(s: CommunityState, a: int, b: int): CommunityState =
    if (s.events.contains((a,b)) and s.requests.contains((a,b)) and not(socialBlocked(s,a,b)))
      { ...s, inbox: s.inbox.union(Set((a,b))) } else s
  pure def socialErase(s: CommunityState, p: int): CommunityState = {
    ...s,
    spaces: s.spaces.keys().mapBy(id => {
      val r = s.spaces.get(id)
      if (r.owner == p) { ...r, open: false, access: Set(), members: Set(), game: -1 }
      else { ...r, access: r.access.exclude(Set(p)), members: r.members.exclude(Set(p)) }
    }),
    friends: s.friends.filter(ab => ab._1 != p and ab._2 != p),
    requests: s.requests.filter(ab => ab._1 != p and ab._2 != p),
    inbox: s.inbox.filter(ab => ab._1 != p and ab._2 != p),
  }
  pure def socialValid(s: CommunityState): bool = and {
    SPACES.forall(id => {
      val r = s.spaces.get(id)
      and { r.access.subseteq(PEOPLE), r.members.subseteq(r.access),
        r.open implies (PEOPLE.contains(r.owner) and r.members.contains(r.owner)),
        r.game == -1 or (r.open and PUZZLES.contains(r.game)) }
    }),
    s.friends.forall(ab => not(socialBlocked(s,ab._1,ab._2))),
    s.friends.forall(ab => ab._1 < ab._2),
    s.requests.forall(ab => ab._1 != ab._2 and not(socialBlocked(s,ab._1,ab._2))),
    s.inbox.subseteq(s.events),
  }
}
