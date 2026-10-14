@domain:chess
Feature: Keep puzzle play and its first result without a connection
  When a solver loses the connection during a puzzle, they want the same attempt and honest progress kept, so they can carry on without losing or repeating a result.

  Rule: A puzzle already on the device stays playable without a connection
    No counter-example: the daily puzzle limit and chess rules remain the same with or without a connection.

    Scenario: The current puzzle can be solved after the connection is lost
      Given Alice is playing puzzles in their space
      And Alice's current puzzle is already on their device
      When Alice loses the connection
      Then Alice can continue the same puzzle
      And Alice is told the connection is missing within 15 seconds

    Scenario: An offline solver can still use a hint
      Given Alice is playing puzzles in their space
      And Alice is offline
      When Alice asks for a hint
      Then Alice's hint highlights the piece to move
      And Alice is on the same puzzle as before

  Rule: Reopening and returning keep the first result without counting another attempt
    No counter-example: returning is not another puzzle start or another result.

    Scenario: A solve made offline still counts once after reopening
      Given Alice has solved a rated puzzle while offline
      And Alice has closed and reopened the app
      When the connection comes back
      Then Alice's game log contains that solved puzzle exactly once
      And Alice's puzzle rating counts that first result exactly once

    Scenario: A wrong move followed by an offline solve keeps the wrong first result
      Given Alice has played a wrong move and then solved the same puzzle while offline
      When the connection comes back
      Then Alice's game log keeps the failed first result exactly once
      And Alice's puzzle rating counts that first result exactly once

  Rule: Missing puzzles are explained without preventing the solver from leaving

    Scenario: An empty offline feed offers a way back to the game choice
      Given Alice went offline before any puzzles reached their device
      When Alice opens puzzles in their space
      Then Alice is told puzzles need a connection within 15 seconds
      And Alice can return to the space's game choice

