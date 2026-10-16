@domain:games
Feature: Turns in every game
  When Alice plays a game with Bob, she wants each move to follow its turn the same way in every game, so the game stays fair and the same for both of them.

  Rule: Only the participant whose turn it is may move

    Scenario: The next participant continues the custom game
      Given Alice and Bob have a custom game after Alice's first move
      When Bob makes his move
      Then it is Alice's turn

    Scenario: A participant cannot take the opponent's turn
      Given Alice and Bob have a new custom game
      When Bob makes a move
      Then Bob is told it is the other player's turn
      And the board and turn are unchanged

  Rule: A move with another person needs the connection

    Scenario: A connected move reaches the opponent
      Given Alice and Bob have a new custom game
      When Alice makes her move
      Then Bob sees Alice's move within 15 seconds

    Scenario: A missing connection keeps the move from being made
      Given Alice and Bob have a new custom game without a connection
      When Alice makes her move
      Then Alice is told the game needs a connection
      And the board and turn are unchanged

  Rule: A finished custom game takes no more moves

    Scenario: The winning move finishes the custom game
      Given Alice has a custom game one move from her victory
      When Alice makes the winning move
      Then Alice wins the custom game

    Scenario: A finished custom game refuses another move
      Given Alice has a finished custom game
      When Alice makes a move
      Then Alice is told the game is finished
      And the board and turn are unchanged
