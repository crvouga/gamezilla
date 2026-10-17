@domain:games
Feature: A matched game that is over stays that way
  When a matched game is over, both people want it kept exactly as it stands,
  so only a rematch or a new opponent can follow it.

  Rule: A matched game that is over takes no more moves

    Scenario: A matched game drawn by agreement keeps its board and moves on another device
      Given Alice's 5+0 matched game with Bob was drawn by agreement after their first moves
      When Alice opens finding an opponent on another device
      Then Alice sees the matched game is drawn by agreement
      And Alice sees the two moves played

    Scenario: A matched game drawn by agreement takes no more moves
      Given Alice's 5+0 matched game with Bob was drawn by agreement after their first moves
      When Alice makes a move
      Then Alice is told the matched game is over
      And both people see the two moves played

    Scenario: A resigned matched game takes no more moves
      Given Bob has resigned the matched game after their first moves
      When Alice makes a move
      Then Alice is told the matched game is over
      And both people see the two moves played

    Scenario: An aborted matched game takes no more moves
      Given Alice's 5+0 matched game with Bob was aborted
      When Alice makes her first move
      Then Alice is told the matched game is over
      And both people see the matched game was aborted

  Rule: Once a matched game is over, its people cannot resign, abort or offer a draw, but can find a new opponent

    Scenario: A person can find a new opponent after a draw by agreement
      Given Alice's 5+0 matched game with Bob was drawn by agreement after their first moves
      When Alice finds a new opponent
      Then Alice is waiting for an opponent at 5+0

    Scenario: A won matched game offers no resigning, aborting or draw offer
      Given Bob has resigned the matched game after their first moves
      When Alice opens finding an opponent
      Then Alice cannot resign, abort or offer a draw

    Scenario: A matched game drawn by agreement offers no resigning, aborting or draw offer
      Given Alice's 5+0 matched game with Bob was drawn by agreement after their first moves
      When Alice opens finding an opponent
      Then Alice cannot resign, abort or offer a draw

    Scenario: An aborted matched game offers no resigning, aborting or draw offer
      Given Alice's 5+0 matched game with Bob was aborted
      When Alice opens finding an opponent
      Then Alice cannot resign, abort or offer a draw

    Scenario: A person who has never had a matched game has nothing to act on
      Given Alice has a free account and has never had a matched game
      When Alice opens finding an opponent
      Then Alice cannot resign, abort or offer a draw
      And Alice cannot find a new opponent or offer a rematch
