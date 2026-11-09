// Alice has canceled her Plus membership without explaining why.
// After canceling she may share a reason, a comment, or both. Sharing again
// replaces her earlier answer without changing when her membership ends.
// Without a connection her answer stays on her device. The team sees it
// when her connection returns; canceling itself needs a connection.
module cancellation_feedback {
  type Feedback = { reason: str, comment: str, shared: bool }
  pure val EMPTY: Feedback = { reason: "", comment: "", shared: false }
  pure val REASONS = Set("", "price", "missing features", "difficulty using the app", "low usage", "switching products", "other")
  var canceled: bool
  var feedback: Feedback
  var feedbackAtTeam: Feedback
  var _online: bool

  action init = all {
    canceled' = true,
    feedback' = EMPTY,
    feedbackAtTeam' = EMPTY,
    _online' = true,
  }

  /// Alice optionally shares or changes her cancellation feedback.
  action shareCancellationFeedback(why: str, words: str): bool = {
    val answer = { reason: why, comment: words, shared: true }
    all {
      canceled,
      canceled' = canceled,
      feedback' = answer,
      feedbackAtTeam' = if (_online) answer else feedbackAtTeam,
      _online' = _online,
    }
  }

  /// Her connection is lost after canceling. Her answer stays on her device.
  action _goOffline = all {
    canceled, _online,
    _online' = false,
    canceled' = canceled,
    feedback' = feedback,
    feedbackAtTeam' = feedbackAtTeam,
  }

  /// Her connection returns and the team can see her latest answer.
  action _goOnline = all {
    not(_online),
    _online' = true,
    canceled' = canceled,
    feedback' = feedback,
    feedbackAtTeam' = feedback,
  }

  /// Looking at the billing plans does not change her answer or cancellation.
  action viewBillingPlans = all {
    canceled' = canceled,
    feedback' = feedback,
    feedbackAtTeam' = feedbackAtTeam,
    _online' = _online,
  }

  action step = {
    nondet why = Set("price", "low usage", "").oneOf()
    nondet words = Set("Plus is too expensive this month.", "Taking a break from games.", "").oneOf()
    any {
      viewBillingPlans,
      shareCancellationFeedback(why, words),
      _goOffline,
      _goOnline,
    }
  }

  /// Sharing feedback never takes back Alice's cancellation.
  val invFeedbackKeepsCancellation = feedback.shared implies canceled
  /// With a connection, the team sees the same answer Alice sees.
  val invConnectedAnswer = _online implies feedbackAtTeam == feedback
  /// An answer uses an offered reason or leaves the reason blank.
  val invOfferedReason = REASONS.contains(feedback.reason)
  /// Before sharing, neither a reason nor a comment is invented for Alice.
  val invNoInventedAnswer = not(feedback.shared) implies feedback == EMPTY
}
