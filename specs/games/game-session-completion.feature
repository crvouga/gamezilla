@domain:games
Feature: Finish or cancel a game session
  When a game session ends, the participants want a clear final result, so nothing done later can revive it or replace its result.

  Rule: The creator may cancel a game session that has not finished

    Scenario: Cancellation before the start leaves no invitation
      Given Alice is setting up a game session
      And Alice has invited Bob to the second side
      When Alice cancels the game session
      Then the game session is cancelled with no result
      And neither side has an invitation

    Scenario: A watching creator cancels a game session between two bots
      Given Alice has a game session under way between two bots
      When Alice cancels the game session
      Then the game session is cancelled with no result

    Scenario: A watcher cannot cancel the creator's game session
      Given Alice and Bob have a game session under way watched by Carol
      When Carol cancels the game session
      Then Carol is told only the creator cancels the game session

    Scenario: A participant cannot cancel a game session that has not started
      Given Alice is setting up a game session with Bob on the second side
      When Bob cancels the game session
      Then Bob is told only the creator cancels the game session

    Scenario: Cancellation cannot erase a finished result
      Given Alice has a finished game session
      When Alice cancels the game session
      Then Alice is told the game is finished

  Rule: Either participant may cancel a game session between two people until each side has moved

    Scenario: The second side cancels before making a move
      Given Alice and Bob have a game session after Alice's first move
      When Bob cancels the game session
      Then the game session is cancelled with no result

    Scenario: A participant cannot cancel the creator's game session once both sides have moved
      Given Alice and Bob have a game session after their first moves
      When Bob cancels the game session
      Then Bob is told to resign instead of cancelling
      And the game session remains under way

  Rule: Leaving the space releases a side before the start and resigns a side under way

    Scenario: A departure releases an accepted side before the start
      Given Alice is setting up a game session with Bob on the second side
      When Bob leaves the space
      Then the second side is open

    Scenario: A departure resigns a side under way
      Given Alice and Bob have a game session under way
      When Bob leaves the space
      Then Alice wins the game session by resignation

    Scenario: Returning cannot recover a side already claimed
      Given Alice is setting up a game session
      And Bob has left the space after claiming the second side
      And Carol has claimed the second side
      When Bob joins the space from the link
      Then the second side is Carol
      And Bob cannot make a move

  Rule: Ending the space cancels every unfinished game session
    No counter-example: nobody can keep an unfinished game session once its space ends; a finished result is simply kept.

    Scenario: The host's departure ends a game session under way
      Given Alice and Bob have a game session under way
      When Alice leaves the space
      Then Bob sees the space has ended within 15 seconds
      And Alice is not in a space

    Scenario: Ending a space with a finished game session ends it for both people
      Given Alice has a finished game session
      When Alice ends the space
      Then Bob sees the space has ended within 15 seconds
      And Alice is not in a space

  Rule: A rematch keeps the clock choice and swaps the sides without changing the finished game session

    Scenario: A rematch swaps people and requires readiness again
      Given Alice has a finished game session
      When Alice asks for a rematch
      Then a new game session is being set up with no moves
      And the first side is Bob and the second side is Alice
      And neither person is ready for the game session

    Scenario: An unfinished game session cannot have a rematch
      Given Alice and Bob have a game session under way
      When Alice asks for a rematch
      Then Alice is told the game session must finish or be cancelled first
