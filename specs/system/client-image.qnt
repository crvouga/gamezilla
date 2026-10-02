// @spec-interpretation
// Sources: specs/billing, specs/chess, specs/friends, specs/profile, specs/spaces, specs/sync-engine
// A device keeps observable domain projections and cached permission facts,
// not copies of provider identity tickets or server privacy workflows.
module client_image {
  import product_state.* from "./product-state"
  export product_state.*
  import membership.* from "./membership"
  import community.* from "./community"
  import play.* from "./play"
  import public_profile.* from "./public-profile"
  import puzzle_board.* from "./puzzle-board"
  type ClientImage = {
    available: Set[int], accounts: Set[int], confirmedAt: int,
    billing: MembershipState, social: CommunityState, game: PlayState,
    boards: int -> PuzzleBoard, notes: int -> ProductNote, feed: int -> int, profile: int -> int,
    publicProfile: PublicProfileState, revision: int, now: int, day: int,
  }
  pure def imageProject(s: ProductState): ClientImage = {
    available: PEOPLE.exclude(s.auth.removed), accounts: s.auth.registered, confirmedAt: s.now,
    billing: s.billing, social: s.social, game: s.game, boards: s.boards, notes: s.notes,
    feed: s.feed, profile: s.profile, publicProfile: s.publicProfile, revision: s.revision, now: s.now, day: s.day,
  }
  pure def imageExpand(i: ClientImage): ProductState = {
    ...productInitial, auth: { ...productInitial.auth, registered: i.accounts, removed: PEOPLE.exclude(i.available) },
    billing: i.billing, social: i.social, game: i.game, boards: i.boards, notes: i.notes,
    feed: i.feed, profile: i.profile, publicProfile: i.publicProfile, revision: i.revision, now: i.now, day: i.day,
  }
  pure def imageEffect(i: ClientImage, o: ProductOp): ClientImage =
    { ...imageProject(productEffect(imageExpand(i),o)), confirmedAt: i.confirmedAt }
  pure def imageAllowed(i: ClientImage, o: ProductOp): bool =
    productAllowed(imageExpand(i),o) and
    (o.kind != "customize" or billingPaid(i.billing,o.actor,i.now,i.confirmedAt)) and
    (o.kind != "create" or billingPaid(i.billing,o.actor,i.now,i.confirmedAt) or socialHosted(i.social,o.actor) < 1)
}
