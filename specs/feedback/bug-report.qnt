// Alice reports bugs from her phone, one bug report at a time. She describes
// a bug, which starts a draft the phone keeps with its screenshots, and then
// either sends the bug report or discards the draft. A discarded draft is
// gone for good and the team never gets it.
//
// A bug report she sends reaches the team's list of work straight away when
// it can. When it cannot, because her phone is offline, the team cannot
// receive bug reports right now, or the team has already taken 10 bug
// reports from her phone today, it is a kept bug report: the phone keeps it
// and sends it for her as soon as it can reach the team. Kept bug reports
// reach the team in the order she sent them, and each one the team takes
// counts toward the daily bug report limit of the day it arrives.
//
// However many times her phone sends a bug report, the team has it once.
// Reopening the app changes nothing: the draft and every kept bug report are
// still on the phone. The next day the daily bug report limit starts again.
//
// With no connection she can still describe a bug, discard a draft and send
// a bug report. Nothing reaches the team until her phone is back online, and
// nothing she sent is lost.
module bug_report {
  pure val PHONE = "alice-phone"
  pure val DEVICES = Set(PHONE)
  /// The bug reports Alice may write, numbered in the order she writes them.
  pure val REPORTS = Set(1, 2, 3)
  /// Bug reports the team takes from one device in a day.
  pure val DAILY_BUG_REPORT_LIMIT: int = 10

  /// The draft on Alice's phone: the bug report she has described and not sent.
  var draft: Set[int]
  /// Bug reports Alice has sent that her phone still keeps for the team.
  var kept: Set[int]
  /// How many times the team has each bug report on its list of work.
  var teamCopies: int -> int
  /// Bug reports the team has taken from Alice's phone today.
  var takenToday: int
  /// Bookkeeping: every bug report Alice has described so far.
  var _written: Set[int]
  /// Bookkeeping: every bug report Alice has sent.
  var _sent: Set[int]
  /// Bookkeeping: every draft Alice has discarded.
  var _discarded: Set[int]
  /// Bookkeeping: bug reports sent since the connection was last lost.
  var _sentOffline: Set[int]
  /// Devices whose connection is gone.
  var _offline: Set[str]
  /// Bookkeeping: whether the team cannot receive bug reports right now.
  var _teamAway: bool

  /// How many more bug reports the team can take from the phone right now.
  pure def _room(taken: int, offline: Set[str], away: bool): int =
    if (offline.contains(PHONE) or away) 0 else DAILY_BUG_REPORT_LIMIT - taken

  /// The kept bug reports that reach the team now: the earliest sent first.
  pure def _arriving(waiting: Set[int], room: int): Set[int] =
    waiting.filter(report => waiting.filter(other => other < report).size() < room)

