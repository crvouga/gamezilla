// @spec-interpretation
// Sources: specs/auth, specs/billing, specs/chess, specs/friends, specs/matchmaking, specs/profile, specs/room, specs/spaces, specs/sync-engine
// Cross-context command semantics. Each subsystem owns its own state and pure transitions.
// Current authority is checked at acceptance; device facts are only optimistic hints.
module product_state {
  import universe.* from "./universe"
  export universe.*
  import identity.* from "./identity"
  import membership.* from "./membership"
  import community.* from "./community"
  import play.* from "./play"
  import privacy.* from "./privacy"
  import public_profile.* from "./public-profile"
  import notifications.* from "./notifications"
  import puzzle_board.* from "./puzzle-board"
  type ProductNote = { value: int, deleted: bool, revision: int }
  type ProductState = {
    auth: IdentityState, billing: MembershipState, social: CommunityState, game: PlayState,
    notifications: NotificationState, boards: int -> PuzzleBoard, notes: int -> ProductNote, feed: int -> int, profile: int -> int,
    publicProfile: PublicProfileState, privacy: PrivacyState, revision: int, now: int, day: int,
  }
  type ProductOp = { id: int, device: int, actor: int, kind: str, resource: int, value: int, day: int }
  pure val productNOTES = Set(0, 1)
  pure val productOFFLINE = boardKINDS.union(Set("write", "delete", "profile", "customize", "start", "finish", "rename", "create", "leave", "end", "select", "add-member", "remove-member", "request", "accept", "block", "unblock", "decline", "cancel-request", "remove-friend", "cancel"))
  pure val productKINDS = productOFFLINE.union(Set("join", "wait"))
  pure val productInitial: ProductState = {
    auth: authInitial, billing: billingInitial,
    social: socialJoin(socialJoin(socialCreate(socialInitial,0,0),1,0),2,0), game: gameInitial,
    notifications: inboxInitial, boards: SPACES.mapBy(_ => boardEmpty), notes: productNOTES.mapBy(_ => { value: 0, deleted: true, revision: 0 }),
    feed: PEOPLE.mapBy(_ => 0), profile: PEOPLE.mapBy(_ => 0), publicProfile: profileInitial, privacy: privacyInitial, revision: 0, now: 0, day: 0,
  }
  // Durable membership references can outlive or be recreated after deletion.
  // Presence and access require a usable actor; a reference alone revives neither.
  pure def productPresent(s: ProductState, id: int): Set[int] =
    if (s.social.spaces.get(id).open) s.social.spaces.get(id).members.filter(p => authUsable(s.auth,p)) else Set()
  pure def productCanSeeNotes(s: ProductState, p: int): bool =
    authUsable(s.auth,p) and s.social.spaces.get(0).open and s.social.spaces.get(0).members.contains(p)
  pure def productAllowed(s: ProductState, o: ProductOp): bool = {
    val r = if (SPACES.contains(o.resource)) s.social.spaces.get(o.resource) else socialEmptySpace
    val alive = authUsable(s.auth, o.actor)
    val account = authAccount(s.auth, o.actor)
    val paid = billingPaid(s.billing, o.actor, s.now, -1)
    alive and
      (if (boardKINDS.contains(o.kind)) r.open and r.owner == o.actor and r.game != -1 and
        (o.kind != "board-open" or PUZZLES.contains(o.value))
      else if (Set("write", "delete").contains(o.kind)) s.social.spaces.get(0).open and s.social.spaces.get(0).members.contains(o.actor)
      else if (o.kind == "rename") profileCanRename(s.publicProfile,o.actor,o.value,s.now)
      else if (o.kind == "profile") true
      else if (o.kind == "customize") account and paid
      else if (o.kind == "create") r.owner == -1 and (paid or socialHosted(s.social,o.actor) < 1)
      else if (o.kind == "join") r.open
      else if (o.kind == "leave") r.open and r.members.contains(o.actor)
      else if (o.kind == "add-member") r.open and r.owner == o.actor and PEOPLE.contains(o.value) and o.value != o.actor
      else if (o.kind == "remove-member") r.open and r.owner == o.actor and PEOPLE.contains(o.value) and o.value != o.actor
      else if (Set("end", "select").contains(o.kind)) r.open and r.owner == o.actor
      else if (o.kind == "start") account or gameUsed(s.game,o.actor,o.day) < gameLIMIT or gameCharged(s.game,o.actor,o.resource)
      else if (o.kind == "finish") gameCharged(s.game,o.actor,o.resource)
      else if (Set("request", "accept", "block", "unblock", "decline", "cancel-request", "remove-friend").contains(o.kind)) account and PEOPLE.contains(o.value) and authAccount(s.auth,o.value) and o.value != o.actor
      else if (o.kind == "wait") account and not(s.game.matches.keys().exists(id => not(s.game.finished.contains(id)) and (s.game.matches.get(id)._1 == o.actor or s.game.matches.get(id)._2 == o.actor)))
      else if (o.kind == "cancel") account
      else false)
  }
  pure def productEffect(s: ProductState, o: ProductOp): ProductState = {
    val revision = s.revision + 1
    if (boardKINDS.contains(o.kind)) {
      val changed = boardChange(s.boards.get(o.resource),o.kind,o.actor,o.value)
      { ...s, revision: revision, boards: s.boards.set(o.resource,changed), game: { ...s.game,
        // A room transition is not a durable SQL result. Observation can be lost.
        unobserved: if (changed.phase != s.boards.get(o.resource).phase and Set("wrong","solved","revealed","skipped").contains(changed.phase))
          s.game.unobserved.union(Set((changed.actor,changed.puzzle,if (changed.phase == "solved") "solved" else if (changed.phase == "skipped") "abandoned" else "failed"))) else s.game.unobserved,
      } }
    }
    else if (Set("write", "delete").contains(o.kind)) { ...s, revision: revision,
      notes: s.notes.set(o.resource,{ value: o.value, deleted: o.kind == "delete", revision: revision }) }
    else if (o.kind == "rename") { ...s, revision: revision, publicProfile: profileRename(s.publicProfile,o.actor,o.value,s.now) }
    else if (o.kind == "profile") { ...s, revision: revision, profile: s.profile.set(o.actor,o.value) }
    else if (o.kind == "customize") { ...s, revision: revision, feed: s.feed.set(o.actor,o.value) }
    else if (o.kind == "create") { ...s, revision: revision, social: socialCreate(s.social,o.actor,o.resource) }
    else if (o.kind == "join") { ...s, revision: revision, social: socialJoin(s.social,o.actor,o.resource) }
    else if (o.kind == "leave") { ...s, revision: revision, social: socialLeave(s.social,o.actor,o.resource) }
    else if (o.kind == "end") { ...s, revision: revision, social: socialEnd(s.social,o.resource) }
    else if (o.kind == "add-member") { ...s, revision: revision, social: socialAddPerson(s.social,o.value,o.resource) }
    else if (o.kind == "remove-member") { ...s, revision: revision, social: socialRemoveMember(s.social,o.value,o.resource) }
    else if (o.kind == "select") { ...s, revision: revision, social: socialSelectGame(s.social,o.resource,o.value % 2) }
    else if (o.kind == "start") { ...s, revision: revision, game: gameStart(s.game,o.actor,o.resource,o.day) }
    else if (o.kind == "finish") { ...s, revision: revision, game: gameFinish(s.game,o.actor,o.resource,
      if (o.value == 0) "solved" else if (o.value == 1) "failed" else "abandoned") }
    else if (o.kind == "request") { ...s, revision: revision, social: socialRequest(s.social,o.actor,o.value) }
    else if (o.kind == "accept") { ...s, revision: revision, social: socialAccept(s.social,o.actor,o.value) }
    else if (o.kind == "block") { ...s, revision: revision, social: socialBlock(s.social,o.actor,o.value) }
    else if (o.kind == "unblock") { ...s, revision: revision, social: socialUnblock(s.social,o.actor,o.value) }
    else if (o.kind == "decline") { ...s, revision: revision, social: socialDecline(s.social,o.actor,o.value) }
    else if (o.kind == "cancel-request") { ...s, revision: revision, social: socialCancelRequest(s.social,o.actor,o.value) }
    else if (o.kind == "remove-friend") { ...s, revision: revision, social: socialRemoveFriend(s.social,o.actor,o.value) }
    else if (o.kind == "wait") { ...s, revision: revision, game: { ...s.game, waiting: s.game.waiting.union(Set(o.actor)) } }
    else if (o.kind == "cancel") { ...s, revision: revision, game: { ...s.game, waiting: s.game.waiting.exclude(Set(o.actor)) } }
    else s
  }
  pure def productErase(s: ProductState, p: int): ProductState = {
    ...s, notifications: inboxErase(s.notifications,p), publicProfile: profileErase(s.publicProfile,p), privacy: privacyDelete(s.privacy,p,s.now), auth: authErase(s.auth,p), social: socialErase(s.social,p), game: gameErase(s.game,p),
    feed: s.feed.set(p,0), profile: s.profile.set(p,0), revision: s.revision + 1,
  }
  pure def productValid(s: ProductState): bool = and {
    inboxValid(s.notifications), authValid(s.auth), billingValid(s.billing), socialValid(s.social), gameValid(s.game), privacyValid(s.privacy,s.now), profileValid(s.publicProfile),
    s.auth.removed == PEOPLE.filter(p => s.privacy.stage.get(p) != "active"),
    SPACES.forall(id => boardValid(s.boards.get(id))),
    s.notes.keys().map(k => s.notes.get(k)).forall(n => n.revision <= s.revision),
    s.auth.removed.forall(p => and {
      socialHosted(s.social,p) == 0, not(s.game.waiting.contains(p)),
      not(s.game.rated.exists(k => k._1 == p)), s.feed.get(p) == 0, s.profile.get(p) == 0,
      SPACES.forall(id => not(productPresent(s,id).contains(p))),
      not(productCanSeeNotes(s,p)),
      s.social.friends.forall(ab => ab._1 != p and ab._2 != p),
    }),
    PEOPLE.forall(p => not(s.auth.registered.contains(p)) implies
      s.game.charges.map(k => k._3).forall(day => gameUsed(s.game,p,day) <= gameLIMIT)),
  }
}
