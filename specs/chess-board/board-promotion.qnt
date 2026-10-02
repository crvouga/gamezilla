// @model-profile: local
// Alice can request promotion, choose its piece or abandon it. An unfinished
// choice keeps the pawn at its source and prevents another piece moving.
// Activity changes can disable input or replace the position. Automatic queen
// promotion applies to future requests, preserving an already pending choice.
// The prepared position has White's pawn on a7 and rook on h1. Other positions
// represent the completed promotion, a rook move, a replacement, checkmate or
// stalemate. Their chess legality is already decided; this model does not
// calculate chess moves. The behavior is identical offline. Offers describe
// the moves received by the activity from the most recent action.
module board_promotion {
  type PromotionBoard = {position: str, choice: bool, promotedPiece: str,
    interactive: bool, automaticQueen: bool, offers: List[str]}
  var promotionBoard: PromotionBoard
  pure val PROMOTION_PIECES = Set("queen", "rook", "bishop", "knight")
  pure val PROMOTION_POSITIONS = Set("ready", "promoted", "rook moved",
    "replacement", "checkmate", "stalemate")
  pure def _quiet(s: PromotionBoard): PromotionBoard = { ...s, offers: [] }
  action init = promotionBoard' = {position: "ready", choice: false,
    promotedPiece: "none", interactive: true, automaticQueen: false, offers: []}

  /// Alice requests the prepared pawn's move to its last rank.
  action requestPromotion = {
    val s = _quiet(promotionBoard)
    promotionBoard' = if (s.interactive and s.position == "ready" and not(s.choice))
      if (s.automaticQueen) { ...s, position: "promoted", promotedPiece: "queen", offers: ["queen"] }
      else { ...s, choice: true }
      else s
  }
  /// Alice's explicit piece choice completes one previously requested move.
  action choosePromotion(piece: str): bool = all {
    PROMOTION_PIECES.contains(piece), promotionBoard.choice,
    promotionBoard' =
      { ...promotionBoard, position: "promoted", choice: false,
        promotedPiece: piece, offers: [piece] },
  }
  /// Escape abandons a pending choice and is harmless without one, preserving position.
  action cancelPromotion = promotionBoard' = { ...promotionBoard, choice: false, offers: [] }
  /// Alice attempts the prepared rook move; a pending choice prevents it.
  action tryOtherPromotionMove = promotionBoard' =
    if (promotionBoard.interactive and promotionBoard.position == "ready" and not(promotionBoard.choice))
      { ...promotionBoard, position: "rook moved", offers: ["rook h1 to h2"] }
    else _quiet(promotionBoard)
  /// Disabling input abandons its choice; re-enabling permits future requests.
  action configurePromotionInput(canMove: bool): bool = promotionBoard' = {
    ...promotionBoard, interactive: canMove,
    choice: promotionBoard.choice and canMove, offers: [],
  }
  /// A changed automatic choice applies only to a future request.
  action configureAutomaticQueen(automatic: bool): bool = promotionBoard' = {
    ...promotionBoard, automaticQueen: automatic, offers: [],
  }
  /// A genuinely different supplied position abandons the old choice.
  action replacePromotionPosition(target: str): bool = all {
    Set("ready", "replacement", "checkmate", "stalemate").contains(target),
    promotionBoard' = if (target == promotionBoard.position) _quiet(promotionBoard)
      else { ...promotionBoard, position: target, choice: false,
        promotedPiece: "none", offers: [] },
  }
  action step = {
    nondet piece = PROMOTION_PIECES.oneOf()
    nondet canMove = Set(false, true).oneOf()
    nondet automatic = Set(false, true).oneOf()
    nondet target = Set("ready", "replacement", "checkmate", "stalemate").oneOf()
    any { requestPromotion, choosePromotion(piece), cancelPromotion,
      tryOtherPromotionMove, configurePromotionInput(canMove),
      configureAutomaticQueen(automatic), replacePromotionPosition(target) }
  }
  /// Waiting for a choice keeps the original pawn and offers no move.
  val invPendingPromotion = promotionBoard.choice implies
    (promotionBoard.position == "ready" and promotionBoard.interactive and
      promotionBoard.promotedPiece == "none" and promotionBoard.offers == [])
  /// A completed promotion has exactly one of the four promised pieces.
  val invPromotedPiece = (promotionBoard.position == "promoted") ==
    PROMOTION_PIECES.contains(promotionBoard.promotedPiece)
  /// Each action offers at most one move, with the chosen piece when promoted.
  val invOnePromotionOffer = promotionBoard.offers.length() <= 1 and
    (promotionBoard.offers == [] or
      (promotionBoard.position == "promoted" and promotionBoard.offers == [promotionBoard.promotedPiece]) or
      (promotionBoard.position == "rook moved" and promotionBoard.offers == ["rook h1 to h2"]))
  /// Disabled and finished positions offer neither a choice nor a move.
  val invPromotionAuthority =
    (not(promotionBoard.interactive) or Set("checkmate", "stalemate").contains(promotionBoard.position))
      implies (not(promotionBoard.choice) and promotionBoard.offers == [])
  /// The activity sees only one of the prepared positions.
  val invPromotionPositions = PROMOTION_POSITIONS.contains(promotionBoard.position)
}
