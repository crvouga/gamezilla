@domain:games
Feature: A matched game won by the game's own rules
  When the game's own rules decide a matched game, both people want the same result at once, so the matched game is over for both of them.

  Rule: The winning move gives both people the same victory at once, and nothing follows it

    Scenario: The winning move gives both people the same victory
      Given Alice has the first side against Bob in a matched game one move from her victory
      When Alice makes the winning move
      Then both people see Alice won the matched game

    Scenario: No move follows the winning move
      Given Alice has won the matched game with the winning move
      When Bob makes his move
      Then Bob is told the matched game is over
      And both people still see Alice won the matched game
