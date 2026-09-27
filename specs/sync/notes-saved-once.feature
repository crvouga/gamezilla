@domain:sync
Feature: Notes count once
  Word that a note was saved can get lost on the way back. The app must still
  get the note to everyone, and never show it twice to anybody.

  Background:
    Given Alice and Bob are in the shared space "Trip"
    And Alice's app will not hear back about its next save

  @goal:works-offline:4 @goal:always-true:3
  Scenario: A note whose save is never confirmed shows exactly once for everyone
    When Alice writes the note "Groceries" saying "milk"
    Then Alice sees the note "Groceries" once
    And Bob sees the note "Groceries" once

  @goal:works-offline:4 @goal:always-true:3
  Scenario: A note whose save is never confirmed shows once even after a crash
    When Alice writes the note "Groceries" saying "milk"
    And Alice's app crashes and reopens
    Then Alice sees the note "Groceries" once
    And Bob sees the note "Groceries" once
