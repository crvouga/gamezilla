// Dave's email address at Apple, as his Apple sign-in method shows it.
//
// The first time Dave signs in with Apple he either shares his email address
// or hides it. Hidden, his Apple sign-in method shows a private Apple email
// address instead. While it does, Apple can stop forwarding mail from that
// address to Dave, and forward it again, and his Apple sign-in method shows
// which. A shared email address has nothing for Apple to forward.
module private_apple_email {
  /// Whether Dave has signed in with Apple.
  var _signedIn: bool
  /// Whether Dave's Apple sign-in method shows a private Apple email address.
  var privateAppleEmailAddress: bool
  /// Whether Dave's Apple sign-in method shows mail is not forwarded.
  var mailNotForwarded: bool

  action init = all {
    _signedIn' = false,
    privateAppleEmailAddress' = false,
    mailNotForwarded' = false,
  }

  /// Dave signs in with Apple for the first time, hiding his email address
  /// or sharing it.
  action signInWithApple(hide: bool): bool = all {
    not(_signedIn),
    _signedIn' = true,
    privateAppleEmailAddress' = hide,
    mailNotForwarded' = false,
  }

  /// Apple stops forwarding mail from Dave's private Apple email address (a
  /// world event: Dave chooses it at Apple, not in the app).
  action stopForwardingMail: bool = all {
    privateAppleEmailAddress,
    _signedIn' = _signedIn,
    privateAppleEmailAddress' = privateAppleEmailAddress,
    mailNotForwarded' = true,
  }

  /// Apple forwards mail from Dave's private Apple email address again.
  action forwardMailAgain: bool = all {
    privateAppleEmailAddress,
    _signedIn' = _signedIn,
    privateAppleEmailAddress' = privateAppleEmailAddress,
    mailNotForwarded' = false,
  }

  action step = {
    nondet hide = Set(true, false).oneOf()
    any {
      signInWithApple(hide),
      stopForwardingMail,
      forwardMailAgain,
    }
  }

  /// Bookkeeping: only a private Apple email address can show mail is not
  /// forwarded (Apple forwards nothing else, so nothing can break it).
  val invForwardingOnlyForPrivateAddresses =
    mailNotForwarded implies privateAppleEmailAddress
}
