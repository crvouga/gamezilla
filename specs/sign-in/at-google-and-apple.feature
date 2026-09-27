@domain:sign-in
Feature: What people do at Google and Apple
  People manage their outside accounts at Google and Apple, not in the app.
  They want the app to keep up with what they choose there, so their
  account stays theirs and their sign-in methods show what is true.

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

  Scenario: A new Google email address keeps Bob's account
    Given Bob has an account they sign into with Google
    And Bob has changed the email address of their Google account
    When Bob signs in with their Google account
    Then Bob is signed into the same account
    And Bob's Google sign-in method shows their new email address

  Scenario: A hidden email address shows as a private Apple email address
    Given Dave has no account yet
    When Dave signs in with Apple and hides their email address
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
