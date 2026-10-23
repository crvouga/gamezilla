@domain:games
Feature: Play a game with four sides
  When a game's rules require four players, the participants want every side included, so turns and agreements remain fair to everyone.

  Rule: Every declared side needs a participant and every person must be ready

    Scenario: Four ready people start in the declared turn order
      Given Alice, Bob, Carol and Dave are setting up a four-player custom game
      And all four people are ready for the custom game
      When Alice starts the custom game
      Then the custom game is under way with the first side to move
      And the four sides follow the game's declared turn order

    Scenario: Three ready people cannot start a game with an open fourth side
      Given Alice, Bob and Carol are ready in a four-player custom game with an open fourth side
      When Alice starts the custom game
      Then Alice is told every side needs a participant
      And the custom game is still being set up

    Scenario: The fourth person's agreement is required before starting
      Given Alice, Bob, Carol and Dave are setting up a four-player custom game
      And Alice, Bob and Carol are ready but Dave is not ready
      When Alice starts the custom game
      Then Alice is told every person must be ready
      And the custom game is still being set up

  Rule: A participant without a connection keeps their side and turn
    No counter-example: losing a connection alone is never a move, resignation or completed result.

    Scenario: An offline participant is not skipped
      Given Alice, Bob, Carol and Dave have a four-player custom game with Bob to move
      When Bob's phone loses the connection
      Then Bob keeps the custom game turn
      And Carol cannot make a custom game move before Bob

  Rule: Every person must agree to a draw

    Scenario: The last agreement draws a four-player custom game
      Given Alice, Bob, Carol and Dave have a four-player custom game under way
      And Alice has offered a draw accepted by Bob and Carol
      When Dave accepts the draw
      Then the custom game is finished as a draw

    Scenario: A partial agreement keeps the four-player custom game under way
      Given Alice, Bob, Carol and Dave have a four-player custom game under way
      And Alice has offered a draw accepted by Bob
      When Carol accepts the draw
      Then the custom game is still under way awaiting Dave's agreement

  Rule: A withdrawal or expired clock in a game with more than two sides finishes it as a draw
    No counter-example: a completed result is never replaced, as every game's finished-game rules require.

    Scenario: A resignation awards no arbitrary survivor a victory
      Given Alice, Bob, Carol and Dave have a four-player custom game under way
      When Carol resigns the custom game
      Then the custom game is finished as a draw because a participant withdrew

    Scenario: An expired clock awards no arbitrary survivor a victory
      Given Alice, Bob, Carol and Dave have a four-player custom game played at 1+0 with Carol to move
      When 60 seconds pass
      Then the custom game is finished as a draw because a participant ran out of time
