// @model-profile: local
// Alice draws and removes personal arrows and circles without moving pieces.
// Activity arrows, fills, rings and badges remain under the activity's control.
// These examples use one personal stroke at a time; another mark begins after
// the earlier stroke finishes or is abandoned.
// Unfinished drawing is abandoned by cancellation, disabling, turning the
// chessboard or replacing its position. Completed marks keep their named
// squares when orientation changes. The two prepared positions and marked
// squares bound these examples; behavior is identical offline. The arrows
// currently announced to the activity describe personal arrows alone.
// Each personal arrow has the activity's primary green color. Chosen activity
// appearances are a single prepared arrow or the three usual feedback badges;
// a tick may instead be centered or gold. Square marks share one supplied set.
module board_annotations {
  type AnnotationBoard = {position: str, orientation: str, enabled: bool,
    personalArrows: Set[str], personalCircles: Set[str], pendingArrow: str,
    activityArrows: Set[str], activitySquares: Set[str],
    offeredArrows: Set[str], arrowOffers: int}
  var annotationBoard: AnnotationBoard
  pure val PERSONAL_ARROWS = Set("e2 to e4", "g1 to f3")
  pure val PERSONAL_CIRCLES = Set("e4", "d5")
  pure val ACTIVITY_ARROWS = Set("green solid e2 to e4", "blue dashed a1 to a8")
  pure val ACTIVITY_SQUARES = Set("blue fill d5", "gold ring e4", "Plan badge f3")
  pure val ARROW_APPEARANCES = Set("default", "danger", "bright green", "bright green dashed")
  pure val FEEDBACK_APPEARANCES = Set("usual", "centered", "gold")
  pure val FEEDBACK_SQUARES = Set("green tick upper-right e4", "red cross upper-right d5",
    "blue exclamations upper-right f3", "green tick center e4", "gold tick upper-right e4")
  pure def _arrowAppearance(appearance: str): str =
    if (appearance == "default") "green solid e2 to e4"
    else if (appearance == "danger") "red solid e2 to e4"
    else if (appearance == "bright green") "bright green solid e2 to e4"
    else "bright green dashed e2 to e4"
  pure def _toggle(marks: Set[str], mark: str): Set[str] =
    if (marks.contains(mark)) marks.exclude(Set(mark)) else marks.union(Set(mark))
  pure def _quiet(s: AnnotationBoard): AnnotationBoard = { ...s, arrowOffers: 0 }
  action init = annotationBoard' = {position: "opening", orientation: "White",
    enabled: true, personalArrows: Set(), personalCircles: Set(),
    pendingArrow: "none", activityArrows: Set(), activitySquares: Set(),
    offeredArrows: Set(), arrowOffers: 0}

  /// Alice begins a personal arrow without announcing a completed mark.
  action beginPersonalArrow(arrow: str): bool = all {
    PERSONAL_ARROWS.contains(arrow), annotationBoard.pendingArrow == "none",
    annotationBoard' = { ..._quiet(annotationBoard),
      pendingArrow: if (annotationBoard.enabled) arrow else "none" },
  }
  /// Finishing toggles that personal arrow and offers only personal arrows.
  action finishPersonalArrow = {
    val s = _quiet(annotationBoard)
    val arrows = _toggle(s.personalArrows, s.pendingArrow)
    annotationBoard' = if (s.enabled and PERSONAL_ARROWS.contains(s.pendingArrow))
      { ...s, personalArrows: arrows, pendingArrow: "none",
        offeredArrows: arrows, arrowOffers: 1 }
      else { ...s, pendingArrow: "none" }
  }
  /// Alice abandons unfinished drawing, preserving all completed marks.
  action cancelPersonalArrow = annotationBoard' = {
    ..._quiet(annotationBoard), pendingArrow: "none",
  }
  /// A personal circle toggles its square and announces the current personal arrows.
  action togglePersonalCircle(square: str): bool = all {
    PERSONAL_CIRCLES.contains(square), annotationBoard.pendingArrow == "none",
    annotationBoard' = if (annotationBoard.enabled)
      { ..._quiet(annotationBoard),
        personalCircles: _toggle(annotationBoard.personalCircles, square), arrowOffers: 1 }
      else _quiet(annotationBoard),
  }
  /// Choosing a piece removes personal marks while preserving activity marks.
  action clearPersonalAnnotations = all {
    annotationBoard.pendingArrow == "none",
    annotationBoard' = { ..._quiet(annotationBoard), personalArrows: Set(),
      personalCircles: Set(), offeredArrows: Set(), arrowOffers: 1 },
  }
  /// The activity supplies or removes only its own arrows.
  action setActivityArrows(show: bool): bool = annotationBoard' = {
    ..._quiet(annotationBoard), activityArrows: if (show) ACTIVITY_ARROWS else Set(),
  }
  /// The activity supplies or removes only its own square marks.
  action setActivitySquareMarks(show: bool): bool = annotationBoard' = {
    ..._quiet(annotationBoard), activitySquares: if (show) ACTIVITY_SQUARES else Set(),
  }
  /// The activity supplies an arrow with its default or deliberately chosen appearance.
  action chooseActivityArrow(appearance: str): bool = all {
    ARROW_APPEARANCES.contains(appearance),
    annotationBoard' = { ..._quiet(annotationBoard), activityArrows: Set(_arrowAppearance(appearance)) },
  }
  /// The activity supplies usual feedback symbols or changes the tick's position or color.
  action supplyFeedbackMarks(appearance: str): bool = all {
    FEEDBACK_APPEARANCES.contains(appearance),
    annotationBoard' = { ..._quiet(annotationBoard), activitySquares:
      if (appearance == "usual") Set("green tick upper-right e4", "red cross upper-right d5", "blue exclamations upper-right f3")
      else if (appearance == "centered") Set("green tick center e4") else Set("gold tick upper-right e4") },
  }
  /// The activity removes its annotations without removing personal marks.
  action clearActivityAnnotations = annotationBoard' = {
    ..._quiet(annotationBoard), activityArrows: Set(), activitySquares: Set(),
  }
  /// Disabling drawing abandons an unfinished arrow; enabling permits another.
  action configurePersonalAnnotations(canAnnotate: bool): bool = annotationBoard' = {
    ..._quiet(annotationBoard), enabled: canAnnotate,
    pendingArrow: if (canAnnotate) annotationBoard.pendingArrow else "none",
  }
  /// Turning preserves completed logical squares and abandons unfinished drawing.
  action flipAnnotationBoard = annotationBoard' = {
    ..._quiet(annotationBoard), pendingArrow: "none",
    orientation: if (annotationBoard.orientation == "White") "Black" else "White",
  }
  /// A genuinely different position abandons its unfinished drawing only.
  action replaceAnnotationPosition(target: str): bool = all {
    Set("opening", "replacement").contains(target),
    annotationBoard' = if (target == annotationBoard.position) _quiet(annotationBoard)
      else { ..._quiet(annotationBoard), position: target, pendingArrow: "none" },
  }
  action step = {
    nondet arrow = PERSONAL_ARROWS.oneOf()
    nondet square = PERSONAL_CIRCLES.oneOf()
    nondet show = Set(false, true).oneOf()
    nondet canAnnotate = Set(false, true).oneOf()
    nondet target = Set("opening", "replacement").oneOf()
    nondet arrowAppearance = ARROW_APPEARANCES.oneOf()
    nondet feedbackAppearance = FEEDBACK_APPEARANCES.oneOf()
    any { beginPersonalArrow(arrow), finishPersonalArrow, cancelPersonalArrow,
      togglePersonalCircle(square), clearPersonalAnnotations, setActivityArrows(show),
      setActivitySquareMarks(show), clearActivityAnnotations,
      configurePersonalAnnotations(canAnnotate), flipAnnotationBoard,
      replaceAnnotationPosition(target), chooseActivityArrow(arrowAppearance), supplyFeedbackMarks(feedbackAppearance) }
  }
  /// Personal marks and pending drawing use only the prepared logical squares.
  val invPersonalSquares = annotationBoard.personalArrows.subseteq(PERSONAL_ARROWS) and
    annotationBoard.personalCircles.subseteq(PERSONAL_CIRCLES) and
    (annotationBoard.pendingArrow == "none" or PERSONAL_ARROWS.contains(annotationBoard.pendingArrow))
  /// Activity marks retain their chosen styles and assigned squares.
  val invActivitySquares = annotationBoard.activityArrows.subseteq(
    ACTIVITY_ARROWS.union(ARROW_APPEARANCES.map(_arrowAppearance))) and
    annotationBoard.activitySquares.subseteq(ACTIVITY_SQUARES.union(FEEDBACK_SQUARES))
  /// Disabled personal drawing cannot keep an unfinished arrow.
  val invDisabledAnnotations = not(annotationBoard.enabled) implies annotationBoard.pendingArrow == "none"
  /// An offered arrow set contains personal arrows only, never square marks.
  val invArrowOffer = annotationBoard.offeredArrows.subseteq(PERSONAL_ARROWS) and
    annotationBoard.offeredArrows == annotationBoard.personalArrows and
    annotationBoard.arrowOffers >= 0 and annotationBoard.arrowOffers <= 1
  /// Positions and orientations remain valid regardless of completed marks.
  val invAnnotationPosition = Set("opening", "replacement").contains(annotationBoard.position) and
    Set("White", "Black").contains(annotationBoard.orientation)
}
