@domain:games
Feature: Keep a matched game after time away
  When a person goes away from their matched game, they want to find the accepted board and result on return, so the matched game lasts within spaces.

  Rule: An offline device keeps its last known board and the matched game unfinished

    Scenario: An offline person cannot keep a move for later
      Given Alice has the first side against Bob in a new matched game
      And Alice's phone is offline
      When Alice makes her first move
      Then Alice is told the game needs a connection
      And Alice's phone keeps its last known board

    Scenario: Returning after the opponent's move shows the accepted board
      Given Alice has made her first move in a new matched game against Bob
      And Alice's phone was offline when Bob's first move was accepted
      When the connection comes back
      Then both people see the two moves played
      And it is Alice's turn

    Scenario: Returning after the opponent resigns shows the accepted result
      Given Alice's phone was offline when Bob resigned the matched game after their first moves
      When the connection comes back
      Then Alice sees she won the matched game

    Scenario: Losing the connection does not give up the matched game
      Given Alice has an unfinished matched game with Bob
      When Alice loses the connection
      Then the matched game is still unfinished
      And Bob keeps his matched game with Alice

  Rule: Only the matched people can open their matched game's board or move in it

    Scenario: A matched person opens their board
      Given Alice has an unfinished matched game with Bob
      When Alice opens finding an opponent
      Then Alice sees her board and Bob as her opponent

    Scenario: Another person cannot move in the matched game
      Given Alice has an unfinished matched game with Bob
      When Carol makes a move in Alice's matched game
      Then Carol is told no matched game is available to her
      And Alice and Bob keep the same matched game and board
