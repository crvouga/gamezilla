// @model-profile: local
// Alice reports a bug from her phone. She opens a bug report by choosing to
// report a bug, by shaking the phone or by a three-finger press, and closes
// it whenever she likes. Only one bug report is ever open: choosing to report
// a bug, shaking the phone or a three-finger press while one is open keeps
// the same bug report.
//
// A three-finger press is three fingers held still on the app for one
// second. It opens a bug report whatever shake to report is set to and
// whatever the phone allows.
//
// On a computer, Alice can also report a bug about one thing on the screen.
// That opens a bug report the same way, or keeps the one already open.
//
// A shake opens a bug report only while shake to report is on and the phone
// allows it. Shake to report is on until Alice turns it off, and she can turn
// it back on. A phone that asks before the app may notice shaking waits for
// Alice to allow it; if she refuses, she reports a bug by choosing to.
//
// A bug report starts with one screenshot of what the app was showing, or
// with none on a phone that cannot take one. Alice can remove a screenshot,
// and every picture she adds becomes one more screenshot, up to 4. Something
// that is not a picture, a picture of more than 5 MB and a fifth screenshot
// are refused, and the bug report stays as it was.
//
// Closing a bug report keeps it as a draft: its description and screenshots
// are there when she opens it again, also after reopening the app, and shake
// to report stays as she set it.
//
// None of this needs a connection. Alice opens, describes and closes a bug
// report, changes its screenshots and sets shake to report the same way
// online and offline.
module bug_report_opening {
  /// Screenshots a bug report carries at most.
  pure val SCREENSHOT_LIMIT: int = 4
  /// The largest picture Alice can add, in MB.
  pure val PICTURE_LIMIT_MB: int = 5
  /// What Alice may try to add: a picture, or something that is not one.
  pure val KINDS = Set("picture", "not a picture")
  /// The sizes, in MB, of what Alice may try to add.
  pure val SIZES = Set(1, 5, 6)

  /// How many bug reports Alice has open: none or one.
  var openBugReports: int
  /// Whether Alice's bug report, open or kept as a draft, has a description.
  var described: bool
  /// The screenshots on Alice's bug report, open or kept as a draft.
  var screenshots: int
  /// Whether shake to report is on.
  var shakeToReport: bool
  /// What Alice's phone says about the app noticing shaking: "waiting" for
  /// her answer, "allowed" or "refused".
  var phoneAllows: str
  /// Bookkeeping: whether Alice has started a bug report yet.
  var _started: bool
  /// Bookkeeping: whether shake to report is on by Alice's last choice.
  var _setOn: bool
  /// Bookkeeping: whether the bug report had a description when last closed.
  var _describedAtClose: bool
  /// Bookkeeping: the screenshots on the bug report when it was last closed.
  var _screenshotsAtClose: int
  /// Bookkeeping: whether the last thing that happened was a shake opening a bug report.
  var _shakeJustOpened: bool
  /// Bookkeeping: whether the last thing that happened was a draft being opened again.
  var _draftJustOpened: bool
  /// Bookkeeping: whether this phone can take a screenshot.
  var _takesScreenshots: bool
  /// Bookkeeping: whether this phone asks before the app may notice shaking.
  var _asksFirst: bool

  /// Everything a person can see after any action, with what the phone is
  /// like staying as it was.
  action _becomes(
    open: int,
    hasDescription: bool,
    shots: int,
    on: bool,
    phone: str,
    started: bool,
    setOn: bool,
    describedAtClose: bool,
    shotsAtClose: int,
    shakeOpened: bool,
    draftOpened: bool,
  ): bool = all {
    openBugReports' = open,
    described' = hasDescription,
    screenshots' = shots,
    shakeToReport' = on,
    phoneAllows' = phone,
    _started' = started,
    _setOn' = setOn,
    _describedAtClose' = describedAtClose,
    _screenshotsAtClose' = shotsAtClose,
    _shakeJustOpened' = shakeOpened,
    _draftJustOpened' = draftOpened,
    _takesScreenshots' = _takesScreenshots,
    _asksFirst' = _asksFirst,
  }

  /// Nothing Alice can see changes.
  action _stays: bool =
    _becomes(openBugReports, described, screenshots, shakeToReport, phoneAllows,
      _started, _setOn, _describedAtClose, _screenshotsAtClose, false, false)

  /// A bug report opens. One already open stays the same bug report, a draft
  /// comes back as it was closed, and a new bug report starts with the
  /// screenshot the phone takes, if it can take one.
  action _opens(byShake: bool): bool =
    _becomes(
      1,
      described,
      if (_started) screenshots else (if (_takesScreenshots) 1 else 0),
      shakeToReport, phoneAllows, true, _setOn, _describedAtClose,
      _screenshotsAtClose,
      byShake and openBugReports == 0,
      _started and openBugReports == 0,
    )

  action init = {
    nondet asksFirst = Set(true, false).oneOf()
    nondet takesScreenshots = Set(true, false).oneOf()
    all {
      openBugReports' = 0,
      described' = false,
      screenshots' = 0,
      shakeToReport' = true,
      phoneAllows' = if (asksFirst) "waiting" else "allowed",
      _started' = false,
      _setOn' = true,
      _describedAtClose' = false,
      _screenshotsAtClose' = 0,
      _shakeJustOpened' = false,
      _draftJustOpened' = false,
      _takesScreenshots' = takesScreenshots,
      _asksFirst' = asksFirst,
    }
  }

  /// Choose to report a bug. This opens a bug report, or keeps the one
  /// already open.
  action chooseToReport: bool = _opens(false)

  /// Shake the phone. This opens a bug report while shake to report is on
  /// and the phone allows it, and opens nothing otherwise.
  action shakePhone: bool =
    if (shakeToReport and phoneAllows == "allowed") _opens(true) else _stays

