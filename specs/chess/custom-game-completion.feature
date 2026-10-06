@domain:chess
Feature: Finish or cancel a Custom Game
  When a game ends, the participants want a clear final outcome, so later actions cannot revive it or overwrite its result.

  Rule: A participant may resign an active game

    Scenario: Resignation awards the other side the game
      Given Alice has an active Custom Game between Alice as White and Bob as Black
      When Bob resigns the Custom Game
      Then Alice wins the Custom Game by resignation

    Scenario: A watcher cannot resign for a participant
      Given Alice has an active Custom Game between Alice as White and Bob as Black
      And Carol is in Alice's space
      When Carol resigns the Custom Game
      Then Carol is told only a participant may resign

  Rule: The creator may cancel a game that has not finished

    Scenario: Cancellation before start closes every place
      Given Alice has a configuring Custom Game
      And Black in the Custom Game is reserved for Bob
      When Alice cancels the Custom Game
      Then The Custom Game is cancelled with no winner
      And Neither side offers an invitation

    Scenario: A watching creator cancels an active bot game
      Given Alice has a configuring Custom Game
      And White and Black in the Custom Game are bots
      And The Custom Game has started
      When Alice cancels the Custom Game
      Then The Custom Game is cancelled with no winner

    Scenario: A watcher cannot cancel the creator's game
      Given Alice has an active Custom Game between Alice as White and Bob as Black
      And Carol is in Alice's space
      When Carol cancels the Custom Game
      Then Carol is told only the creator cancels the Custom Game

    Scenario: A participant cannot cancel a game that has not started
      Given Alice has a Custom Game between Alice as White and Bob as Black
      When Bob cancels the Custom Game
      Then Bob is told only the creator cancels the Custom Game

    Scenario: Cancellation cannot erase a completed outcome
      Given Alice has a completed Custom Game between Alice as White and Bob as Black
      When Alice cancels the Custom Game
      Then Alice is told the Custom Game has finished

  Rule: Either participant may cancel a game between two people until each side has moved

    Scenario: Black cancels before making a move
      Given Alice has an active Custom Game after White's e4
      When Bob cancels the Custom Game
      Then The Custom Game is cancelled with no winner

    Scenario: A participant cannot cancel the creator's game once both sides have moved
      Given Alice has an active Custom Game after White's e4 and Black's e5
      When Bob cancels the Custom Game
      Then Bob is told to resign instead of cancelling
      And The Custom Game remains active

  Rule: Leaving the space releases a waiting side and resigns an active side

    Scenario: A departure releases an accepted waiting side
      Given Alice has a Custom Game between Alice as White and Bob as Black
      When Bob leaves the space
      Then Black is an open place in the Custom Game

    Scenario: A departure resigns an active side
      Given Alice has an active Custom Game between Alice as White and Bob as Black
      When Bob leaves the space
      Then Alice wins the Custom Game by resignation

    Scenario: Returning cannot recover a side already claimed
      Given Alice has a configuring Custom Game
      And Bob has left the space after releasing Black
      And Carol has claimed Black in the Custom Game
      When Bob joins the space from the link
      Then Black is Carol in the Custom Game
      And Bob cannot move pieces in the Custom Game

  Rule: Ending the space cancels every unfinished Custom Game
    No counter-example: nobody can keep an unfinished game once its space ends; a completed result is simply kept.

    Scenario: The host's departure ends an active game
      Given Alice has an active Custom Game between Alice as White and Bob as Black
      When Alice leaves the space
      Then The Custom Game is cancelled with no winner

    Scenario: Ending the space preserves an already completed result
      Given Alice has a completed Custom Game between Alice as White and Bob as Black
      When Alice ends the space
      Then The Custom Game keeps its completed outcome

  Rule: A rematch keeps choices and swaps sides without changing the finished game

    Scenario: A rematch swaps people and requires readiness again
      Given Alice has a completed Custom Game between Alice as White and Bob as Black
      When Alice creates a rematch of the Custom Game
      Then White is Bob and Black is Alice in the configuring Custom Game
      And Neither person is ready for the Custom Game

    Scenario: An unfinished game cannot have a rematch
      Given Alice has an active Custom Game between Alice as White and Bob as Black
      When Alice creates a rematch of the Custom Game
      Then Alice is told the Custom Game must finish or be cancelled first
