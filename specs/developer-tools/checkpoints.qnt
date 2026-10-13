// @model-profile: local
// A checkpoint the team saved can be selected. An interrupted save does not
// become one. A failed restore leaves the world as it was and tells the team.
// Closing and opening the testing tool returns the world it kept, and does
// not bring back a checkpoint the team deleted.
module checkpoints {
  /// "first" or "later": the apps the team is looking at.
  var world: str
  /// "none" or "failed": whether the last restore failed.
  var failure: str
  /// Whether the team can select the checkpoint.
  var available: bool
  /// The world the testing tool keeps for when it opens again.
  var _kept: str
  /// The world the checkpoint captured.
  var _captured: str
  var _deleted: bool

  action _put(
    shown: str,
    told: str,
    listed: bool,
    kept: str,
    captured: str,
    deleted: bool,
  ): bool = all {
    world' = shown,
    failure' = told,
    available' = listed,
    _kept' = kept,
    _captured' = captured,
    _deleted' = deleted,
  }

  action init =
    _put("first", "none", false, "first", "first", false)

  /// Saving the world the team is looking at makes that checkpoint selectable.
  action saveCheckpoint: bool = all {
    not(_deleted),
    _put(world, "none", true, world, world, false),
  }

  /// An interrupted save adds nothing the team can select.
  action interruptSave: bool = all {
    _put(world, "none", available, _kept, _captured, _deleted),
  }

  /// The investigated app changes. The testing tool keeps that newer world.
  action changeWorld: bool = all {
    world == "first",
    _put("later", "none", available, "later", _captured, _deleted),
  }

  /// Restoring the checkpoint fails. The world stays, and the team is told.
  action failRestore: bool = all {
    available,
    world == "later",
    _put(world, "failed", available, _kept, _captured, _deleted),
  }

  /// Deleting the checkpoint means the team can no longer select it.
  action deleteCheckpoint: bool = all {
    available,
    _put(world, "none", false, _kept, _captured, true),
  }

  /// The testing tool closes and opens again on the world it kept.
  action reopenTool: bool = all {
    _put(_kept, "none", available, _kept, _captured, _deleted),
  }

  action step = all {
    any {
      saveCheckpoint,
      interruptSave,
      changeWorld,
      failRestore,
      deleteCheckpoint,
      reopenTool,
    }
  }

  /// A deleted checkpoint cannot be selected.
  val invDeletedIsGone = _deleted implies (available == false)

  /// A failed restore did not replace the world the team was looking at.
  val invFailedRestoreKeepsTheWorld = (failure == "failed") implies (world == "later")
}
