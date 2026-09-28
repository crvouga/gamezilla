@domain:auth
Feature: What people do at Google and Apple
  When people manage their outside accounts at Google and Apple, not in the
  app, they want the app to keep up with what they choose there, so their
  account stays theirs and their sign-in methods show what is true.

  Rule: Signing in with Apple works only while the Apple account exists and its holder lets the app use it

    Scenario: Dave signs in with Apple into a new account
      Given Dave has no account yet
      When Dave signs in with their Apple account
      Then Dave is signed into a new account

    Scenario: Declining the app at Apple cancels signing in
      Given Dave has no account yet
      When Dave declines the app while signing in with Apple
      Then Dave is told signing in was cancelled
      And Dave is signed out

    Scenario: A deleted Apple account can no longer sign in
      Given Dave has deleted their Apple account
      When Dave tries to sign in with Apple
      Then Dave is told signing in was cancelled
      And Dave is signed out

  Rule: Stopping using Sign in with Apple signs the account out everywhere, but not for good

    Scenario: Stopping using Sign in with Apple signs Dave out
      Given Dave is signed in with their Apple account
      When Dave stops using Sign in with Apple
      Then Dave is signed out

    Scenario: Dave signs in with Apple again after stopping using Sign in with Apple
      Given Dave has stopped using Sign in with Apple
      When Dave signs in with their Apple account
      Then Dave is signed into the same account

    Scenario: Signing in with Apple again asks Dave to let the app use it
      Given Dave has stopped using Sign in with Apple
      When Dave declines the app while signing in with Apple
      Then Dave is told signing in was cancelled
      And Dave is signed out

  Rule: Deleting the only sign-in method of an account at Apple signs it out everywhere
    No counter-example: nothing a person does in the app keeps a device signed into an account with no sign-in method.

    Scenario: Deleting Dave's Apple account signs Dave out
      Given Dave is signed in with their Apple account
      When Dave deletes their Apple account
      Then Dave is signed out

  Rule: A changed Google email address keeps the account
    No counter-example: changing an email address at Google never moves the outside account to another account.

    Scenario: A new Google email address keeps Bob's account
      Given Bob has an account they sign into with Google
      And Bob has changed the email address of their Google account
      When Bob signs in with their Google account
      Then Bob is signed into the same account
      And Bob's Google sign-in method shows their new email address

  Rule: A hidden email address shows as a private Apple email address, with whether Apple forwards mail from it
    No counter-example: what Apple forwards is up to the person, at Apple.

    Scenario: A hidden email address shows as a private Apple email address
      Given Dave has no account yet
      When Dave signs in with Apple, hiding their email address
      Then Dave's Apple sign-in method shows a private Apple email address

    Scenario: Apple stopping mail forwarding shows on Dave's Apple sign-in method
      Given Dave is signed in with Apple and hid their email address
      When Apple stops forwarding mail to Dave
      Then Dave's Apple sign-in method shows mail is not forwarded

    Scenario: Apple forwarding mail again shows on Dave's Apple sign-in method
      Given Dave is signed in with Apple and hid their email address
      And Apple has stopped forwarding mail to Dave
      When Apple forwards mail to Dave again
      Then Dave's Apple sign-in method shows mail is forwarded
