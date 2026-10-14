// @model-profile: local
// Recovery keeps an active person's saved data usable. A confirmed account
// deletion stays deleted: the account cannot be used and the data cannot return.
module privacy_recovery {
  /// Whether the recovered account can be used.
  var usable: bool
  /// Whether that person's ordinary data came back.
  var returned: bool

  action _put(canUse: bool, dataBack: bool): bool = all {
    usable' = canUse,
    returned' = dataBack,
  }

  action init = _put(false, false)

  /// An active account's saved data is usable after recovery.
  action recoverActive: bool = _put(true, true)

  /// A deleted account stays unusable and its data does not return.
  action recoverDeleted: bool = _put(false, false)

  action step = all {
    any {
      recoverActive,
      recoverDeleted,
    }
  }

  /// Usable data is data that returned, and returned data is usable.
  val invRecoveryMatchesUse = usable == returned
}
