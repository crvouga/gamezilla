// @model-profile: local
// Alice queues up to two prepared White replies while Black is to move.
// White has king e1, pawn d2 and knight g1; Black has king e8, pawn e7,
// knight g8 and rook h2. Other squares are empty. A queued pawn move is d2
// to d4 and a knight move is g1 to f3. Real pieces stay at source until Black
// replies e7 to e5 then g8 to f6; each completes at most the first queued move.
// Instead, Black's rook h2 to d2 captures a single queued pawn's source and
// drops that premove without another move.
// Cancellation, disabling and a different supplied position abandon previews.
// Queueing is a waiting-side command; an own-turn gesture is an ordinary
// move outside this model. Repeating a queued request keeps its single preview.
// Chess legality is already decided for these examples, not calculated here.
// Position tells which prepared replies and White moves have completed. Offers
// are moves received by the activity from the most recent action. This local
// behavior is identical offline.
module board_premoves {
  type PremoveBoard = {position: {replies: int, movedPieces: Set[str], pawnCaptured: bool}, waiting: bool, enabled: bool,
    queued: List[str], selectedSource: str, offers: List[str], replacement: bool}
  var premoveBoard: PremoveBoard
  pure val PREMOVES = Set("d2 to d4", "g1 to f3")
  pure def _quiet(s: PremoveBoard): PremoveBoard = { ...s, offers: [] }
  action init = premoveBoard' = {
    position: {replies: 0, movedPieces: Set(), pawnCaptured: false},
    waiting: true, enabled: true, queued: [], selectedSource: "none",
    offers: [], replacement: false,
  }

  /// Waiting-side selection is available only when premoves are enabled.
  action selectPremoveSource(source: str): bool = all {
    Set("d2", "g1", "a3").contains(source),
    premoveBoard' = if (source == "a3")
      { ..._quiet(premoveBoard), queued: [], selectedSource: "none" }
      else { ..._quiet(premoveBoard), selectedSource:
        if (premoveBoard.enabled and premoveBoard.waiting and not(premoveBoard.replacement) and
          not(premoveBoard.position.movedPieces.contains(if (source == "d2") "d2 to d4" else "g1 to f3")) and
          not(source == "d2" and premoveBoard.position.pawnCaptured)) source else "none" },
  }
  /// A waiting move adds one preview without moving its source piece.
  action queuePremove(move: str): bool = all {
    PREMOVES.contains(move), premoveBoard.waiting, not(premoveBoard.replacement),
    premoveBoard' = if (premoveBoard.enabled and premoveBoard.waiting and
        not(premoveBoard.replacement) and not(premoveBoard.position.pawnCaptured) and
        not(premoveBoard.position.movedPieces.contains(move)) and
        not(premoveBoard.queued.indices().exists(i => premoveBoard.queued.nth(i) == move)) and premoveBoard.queued.length() < 2)
      { ..._quiet(premoveBoard), queued: premoveBoard.queued.append(move), selectedSource: "none" }
      else _quiet(premoveBoard),
  }
  /// One prepared legal opponent reply completes at most the first premove.
  action receivePremoveReply = all {
    premoveBoard.waiting, not(premoveBoard.replacement), premoveBoard.position.replies < 2,
    {
      val s = _quiet(premoveBoard)
      val hasMove = s.enabled and s.queued.length() > 0
      val first = if (hasMove) s.queued.nth(0) else "none"
      premoveBoard' = { ...s, waiting: hasMove, selectedSource: "none",
        position: { ...s.position, replies: s.position.replies + 1,
          movedPieces: if (hasMove) s.position.movedPieces.union(Set(first)) else s.position.movedPieces },
        queued: if (hasMove) s.queued.slice(1, s.queued.length()) else s.queued,
        offers: if (hasMove) [first] else [] }
    },
  }
  /// A prepared reply makes the first pawn premove illegal; no next move is tried.
  action invalidatePremove = all {
    premoveBoard.waiting, not(premoveBoard.replacement), premoveBoard.position.replies == 0,
    premoveBoard.queued.length() == 1, premoveBoard.queued.nth(0) == "d2 to d4",
    premoveBoard' = { ..._quiet(premoveBoard), waiting: false, selectedSource: "none",
      position: { ...premoveBoard.position, replies: 1, pawnCaptured: true },
      queued: premoveBoard.queued.slice(1, premoveBoard.queued.length()) },
  }
  /// Alice abandons every waiting move and preview, preserving the real pieces.
  action cancelPremoves = premoveBoard' = {
    ..._quiet(premoveBoard), queued: [], selectedSource: "none",
  }
  /// Disabling premoves cancels the whole queue; enabling permits future choices.
  action configurePremoves(canPremove: bool): bool = premoveBoard' = {
    ..._quiet(premoveBoard), enabled: canPremove,
    queued: if (canPremove) premoveBoard.queued else [],
    selectedSource: if (canPremove) premoveBoard.selectedSource else "none",
  }
  /// A different supplied position abandons the queue and starts its own board.
  action replacePremovePosition = premoveBoard' = {
    ..._quiet(premoveBoard), queued: [], selectedSource: "none", replacement: true,
    waiting: false, position: {replies: 0, movedPieces: Set(), pawnCaptured: false},
  }
  action step = {
    nondet source = Set("d2", "g1", "a3").oneOf()
    nondet move = PREMOVES.oneOf()
    nondet canPremove = Set(false, true).oneOf()
    any { selectPremoveSource(source), queuePremove(move), receivePremoveReply,
      invalidatePremove, cancelPremoves, configurePremoves(canPremove), replacePremovePosition }
  }
  /// Previews preserve the queued order and never duplicate a prepared move.
  val invPremoveQueue = premoveBoard.queued.length() <= 2 and
    premoveBoard.queued.foldl(Set(), (moves, move) => moves.union(Set(move))).size() == premoveBoard.queued.length() and
    premoveBoard.queued.indices().forall(i => PREMOVES.contains(premoveBoard.queued.nth(i)))
  /// Each action offers at most one completed move to the activity.
  val invOnePremovePerReply = premoveBoard.offers.length() <= 1 and
    premoveBoard.offers.indices().forall(i => premoveBoard.position.movedPieces.contains(premoveBoard.offers.nth(i)))
  /// A queued move's real piece has not completed that move yet.
  val invPremovePreview = premoveBoard.queued.indices().forall(i =>
    not(premoveBoard.position.movedPieces.contains(premoveBoard.queued.nth(i))))
  /// Disabled premoves have neither a preview nor a selected waiting source.
  val invDisabledPremoves = not(premoveBoard.enabled) implies
    (premoveBoard.queued == [] and premoveBoard.selectedSource == "none")
  /// The two prepared replies and completed moves describe a valid board.
  val invPremovePosition = premoveBoard.position.replies >= 0 and premoveBoard.position.replies <= 2 and
    premoveBoard.position.movedPieces.subseteq(PREMOVES) and
    premoveBoard.position.movedPieces.size() <= premoveBoard.position.replies and
    (premoveBoard.position.pawnCaptured implies not(premoveBoard.position.movedPieces.contains("d2 to d4"))) and
    Set("none", "d2", "g1").contains(premoveBoard.selectedSource)
  /// Replacement positions retain neither old previews nor old move offers.
  val invPremoveReplacement = premoveBoard.replacement implies
    (premoveBoard.queued == [] and premoveBoard.offers == [] and not(premoveBoard.waiting))
}