  /// Everything settles the same way after any action: every kept bug report
  /// that can reach the team does, once, and counts toward today.
  action _settle(
    drafted: Set[int],
    waiting: Set[int],
    taken: int,
    written: Set[int],
    sent: Set[int],
    discarded: Set[int],
    sentOffline: Set[int],
    offline: Set[str],
    away: bool,
  ): bool = {
    val arriving = _arriving(waiting, _room(taken, offline, away))
    all {
      draft' = drafted,
      kept' = waiting.exclude(arriving),
      teamCopies' = REPORTS.mapBy(report =>
        if (arriving.contains(report)) 1 else teamCopies.get(report)),
      takenToday' = taken + arriving.size(),
      _written' = written,
      _sent' = sent,
      _discarded' = discarded,
      _sentOffline' = sentOffline,
      _offline' = offline,
      _teamAway' = away,
    }
  }

  action init = {
    nondet taken = 8.to(DAILY_BUG_REPORT_LIMIT).oneOf()
    all {
      draft' = Set(),
      kept' = Set(),
      teamCopies' = REPORTS.mapBy(report => 0),
      takenToday' = taken,
      _written' = Set(),
      _sent' = Set(),
      _discarded' = Set(),
      _sentOffline' = Set(),
      _offline' = Set(),
      _teamAway' = false,
    }
  }

  /// Describe a bug. This starts the one draft the phone keeps. Refused
  /// while a draft is already there: that draft is the bug report.
  action describeBug(device: str, report: int): bool = all {
    DEVICES.contains(device),
    draft == Set(),
    report == _written.size() + 1,
    REPORTS.contains(report),
    _settle(Set(report), kept, takenToday, _written.union(Set(report)), _sent,
      _discarded, _sentOffline, _offline, _teamAway),
  }

  /// Discard the draft. It is gone from the phone for good.
  action discardDraft(device: str): bool = all {
    DEVICES.contains(device),
    draft != Set(),
    _settle(Set(), kept, takenToday, _written, _sent,
      _discarded.union(draft), _sentOffline, _offline, _teamAway),
  }

  /// Send the bug report. It reaches the team when it can, and is a kept
  /// bug report when it cannot. Refused without a description.
  action sendBugReport(device: str): bool = all {
    DEVICES.contains(device),
    draft != Set(),
    _settle(Set(), kept.union(draft), takenToday, _written, _sent.union(draft),
      _discarded,
      if (_offline.contains(device)) _sentOffline.union(draft) else _sentOffline,
      _offline, _teamAway),
  }

  /// Close the app and open it again. The draft and every kept bug report
  /// are still on the phone.
  action reopenApp(device: str): bool = all {
    DEVICES.contains(device),
    _settle(draft, kept, takenToday, _written, _sent, _discarded,
      _sentOffline, _offline, _teamAway),
  }

  /// The next day starts, and with it the daily bug report limit.
  action dayPasses: bool = all {
    _settle(draft, kept, 0, _written, _sent, _discarded, _sentOffline,
      _offline, _teamAway),
  }

  /// This device loses its connection. Refused when that connection is already gone.
  action loseConnection(device: str): bool = all {
    DEVICES.contains(device),
    not(_offline.contains(device)),
    _settle(draft, kept, takenToday, _written, _sent, _discarded, Set(),
      _offline.union(Set(device)), _teamAway),
  }

  /// This device's connection comes back. Refused when it never left.
  action connectionReturns(device: str): bool = all {
    DEVICES.contains(device),
    _offline.contains(device),
    _settle(draft, kept, takenToday, _written, _sent, _discarded, Set(),
      _offline.exclude(Set(device)), _teamAway),
  }

  /// The team stops being able to receive bug reports for a while.
  action _teamStopsReceiving: bool = all {
    not(_teamAway),
    _settle(draft, kept, takenToday, _written, _sent, _discarded,
      _sentOffline, _offline, true),
  }

  /// The team can receive bug reports again.
  action _teamReceivesAgain: bool = all {
    _teamAway,
    _settle(draft, kept, takenToday, _written, _sent, _discarded,
      _sentOffline, _offline, false),
  }

  /// The phone sends again a bug report Alice already sent. Nothing changes:
  /// the team still has it once, and it counts toward today once.
  action _deviceSendsAgain(device: str): bool = all {
    DEVICES.contains(device),
    _sent != Set(),
    _settle(draft, kept, takenToday, _written, _sent, _discarded,
      _sentOffline, _offline, _teamAway),
  }

  action step = {
    nondet device = DEVICES.oneOf()
    nondet report = REPORTS.oneOf()
    any {
      describeBug(device, report),
      discardDraft(device),
      sendBugReport(device),
      reopenApp(device),
      dayPasses,
      loseConnection(device),
      connectionReturns(device),
      _teamStopsReceiving,
      _teamReceivesAgain,
      _deviceSendsAgain(device),
    }
  }

  /// The team never has the same bug report twice.
  val invTeamHasEachOnce =
    REPORTS.forall(report => teamCopies.get(report) <= 1)

  /// A bug report Alice sent is with the team or still kept on her phone.
  val invSentIsNeverLost =
    _sent.forall(report => teamCopies.get(report) == 1 or kept.contains(report))

  /// A discarded draft never reaches the team, and is not kept either.
  val invDiscardedNeverArrives =
    _discarded.forall(report =>
      teamCopies.get(report) == 0 and not(kept.contains(report)) and not(draft.contains(report)))

  /// The phone keeps one draft at most, and a draft is not yet sent.
  val invOneDraft = all {
    draft.size() <= 1,
    draft.intersect(kept) == Set(),
    draft.forall(report => teamCopies.get(report) == 0),
  }

  /// The team never takes more than 10 bug reports from the phone in a day.
  val invDailyLimitHolds = all {
    takenToday >= 0,
    takenToday <= DAILY_BUG_REPORT_LIMIT,
  }

  /// A kept bug report waits only while it cannot reach the team.
  val invKeptWaitsForAReason =
    (kept != Set()) implies
      (_offline.contains(PHONE) or _teamAway or takenToday >= DAILY_BUG_REPORT_LIMIT)

  /// While the connection is gone, every bug report sent since it was lost
  /// is still kept on the phone, and none of them has reached the team.
  val invOfflineKeepsWhatWasSent =
    _offline.contains(PHONE) implies
      _sentOffline.forall(report => kept.contains(report) and teamCopies.get(report) == 0)
}
