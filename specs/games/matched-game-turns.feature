@domain:games
Feature: Play a matched game together
  When two people have been paired, they want an honest matched game, so only
  the person whose turn it is can move and both people keep the same moves
  and result.

  Rule: Only a move the game allows, by the person whose turn it is, changes the board

    Background:
      Given Alice has the first side against Bob in a new matched game

    Scenario: The first side's first move passes the turn to the second side
      When Alice makes her first move
      Then both people see Alice's first move on the board
      And it is Bob's turn

    Scenario: The second side cannot make the first move
      When Bob makes his first move
      Then Bob is told it is the other player's turn
      And the board and turn are unchanged

    Scenario: A move the game refuses keeps the turn and board
      When Alice makes a move the game refuses
      Then Alice is told that move is not allowed
      And the board and turn are unchanged

  Rule: The same move made twice, or a move made on another device's earlier board, never moves the board twice

    Background:
      Given Alice has made her first move in a new matched game against Bob

    Scenario: The same move made again on another device counts once
      When Alice makes her first move again on her other device
      Then both people see the one move played
      And it is Bob's turn

    Scenario: A different move on another device still showing an earlier board is refused
      Given Bob has made his first move
      When Alice makes a different first move on her other device still showing the starting board
      Then Alice is told her board has changed
      And both people still see the two moves played

  Rule: Once both people have made their first move, either person may resign an unfinished matched game

    Scenario: A person resigns outside their turn
      Given Alice has the first side against Bob in a 5+0 matched game after their first moves
      When Bob resigns the matched game
      Then both people see Alice won the matched game

    Scenario: Resigning again keeps the result
      Given Bob has resigned the matched game after their first moves
      When Bob resigns the matched game
      Then both people still see Alice won the matched game

  Rule: Both people see every move made, kept with the result

    Scenario: The second side's first move joins both people's moves
      Given Alice has made her first move in a new matched game against Bob
      When Bob makes his first move
      Then both people see the two moves played

    Scenario: A refused move never joins the moves
      Given Alice has made her first move in a new matched game against Bob
      When Bob makes a move the game refuses
      Then Bob is told that move is not allowed
      And both people see the one move played

    Scenario: The moves are kept with the result
      Given Bob has resigned the matched game after their first moves
      When Alice opens finding an opponent on another device
      Then both people see Alice won the matched game
      And Alice sees the two moves played
