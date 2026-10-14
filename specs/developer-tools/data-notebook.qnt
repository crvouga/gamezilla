// @model-profile: local
// The team can change a question, put a later question ahead of an earlier
// one, and see an automatic answer when the notebook opens. An answer shows
// at most 5000 rows; one more row is cut off and the team is told.
module data_notebook {
  /// What the notebook is showing: "friends", "spaces", "friends-first",
  /// "spaces-first", or "counted".
  var shown: str
  /// Whether the team is looking at an answer.
  var answered: bool
  /// Whether that answer was cut off at 5000 rows.
  var cutOff: bool
  var _two: bool

  action _put(wording: str, hasAnswer: bool, clipped: bool, two: bool): bool = all {
    shown' = wording,
    answered' = hasAnswer,
    cutOff' = clipped,
    _two' = two,
  }

  action init =
    _put("friends", false, false, false)

  /// Changing the question shows what it asks now, and clears any answer.
  action editQuestion: bool =
    _put("spaces", false, false, false)

  /// A second question sits after the first.
  action addSecond: bool = all {
    not(_two),
    _put("friends-first", false, false, true),
  }

  /// Moving the later question ahead shows it first.
  action moveLaterAhead: bool = all {
    _two,
    shown == "friends-first",
    _put("spaces-first", false, false, true),
  }

  /// A question that is already first stays first.
  action moveFirstAhead: bool = all {
    _two,
    shown == "friends-first",
    _put("friends-first", false, false, true),
  }

  /// Opening a question that answers automatically shows its answer.
  action openAutomatic: bool =
    _put("friends", true, false, false)

  /// An answer of 5000 rows is shown whole.
  action runWithinLimit: bool =
    _put("counted", true, false, false)

  /// An answer of 5001 rows is cut off at 5000, and the team is told.
  action runPastLimit: bool =
    _put("counted", true, true, false)

  action step = all {
    any {
      editQuestion,
      addSecond,
      moveLaterAhead,
      moveFirstAhead,
      openAutomatic,
      runWithinLimit,
      runPastLimit,
    }
  }

  /// A cut-off answer is an answer the team is looking at.
  val invCutOffIsAnAnswer = cutOff implies answered

  /// The notebook is showing a question, an order, or a counted answer.
  val invShownIsKnown = or {
    shown == "friends",
    shown == "spaces",
    shown == "friends-first",
    shown == "spaces-first",
    shown == "counted",
  }
}
