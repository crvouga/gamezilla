@domain:chess
Feature: Custom Games respect account deletion and personal-data export
  When a person keeps a copy of their personal data or deletes their account, they want Custom Games included, so playing chess creates no exception to their privacy choices.

  Rule: Deleting the creator's account ends the space and cancels unfinished games

    Scenario: A deleted creator leaves no running bot game
      Given Alice has a recently proven account
      And Alice has an active Custom Game between two bots
      When Alice confirms account deletion
      Then Bob sees the space has ended within 15 seconds
      And Bob cannot see the Custom Game

    Scenario: A later account cannot recover the deleted creator's game
      Given Alice's account deletion has completed
      And Alice's deleted account had a Custom Game
      When Alice signs in with Google
      Then Alice cannot see the deleted account's Custom Game

  Rule: Deleting a participant releases a waiting side or resigns an active side
    No counter-example: account deletion ends participation, while deleting a watcher cannot resign for either participant.

    Scenario: A deleted invitee no longer has a reserved side
      Given Bob has a recently proven account
      And Alice has a configuring Custom Game
      And Black in the Custom Game is reserved for Bob
      When Bob confirms account deletion
      Then Black is an open place in the Custom Game

    Scenario: A deleted participant's active side resigns
      Given Bob has a recently proven account
      And Alice has an active Custom Game between Alice as White and Bob as Black
      When Bob confirms account deletion
      Then Alice wins the Custom Game by resignation
      And Alice's space has not ended

    Scenario: Deleting a watcher cannot resign for either participant
      Given Carol has a recently proven account
      And Alice has an active Custom Game between Alice as White and Bob as Black
      And Carol is in Alice's space
      When Carol confirms account deletion
      Then The Custom Game remains active
      And Neither person has won the Custom Game

  Rule: Personal-data exports include the person's retained Custom Games without another person's private data

    @regression:custom-game-personal-export-omits-games @regression:chess-custom-export-category
    Scenario: An export includes the participant's choices moves and outcome
      Given Alice has a recently proven account
      And Alice has a completed Custom Game after White's e4
      And Alice has asked for a personal-data export
      When Alice's personal-data export becomes ready
      Then Alice's personal-data export includes the Custom Game choices moves and outcome

    Scenario: An export cannot include an outsider's Custom Game
      Given Carol has a recently proven account
      And Alice has a completed Custom Game between Alice as White and Bob as Black
      And Carol is outside Alice's space
      And Carol has asked for a personal-data export
      When Carol's personal-data export becomes ready
      Then Carol's personal-data export cannot include Alice's Custom Game
