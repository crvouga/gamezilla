@domain:games
Feature: Custom games follow account deletion and personal-data exports
  When a person keeps a copy of their personal data or deletes their account, they want their custom games included, so playing a game makes no exception to their privacy choices.

  Rule: Deleting the creator's account ends the space and cancels its unfinished custom game

    Scenario: A deleted creator leaves no custom game between bots going on
      Given Alice has a recently proven account
      And Alice has a custom game under way between two bots
      And Bob is in Alice's space
      When Alice confirms account deletion
      Then Bob sees the space has ended within 15 seconds
      And Bob cannot see the custom game

    Scenario: A later account cannot recover the deleted creator's custom game
      Given Alice's account deletion has completed
      And Alice's deleted account had a custom game
      When Alice signs in with Google
      Then Alice cannot see the deleted account's custom game

  Rule: Deleting a participant's account releases a reserved side or resigns a side under way
    No counter-example: account deletion ends taking part, while deleting a watcher's account cannot resign for either participant.

    Scenario: A deleted invitee no longer has a reserved side
      Given Bob has a recently proven account
      And Alice is setting up a custom game
      And Alice has invited Bob to the second side
      When Bob confirms account deletion
      Then the second side is open

    Scenario: A deleted participant's side under way resigns
      Given Bob has a recently proven account
      And Alice and Bob have a custom game under way
      When Bob confirms account deletion
      Then Alice wins the custom game by resignation
      And Alice's space has not ended

    Scenario: Deleting a watcher's account cannot resign for either participant
      Given Carol has a recently proven account
      And Alice and Bob have a custom game under way watched by Carol
      When Carol confirms account deletion
      Then the custom game remains under way
      And neither person has won the custom game

  Rule: A personal-data export includes the person's own custom games and nobody else's

    @regression:custom-game-personal-export-omits-games @regression:chess-custom-export-category
    Scenario: An export includes the participant's choices, moves and result
      Given Alice has a recently proven account
      And Alice has resigned a custom game after her first move
      And Alice has asked for a personal-data export
      When Alice's personal-data export becomes ready
      Then Alice's personal-data export includes the custom game's choices, moves and result

    Scenario: An export cannot include the custom game of a space its person is outside
      Given Carol has a recently proven account
      And Alice has a finished custom game
      And Carol is outside Alice's space
      And Carol has asked for a personal-data export
      When Carol's personal-data export becomes ready
      Then Carol's personal-data export cannot include Alice's custom game
