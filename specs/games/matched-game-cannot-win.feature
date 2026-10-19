@domain:games
Feature: A victory on time in a matched game needs a side that can still win
  When a person runs out of time in a matched game, both people want the result to follow what the board still allows, so a side that cannot win is never given a victory on time.

  Rule: Running out of time is a draw when the other side cannot win
    No counter-example: the board decides the result, and nobody can choose a victory it cannot give.

    Scenario: Running out of time against a side that cannot win is a draw
      Given Alice has the first side against Bob in a 1+0 matched game where the second side cannot win
      And the first side has one second left
      When 1 second passes
      Then both people see the matched game is drawn because the first side ran out of time

    Scenario: Running out of time in a daily game against a side that cannot win is a draw
      Given Alice has the first side against Bob in a daily game at 1 day per move where the second side cannot win
      And the first side has one day left
      When 1 day passes
      Then both people see the matched game is drawn because the first side ran out of time

    Scenario: The side that can win still wins on time
      Given Alice has the first side against Bob in a 1+0 matched game where the second side cannot win
      And the second side has one second left
      When 1 second passes
      Then both people see Alice won the matched game on time