  /// Make a three-finger press. Like choosing to report a bug, this opens a
  /// bug report, or keeps the one already open, whatever shake to report is
  /// set to and whatever the phone allows.
  action threeFingerPress: bool = _opens(false)

  /// Report a bug about one thing on the screen. Like choosing to report a
  /// bug, this opens a bug report, or keeps the one already open.
  action reportBugAbout: bool = _opens(false)

  /// Close the bug report. Its description and screenshots are kept as a draft.
  action closeBugReport: bool = all {
    openBugReports == 1,
    _becomes(0, described, screenshots, shakeToReport, phoneAllows, _started,
      _setOn, described, screenshots, false, false),
  }

  /// Describe the bug on the open bug report.
  action describeBug: bool = all {
    openBugReports == 1,
    _becomes(openBugReports, true, screenshots, shakeToReport, phoneAllows,
      _started, _setOn, _describedAtClose, _screenshotsAtClose, false, false),
  }

  /// Add something to the open bug report. A picture of at most 5 MB becomes
  /// one more screenshot while the bug report has fewer than 4. Anything
  /// else is refused and the bug report stays as it was.
  action addPicture(kind: str, megabytes: int): bool = all {
    openBugReports == 1,
    val accepted = all {
      kind == "picture",
      megabytes <= PICTURE_LIMIT_MB,
      screenshots < SCREENSHOT_LIMIT,
    }
    _becomes(openBugReports, described,
      if (accepted) screenshots + 1 else screenshots,
      shakeToReport, phoneAllows, _started, _setOn, _describedAtClose,
      _screenshotsAtClose, false, false),
  }

  /// Remove a screenshot from the open bug report.
  action removeScreenshot: bool = all {
    openBugReports == 1,
    screenshots > 0,
    _becomes(openBugReports, described, screenshots - 1, shakeToReport,
      phoneAllows, _started, _setOn, _describedAtClose, _screenshotsAtClose,
      false, false),
  }

  /// Move the keyboard through the open bug report. The bug report stays
  /// as it was.
  action moveKeyboardThrough: bool = all {
    openBugReports == 1,
    _stays,
  }

  /// Turn shake to report off. Alice does this while no bug report is open.
  action turnOffShakeToReport: bool = all {
    openBugReports == 0,
    shakeToReport,
    _becomes(openBugReports, described, screenshots, false, phoneAllows,
      _started, false, _describedAtClose, _screenshotsAtClose, false, false),
  }

  /// Turn shake to report back on. Alice does this while no bug report is open.
  action turnOnShakeToReport: bool = all {
    openBugReports == 0,
    not(shakeToReport),
    _becomes(openBugReports, described, screenshots, true, phoneAllows,
      _started, true, _describedAtClose, _screenshotsAtClose, false, false),
  }

  /// Allow shake to report on a phone that is waiting for Alice's answer.
  action allowShakeToReport: bool = all {
    phoneAllows == "waiting",
    _becomes(openBugReports, described, screenshots, shakeToReport, "allowed",
      _started, _setOn, _describedAtClose, _screenshotsAtClose, false, false),
  }

  /// Refuse to allow shake to report on a phone that is waiting for Alice's
  /// answer. She is told to choose to report a bug instead of shaking.
  action refuseShakeToReport: bool = all {
    phoneAllows == "waiting",
    _becomes(openBugReports, described, screenshots, shakeToReport, "refused",
      _started, _setOn, _describedAtClose, _screenshotsAtClose, false, false),
  }

  /// Close the app and open it again while no bug report is open. The draft
  /// is still on the phone and shake to report stays as Alice set it.
  action reopenApp: bool = all {
    openBugReports == 0,
    _stays,
  }

  action step = {
    nondet kind = KINDS.oneOf()
    nondet megabytes = SIZES.oneOf()
    any {
      chooseToReport,
      shakePhone,
      threeFingerPress,
      reportBugAbout,
      closeBugReport,
      describeBug,
      addPicture(kind, megabytes),
      removeScreenshot,
      moveKeyboardThrough,
      turnOffShakeToReport,
      turnOnShakeToReport,
      allowShakeToReport,
      refuseShakeToReport,
      reopenApp,
    }
  }

  /// At most one bug report is open.
  val invAtMostOneOpen = all {
    openBugReports >= 0,
    openBugReports <= 1,
  }

  /// A shake opens a bug report only while shake to report is on and the
  /// phone allows it.
  val invShakeOpensOnlyWhenAllowed =
    _shakeJustOpened implies
      (openBugReports == 1 and shakeToReport and phoneAllows == "allowed")

  /// A bug report never carries more than 4 screenshots.
  val invAtMostFourScreenshots = all {
    screenshots >= 0,
    screenshots <= SCREENSHOT_LIMIT,
  }

  /// Closing keeps the draft: while the bug report is closed, and when it is
  /// opened again, its description and screenshots are as they were closed.
  val invClosingKeepsTheDraft =
    (openBugReports == 0 or _draftJustOpened) implies
      (described == _describedAtClose and screenshots == _screenshotsAtClose)

  /// Before Alice has started a bug report there is nothing to keep.
  val invNothingBeforeTheFirstBugReport =
    not(_started) implies
      (openBugReports == 0 and not(described) and screenshots == 0)

  /// Shake to report stays as Alice set it.
  val invShakeToReportStaysAsSet = shakeToReport == _setOn

  /// A phone that does not ask first always allows shaking, and one that
  /// asks gives one of three answers.
  val invPhoneWaitsForAlice = all {
    Set("waiting", "allowed", "refused").contains(phoneAllows),
    not(_asksFirst) implies (phoneAllows == "allowed"),
  }
}
