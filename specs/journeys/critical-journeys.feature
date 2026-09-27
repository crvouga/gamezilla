@domain:journeys @production
Feature: Critical journeys
  The flows people rely on most. They must never break, anywhere people use
  the app.

  Scenario: The app opens past the boot screen into the tabs
    Given a person opens the app on a fresh device
    Then the app finishes booting into the tabs

  @browser
  Scenario: Signing in with Google hands the person to Google with the way back
    Given a person opens the app on a fresh device
    When they start signing in with Google
    Then Google is asked to sign them in and send them back to the app

  Scenario: A signed-in person sees their account and can sign out
    Given a person is signed in on a fresh device
    When they sign out of their account
    Then their account offers to sign in again

  Scenario: A person hosts a space and ends it
    Given a person is signed in on a fresh device
    When they host a space
    Then the space offers games to play
    When they end the space
    Then the space shows it has ended

  Scenario: A person opens a chess puzzle in a space and gets a playable board
    Given a person is signed in on a fresh device
    And they host a space
    When they start a chess puzzle in the space
    Then a puzzle board is laid out and ready to play
    When they end the space
    Then the space shows it has ended

  Scenario: A person changes their avatar and the change is kept
    Given a person is signed in on a fresh device
    When they save a new avatar
    Then editing their avatar again shows the new one

  Scenario: People search answers a query instead of spinning forever
    Given a person is signed in on a fresh device
    When they search for people with a name nobody has
    Then the search settles on no results
