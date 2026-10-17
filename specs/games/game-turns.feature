@domain:games
Feature: Turns in every game
  When Alice plays a game with Bob, she wants each move to follow its turn the same way in every game, so the game stays fair and the same for both of them.

  Rule: Only a move the game allows, by the participant whose turn it is, changes the board

    Scenario: The next participant continues the custom game
      Given Alice and Bob have a custom game after Alice's first move
      When Bob makes his move
      Then it is Alice's turn

    Scenario: A participant cannot take the opponent's turn
      Given Alice and Bob have a new custom game
      When Bob makes a move
      Then Bob is told it is the other player's turn
      And the board and turn are unchanged

    Scenario: A move the game refuses leaves the board and turn unchanged
      Given Alice and Bob have a new custom game
      When Alice makes a move the game refuses
      Then Alice is told that move is not allowed
      And the board and turn are unchanged

  Rule: A custom game takes moves only while it is under way

    Scenario: A participant's move passes the turn and joins the move list
      Given Alice and Bob have a new custom game
      When Alice makes her move
      Then it is Bob's turn
      And the move list shows Alice's move

    Scenario: No move is made before the custom game starts
      Given Alice is setting up a custom game with Bob on the second side
      When Alice makes a move
      Then Alice is told the custom game has not started

    Scenario: A cancelled custom game refuses another move
      Given Alice has a cancelled custom game
      When Alice makes a move
      Then Alice is told the custom game was cancelled

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

  Rule: Bots play only their own turn and stop when the custom game ends

    Scenario: A bot answers a person's move
      Given Alice has a custom game under way against a bot
      When Alice makes her move
      Then the bot replies with a legal move within 5 seconds
      And it is Alice's turn

    Scenario: A bot cannot continue a cancelled custom game
      Given Alice has a custom game under way against a bot
      And Alice has cancelled the custom game under way
      When 5 seconds pass
      Then the move list is unchanged
      And the custom game is cancelled with no result
