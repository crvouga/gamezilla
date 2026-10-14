// @model-profile: local
// Preparing an environment still opens it when preparation fails. A release
// finishes only after a passing release check. A newer check of the same
// change replaces one still running; a release does not replace another
// release's check. A release already underway is not undone.
module environment_release {
  /// "none", "finished", "refused", or "unfinished".
  var releaseState: str
  /// "idle", "passed", "failed", "replaced", or "kept".
  var checkState: str
  /// "closed" before preparation, or "told-and-open" when preparation failed.
  var openState: str

  action _put(release: str, check: str, open: str): bool = all {
    releaseState' = release,
    checkState' = check,
    openState' = open,
  }

  action init = _put("none", "idle", "closed")

  /// Failed preparation tells the team and still opens the environment.
  action prepareDespiteFailure: bool = _put("none", "idle", "told-and-open")

  /// A passing release check lets the release finish.
  action releaseAfterPass: bool = _put("finished", "passed", "closed")

  /// A failed release check refuses the release.
  action releaseAfterFailure: bool = _put("refused", "failed", "closed")

  /// A newer check of the same change replaces the one still running.
  action replaceRunningCheck: bool = _put("none", "replaced", "closed")

  /// One release does not replace another release's check.
  action keepReleaseCheck: bool = _put("none", "kept", "closed")

  /// Starting another release leaves the unfinished one going.
  action keepUnfinishedRelease: bool = _put("unfinished", "kept", "closed")

  /// Stopping a release that has started does not undo it.
  action stopStartedRelease: bool = _put("unfinished", "idle", "closed")

  action step = all {
    any {
      prepareDespiteFailure,
      releaseAfterPass,
      releaseAfterFailure,
      replaceRunningCheck,
      keepReleaseCheck,
      keepUnfinishedRelease,
      stopStartedRelease,
    }
  }

  /// A finished release had a passing release check.
  val invFinishedCheckPassed = (releaseState == "finished") implies (checkState == "passed")

  /// A refused release had a failed release check.
  val invRefusedCheckFailed = (releaseState == "refused") implies (checkState == "failed")

  /// The environment is closed, or the team was told and can still open it.
  val invPreparationIsKnown = or {
    openState == "closed",
    openState == "told-and-open",
  }
}
