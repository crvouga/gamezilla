// Dave's email address at Apple, as his Apple sign-in method shows it.
//
// The first time Dave signs in with Apple he either shares his email address
// or hides it. Hidden, his Apple sign-in method shows a private Apple email
// address instead. While it does, Apple can stop forwarding mail from that
// address to Dave, and forward it again, and his Apple sign-in method shows
// which. A shared email address has nothing for Apple to forward. Signing in
// needs a connection. Apple stops forwarding mail, and forwards it again,
// whether or not Dave's device has one.
module private_apple_email {
  /// Whether Dave has signed in with Apple.
  var _signedIn: bool
  /// Whether Dave's Apple sign-in method shows a private Apple email address.
  var privateAppleEmailAddress: bool
  /// Whether Dave's Apple sign-in method shows mail is not forwarded.
  var mailNotForwarded: bool
  /// Whether Dave's device has a connection. Signing in needs one.
  var _phoneOnline: bool
  /// How many times Dave has signed in, and how many when the connection went.
  var _done: int
  var _doneAtCutOff: int

  action init = all {
    _signedIn' = false,
    privateAppleEmailAddress' = false,
    mailNotForwarded' = false,
    _phoneOnline' = true,
    _done' = 0,
    _doneAtCutOff' = 0,
  }

  /// Dave signs in with Apple for the first time, hiding his email address
  /// or sharing it.
  action signInWithApple(hide: bool): bool = all {
    _phoneOnline,
    not(_signedIn),
    _signedIn' = true,
    privateAppleEmailAddress' = hide,
    mailNotForwarded' = false,
    _phoneOnline' = _phoneOnline,
    _done' = _done + 1,
    _doneAtCutOff' = _doneAtCutOff,
  }

  /// Apple stops forwarding mail from Dave's private Apple email address (a
  /// world event: Dave chooses it at Apple, not in the app).
  action stopForwardingMail: bool = all {
    privateAppleEmailAddress,
    _signedIn' = _signedIn,
    privateAppleEmailAddress' = privateAppleEmailAddress,
    mailNotForwarded' = true,
    _phoneOnline' = _phoneOnline,
    _done' = _done,
    _doneAtCutOff' = _doneAtCutOff,
  }

  /// Apple forwards mail from Dave's private Apple email address again.
  action forwardMailAgain: bool = all {
    privateAppleEmailAddress,
    _signedIn' = _signedIn,
    privateAppleEmailAddress' = privateAppleEmailAddress,
    mailNotForwarded' = false,
    _phoneOnline' = _phoneOnline,
    _done' = _done,
    _doneAtCutOff' = _doneAtCutOff,
  }

  /// Dave's device loses its connection.
  action _phoneGoesOffline: bool = all {
    _phoneOnline,
    _signedIn' = _signedIn,
    privateAppleEmailAddress' = privateAppleEmailAddress,
    mailNotForwarded' = mailNotForwarded,
    _phoneOnline' = false,
    _done' = _done,
    _doneAtCutOff' = _done,
  }

  /// Dave's device is back online.
  action _phoneBackOnline: bool = all {
    not(_phoneOnline),
    _signedIn' = _signedIn,
    privateAppleEmailAddress' = privateAppleEmailAddress,
    mailNotForwarded' = mailNotForwarded,
    _phoneOnline' = true,
    _done' = _done,
    _doneAtCutOff' = _doneAtCutOff,
  }

  action step = {
    nondet hide = Set(true, false).oneOf()
    any {
      signInWithApple(hide),
      stopForwardingMail,
      forwardMailAgain,
      _phoneGoesOffline,
      _phoneBackOnline,
    }
  }

  /// Bookkeeping: only a private Apple email address can show mail is not
  /// forwarded (Apple forwards nothing else, so nothing can break it).
  val invForwardingOnlyForPrivateAddresses =
    mailNotForwarded implies privateAppleEmailAddress

  /// With no connection, Dave signs in no further time.
  val invOfflineSignsInNoFurther = not(_phoneOnline) implies _done == _doneAtCutOff
}
