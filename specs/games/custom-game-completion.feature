@domain:games
Feature: Finish or cancel a custom game
  When a custom game ends, the participants want a clear final result, so nothing done later can revive it or replace its result.

  Rule: The creator may cancel a custom game that has not finished

    Scenario: Cancellation before the start leaves no invitation
      Given Alice is setting up a custom game
      And Alice has invited Bob to the second side
      When Alice cancels the custom game
      Then the custom game is cancelled with no result
      And neither side has an invitation

    Scenario: A watching creator cancels a custom game between two bots
      Given Alice has a custom game under way between two bots
      When Alice cancels the custom game
      Then the custom game is cancelled with no result

    Scenario: A watcher cannot cancel the creator's custom game
      Given Alice and Bob have a custom game under way watched by Carol
      When Carol cancels the custom game
      Then Carol is told only the creator cancels the custom game

    Scenario: A participant cannot cancel a custom game that has not started
      Given Alice is setting up a custom game with Bob on the second side
      When Bob cancels the custom game
      Then Bob is told only the creator cancels the custom game

    Scenario: Cancellation cannot erase a finished result
      Given Alice has a finished custom game
      When Alice cancels the custom game
      Then Alice is told the game is finished

  Rule: Either participant may cancel a custom game between two people until each side has moved

    Scenario: The second side cancels before making a move
      Given Alice and Bob have a custom game after Alice's first move
      When Bob cancels the custom game
      Then the custom game is cancelled with no result

    Scenario: A participant cannot cancel the creator's custom game once both sides have moved
      Given Alice and Bob have a custom game after their first moves
      When Bob cancels the custom game
      Then Bob is told to resign instead of cancelling
      And the custom game remains under way

  Rule: Leaving the space releases a side before the start and resigns a side under way

    Scenario: A departure releases an accepted side before the start
      Given Alice is setting up a custom game with Bob on the second side
      When Bob leaves the space
      Then the second side is open

    Scenario: A departure resigns a side under way
      Given Alice and Bob have a custom game under way
      When Bob leaves the space
      Then Alice wins the custom game by resignation

    Scenario: Returning cannot recover a side already claimed
      Given Alice is setting up a custom game
      And Bob has left the space after claiming the second side
      And Carol has claimed the second side
      When Bob joins the space from the link
      Then the second side is Carol
      And Bob cannot make a move

  Rule: Ending the space cancels every unfinished custom game
    No counter-example: nobody can keep an unfinished custom game once its space ends; a finished result is simply kept.

    Scenario: The host's departure ends a custom game under way
      Given Alice and Bob have a custom game under way
      When Alice leaves the space
      Then Bob sees the space has ended within 15 seconds
      And Alice is not in a space

    Scenario: Ending a space with a finished custom game ends it for both people
      Given Alice has a finished custom game
      When Alice ends the space
      Then Bob sees the space has ended within 15 seconds
      And Alice is not in a space

  Rule: A rematch keeps the clock choice and swaps the sides without changing the finished custom game

    Scenario: A rematch swaps people and requires readiness again
      Given Alice has a finished custom game
      When Alice asks for a rematch
      Then a new custom game is being set up with no moves
      And the first side is Bob and the second side is Alice
      And neither person is ready for the custom game

    Scenario: An unfinished custom game cannot have a rematch
      Given Alice and Bob have a custom game under way
      When Alice asks for a rematch
      Then Alice is told the custom game must finish or be cancelled first
