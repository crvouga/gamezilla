@domain:games
Feature: Turns in every game
  When Alice plays a game with Bob, she wants each move to follow its turn the same way in every game, so the game stays fair and the same for both of them.

  Rule: Only a move the game allows, by the participant whose turn it is, changes the board

    Scenario: The next participant continues the game session
      Given Alice and Bob have a game session after Alice's first move
      When Bob makes his move
      Then it is Alice's turn

    Scenario: A participant cannot take the opponent's turn
      Given Alice and Bob have a new game session
      When Bob makes a move
      Then Bob is told it is the other player's turn
      And the board and turn are unchanged

    Scenario: A move the game refuses leaves the board and turn unchanged
      Given Alice and Bob have a new game session
      When Alice makes a move the game refuses
      Then Alice is told that move is not allowed
      And the board and turn are unchanged

  Rule: A game session takes moves only while it is under way

    Scenario: A participant's move passes the turn and joins the move list
      Given Alice and Bob have a new game session
      When Alice makes her move
      Then it is Bob's turn
      And the move list shows Alice's move

    Scenario: No move is made before the game session starts
      Given Alice is setting up a game session with Bob on the second side
      When Alice makes a move
      Then Alice is told the game session has not started

    Scenario: A cancelled game session refuses another move
      Given Alice has a cancelled game session
      When Alice makes a move
      Then Alice is told the game session was cancelled

  Rule: A move with another person needs the connection

    Scenario: A connected move reaches the opponent
      Given Alice and Bob have a new game session
      When Alice makes her move
      Then Bob sees Alice's move within 15 seconds

    Scenario: A missing connection keeps the move from being made
      Given Alice and Bob have a new game session without a connection
      When Alice makes her move
      Then Alice is told the game needs a connection
      And the board and turn are unchanged

  Rule: A finished game session takes no more moves

    Scenario: The winning move finishes the game session
      Given Alice has a game session one move from her victory
      When Alice makes the winning move
      Then Alice wins the game session

    Scenario: A finished game session refuses another move
      Given Alice has a finished game session
      When Alice makes a move
      Then Alice is told the game is finished
      And the board and turn are unchanged

  Rule: Bots play only their own turn and stop when the game session ends

    Scenario: A bot answers a person's move
      Given Alice has a game session under way against a bot
      When Alice makes her move
      Then the bot replies with a legal move within 5 seconds
      And it is Alice's turn

    Scenario: A bot cannot continue a cancelled game session
      Given Alice has a game session under way against a bot
      And Alice has cancelled the game session under way
      When 5 seconds pass
      Then the move list is unchanged
      And the game session is cancelled with no result
