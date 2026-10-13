// Alice's paid access while grace runs out, and when a payment is refunded.
//
// She is signed in on her computer and on her phone, with a new Plus
// membership still in its free trial. The trial can end, and she still has
// paid access. She can cancel while the free trial is still running and
// reach that period end: paid access then lasts 7 days and no longer.
// Once the free trial has ended, this story does not run the paid month
// out — a sign-in lapses before that period end, and signing in again is
// a separate rule. Or, once the trial has ended, a refund takes paid
// access away at once, with no grace.
//
// Her phone can lose its connection while the membership is live. It keeps
// paid access for 7 days and then shows free access. Coming back shows paid
// access again. Her computer, still connected, keeps paid access the whole time.
module grace_and_refunds {
  type Device = str

  pure val COMPUTER: Device = "alice"
  pure val PHONE: Device = "alice-phone"
  pure val DEVICES: Set[Device] = Set(COMPUTER, PHONE)

  /// "paid" or "free", as that device shows it.
  var accessOn: Device -> str
  /// "live" while Plus is still running, "grace" after a canceled period
  /// ends, "refunded" after the payment comes back.
  var _phase: str
  /// Days counted toward the 7 of grace, either after the period end or
  /// while the phone has no connection.
  var _day: int
  /// The free trial has ended and the membership is on a paid renewal.
  var _trialOver: bool
  /// Devices whose connection is gone.
  var _offline: Set[Device]

  pure def _after(day: int): str = if (day > 7) "free" else "paid"

  action _move(
    access: Device -> str,
    phase: str,
    day: int,
    trialOver: bool,
    offline: Set[Device],
  ): bool = all {
    accessOn' = access,
    _phase' = phase,
    _day' = day,
    _trialOver' = trialOver,
    _offline' = offline,
  }

  action init = all {
    accessOn' = DEVICES.mapBy(_ => "paid"),
    _phase' = "live",
    _day' = 0,
    _trialOver' = false,
    _offline' = Set(),
  }

  /// The free trial ends. Paid access stays.
  action trialEnds: bool = all {
    _phase == "live",
    not(_trialOver),
    _offline == Set(),
    _move(accessOn, "live", _day, true, _offline),
  }

  /// She cancels while the free trial is still running, and that period
  /// ends. Grace starts at 7 days of paid access. Refused once the free
  /// trial has ended.
  action endCanceledPeriod: bool = all {
    _phase == "live",
    not(_trialOver),
    _offline == Set(),
    _move(DEVICES.mapBy(_ => "paid"), "grace", 0, _trialOver, Set()),
  }

  /// Days pass. During grace, both devices lose paid access once 7 days are
  /// over. While the phone is offline and Plus is live, only the phone does,
  /// and only after 7 days.
  action daysPass(n: int): bool = all {
    n >= 1,
    n <= 8,
    _day + n <= 8,
    if (_phase == "grace" and _offline == Set())
      _move(DEVICES.mapBy(_ => _after(_day + n)), "grace", _day + n, _trialOver, Set())
    else
      all {
        _phase == "live",
        _offline.contains(PHONE),
        _move(
          accessOn.set(PHONE, _after(_day + n)),
          "live",
          _day + n,
          _trialOver,
          _offline,
        ),
      },
  }

  /// The payment is given back. Paid access ends at once, with no grace.
  action refund: bool = all {
    _phase == "live",
    _trialOver,
    _offline == Set(),
    _move(DEVICES.mapBy(_ => "free"), "refunded", _day, true, Set()),
  }

  /// The phone loses its connection. Refused when it is already gone, and
  /// while grace or a refund is what the devices are showing.
  action _loseConnection(device: Device): bool = all {
    device == PHONE,
    _phase == "live",
    not(_offline.contains(device)),
    _move(accessOn, _phase, _day, _trialOver, _offline.union(Set(device))),
  }

  /// The phone's connection comes back. A live membership shows paid access
  /// again. Refused when the phone never left.
  action _connectionReturns: bool = all {
    _offline != Set(),
    _phase == "live",
    _move(DEVICES.mapBy(_ => "paid"), "live", 0, _trialOver, Set()),
  }

  action step = {
    nondet device = DEVICES.oneOf()
    nondet n = 1.to(8).oneOf()
    any {
      trialEnds,
      endCanceledPeriod,
      daysPass(n),
      refund,
      _loseConnection(device),
      _connectionReturns,
    }
  }

  /// An offline phone keeps paid access for 7 days and then shows free
  /// access, while the computer still shows paid access.
  val invOfflineDropsPaidAccess = _offline.contains(PHONE) implies all {
    _phase == "live",
    accessOn.get(COMPUTER) == "paid",
    accessOn.get(PHONE) == _after(_day),
  }

  /// Connected devices agree. Grace lasts 7 days. A refund has no grace.
  val invConnectedAccess = (_offline == Set()) implies all {
    accessOn.get(COMPUTER) == accessOn.get(PHONE),
    accessOn.get(COMPUTER) ==
      if (_phase == "refunded") "free"
      else if (_phase == "grace") _after(_day)
      else "paid",
  }
}
