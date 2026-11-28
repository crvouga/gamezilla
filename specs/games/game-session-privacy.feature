@domain:games
Feature: Game sessions follow account deletion and personal-data exports
  When a person keeps a copy of their personal data or deletes their account, they want their game sessions included, so playing a game makes no exception to their privacy choices.

  Rule: Deleting the creator's account ends the space and cancels its unfinished game session

    Scenario: A deleted creator leaves no game session between bots going on
      Given Alice has a recently proven account
      And Alice has a game session under way between two bots
      And Bob is in Alice's space
      When Alice confirms account deletion
      Then Bob sees the space has ended within 15 seconds
      And Bob cannot see the game session

    Scenario: A later account cannot recover the deleted creator's game session
      Given Alice's account deletion has completed
      And Alice's deleted account had a game session
      When Alice signs in with Google
      Then Alice cannot see the deleted account's game session

  Rule: Deleting a participant's account releases a reserved side or resigns a side under way
    No counter-example: account deletion ends taking part, while deleting a watcher's account cannot resign for either participant.

    Scenario: A deleted invitee no longer has a reserved side
      Given Bob has a recently proven account
      And Alice is setting up a game session
      And Alice has invited Bob to the second side
      When Bob confirms account deletion
      Then the second side is open

    Scenario: A deleted participant's side under way resigns
      Given Bob has a recently proven account
      And Alice and Bob have a game session under way
      When Bob confirms account deletion
      Then Alice wins the game session by resignation
      And Alice's space has not ended

    Scenario: Deleting a watcher's account cannot resign for either participant
      Given Carol has a recently proven account
      And Alice and Bob have a game session under way watched by Carol
      When Carol confirms account deletion
      Then the game session remains under way
      And neither person has won the game session

  Rule: A personal-data export includes the person's own game sessions and nobody else's

    @regression:game-session-personal-export-omits-games @regression:chess-custom-export-category
    Scenario: An export includes the participant's choices, moves and result
      Given Alice has a recently proven account
      And Alice has resigned a game session after her first move
      And Alice has asked for a personal-data export
      When Alice's personal-data export becomes ready
      Then Alice's personal-data export includes the game session's choices, moves and result

    Scenario: An export cannot include the game session of a space its person is outside
      Given Carol has a recently proven account
      And Alice has a finished game session
      And Carol is outside Alice's space
      And Carol has asked for a personal-data export
      When Carol's personal-data export becomes ready
      Then Carol's personal-data export cannot include Alice's game session
