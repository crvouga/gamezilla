@domain:games
Feature: The clock in a matched game
  When two people play a matched game at a clock choice, they want each side's time kept fairly and shown to both of them, so a matched game ends when someone runs out of time.

  Rule: Outside a daily game, each side starts with the clock choice's minutes, and neither clock runs until both people have made their first move

    Scenario: Waiting for the first side's first move costs nobody any time
      Given Alice has the first side against Bob in a new 1+0 matched game
      When 20 seconds pass
      Then both people see 60 seconds on the first side's clock and 60 seconds on the second side's

    Scenario: The first side's clock runs once both people have moved
      Given Alice has the first side against Bob in a 1+0 matched game after their first moves
      When 20 seconds pass
      Then both people see 40 seconds on the first side's clock and 60 seconds on the second side's

  Rule: Only the side to move spends time, and a move the game allows adds the clock choice's seconds to the person who made it

    Background:
      Given Alice has the first side against Bob in a 2+1 matched game after their first moves

    Scenario: The first side's move adds its seconds to the first side's clock
      Given 5 seconds have passed
      When Alice makes her move
      Then both people see 116 seconds on the first side's clock and 120 seconds on the second side's

    Scenario: A move out of turn adds no seconds
      When Bob makes his move
      Then Bob is told it is the other player's turn
      And both people see 120 seconds on the first side's clock and 120 seconds on the second side's

  Rule: Running out of time loses, even if a move arrives at that moment

    Background:
      Given Alice has the first side against Bob in a 1+0 matched game after their first moves

    Scenario: The first side runs out of time and loses the matched game
      When 60 seconds pass
      Then both people see Bob won the matched game on time

    Scenario: A move at the moment the first side runs out of time is refused
      Given the first side has run out of time
      When Alice makes her move
      Then Alice is told the matched game is over
      And both people see Bob won the matched game on time

  Rule: A person without a connection still spends their time on their turn

    Background:
      Given Alice has the first side against Bob in a 1+0 matched game after their first moves
      And Alice is offline

    Scenario: Being offline on one's turn can still run out of time
      When 60 seconds pass
      Then Bob sees he won the matched game on time

    Scenario: Being offline with time left does not end the matched game
      When 20 seconds pass
      Then the matched game is still unfinished
