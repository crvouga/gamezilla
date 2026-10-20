// @spec-meta — One person's door control stays as they left it while their device has no connection.
// A fixed setting chooses whether it initially shows locked or unlocked.
module parameterized_door {
  const LOCKED: bool
  var locked: bool
  var online: bool
  var _lockedAtCutOff: bool
  action init = all { locked' = LOCKED, online' = true, _lockedAtCutOff' = LOCKED }
  action toggle = all { online, locked' = not(locked), online' = online, _lockedAtCutOff' = not(locked) }
  action _loseConnection = all { online, locked' = locked, online' = false, _lockedAtCutOff' = locked }
  action _connectionReturns = all { not(online), locked' = locked, online' = true, _lockedAtCutOff' = _lockedAtCutOff }
  action step = any { toggle, _loseConnection, _connectionReturns }
  val invKnownState = (locked == true or locked == false) and (online == true or online == false)
  val invOfflineStays = not(online) implies locked == _lockedAtCutOff
  val candidateUnlockedMode = not(LOCKED) or not(locked)
  temporal _fair = toggle.strongFair((locked, online, _lockedAtCutOff)) and
    _connectionReturns.weakFair((locked, online, _lockedAtCutOff))
  temporal liveUnlocked = _fair.implies(eventually(not(locked)))
  temporal liveUnlockedMode = always(not(LOCKED))
}
