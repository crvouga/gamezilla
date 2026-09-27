@domain:journeys @production
Feature: Critical journeys
  The flows people rely on most. They must never break, anywhere people use
  the app.

  Scenario: The app opens past the boot screen into the tabs
    When a person opens the app on a fresh device
    Then the app finishes booting into the tabs

  @browser
  Scenario: Signing in with Google hands the person to Google with the way back
    Given a person opens the app on a fresh device
    When they start signing in with Google
    Then Google is asked to sign them in and send them back to the app

  Scenario: A signed-in person can sign out
    Given a person is signed in on a fresh device
    When they sign out of their account
    Then their account offers to sign in again

  Scenario: A person hosts a space and ends it
    Given a person is signed in on a fresh device
    When they host a space
    Then the space offers games to play
    When they end the space
    Then the space shows it has ended

  Scenario: A chess puzzle started in a space is ready to play
    Given a person is signed in on a fresh device
    And they are hosting a space
    When they start a chess puzzle in the space
    Then a puzzle board is laid out and ready to play

  Scenario: A person changes their avatar and the change is kept
    Given a person is signed in on a fresh device
    When they save a new avatar
    Then editing their avatar again shows the new one

  Scenario: Searching for people settles on an answer
    Given a person is signed in on a fresh device
    When they search for people with a name nobody has
    Then the search settles on no results

  Scenario: A guest solves a puzzle and the next one is ready
    Given a person opens the app on a fresh device
    And they are hosting a space
    And they have started a chess puzzle in the space
    When they solve the puzzle
    Then the next puzzle is ready to play

  Scenario: A signed-in person can see what Plus offers
    Given a person is signed in on a fresh device
    When they look at the billing plans
    Then Plus is offered at its monthly and yearly prices
