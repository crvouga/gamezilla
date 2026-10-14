// @model-profile: local
// A saved preference stays when the person opens the theme choices and closes
// the app before choosing, and when they run into trouble. Trouble also leaves
// them in the same place in the app. Choosing the light theme is the only way
// the saved preference changes.
module preference_recovery {
  /// "dark" or "light", the preference the app is showing.
  var theme: str
  /// Where the person is in the app: "spaces", "settings", or "profile".
  var place: str
  /// Whether the theme choices are open and nothing has been chosen yet.
  var choosing: bool
  /// The preference already saved.
  var _saved: str
  /// Trouble has happened and the person has not left that place since.
  var _troubled: bool
  /// The place they were in when trouble happened.
  var _placeAtTrouble: str

  action _keep(
    shown: str,
    saved: str,
    where: str,
    open: bool,
    troubled: bool,
    at: str,
  ): bool = all {
    theme' = shown,
    _saved' = saved,
    place' = where,
    choosing' = open,
    _troubled' = troubled,
    _placeAtTrouble' = at,
  }

  action init =
    _keep("dark", "dark", "spaces", false, false, "spaces")

  /// Open the theme choices. The saved preference stays on the app.
  /// The person is in Settings while the choices are open.
  action openThemeChoices: bool = all {
    not(choosing),
    _keep(theme, _saved, "settings", true, false, _placeAtTrouble),
  }

  /// Close the app before choosing. It opens again in the same place, still
  /// on the theme choices, and the saved preference is what the app shows.
  action closeBeforeChoosing: bool = all {
    choosing,
    _keep(_saved, _saved, place, choosing, false, _placeAtTrouble),
  }

  /// Choose the light theme. That becomes the saved preference.
  action chooseLight: bool = all {
    choosing,
    theme == "dark",
    _keep("light", "light", place, false, false, _placeAtTrouble),
  }

  /// Something goes wrong. The place, the choices, and the saved preference stay.
  action runIntoTrouble: bool = all {
    not(_troubled),
    _keep(_saved, _saved, place, choosing, true, place),
  }

  /// Leave for the profile. This is a choice, so the trouble mark ends.
  action leaveForProfile: bool = all {
    place == "spaces",
    not(choosing),
    _keep(theme, _saved, "profile", false, false, _placeAtTrouble),
  }

  action step = all {
    any {
      openThemeChoices,
      closeBeforeChoosing,
      chooseLight,
      runIntoTrouble,
      leaveForProfile,
    },
  }

  /// The app shows the saved preference, including while the choices are open.
  val invThemeIsSaved = theme == _saved

  /// Trouble leaves the person in the place where it happened.
  val invTroubleKeepsPlace = _troubled implies (place == _placeAtTrouble)

  /// The theme choices are open only until the person chooses or leaves them.
  val invChoosingKeepsSaved = choosing implies (theme == _saved)
}
