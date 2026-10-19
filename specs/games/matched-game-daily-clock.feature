@domain:games
Feature: The clock in a daily game
  When two people play a daily game, they want the same days for every move, so nobody has to hurry and no daily game is held up by one person for ever.

  Rule: In a daily game the side to move has the clock choice's days for every move, and a move hands the full days to the other person

    Background:
      Given Alice has the first side against Bob in a daily game at 3 days per move after their first moves

    Scenario: Only the side to move spends its days
      When 1 day passes
      Then both people see 2 days on the first side's clock and 3 days on the second side's

    Scenario: A move hands the full days to the other person and saves up none of the unused time
      Given 1 day has passed
      When Alice makes her move
      Then both people see 3 days on the first side's clock and 3 days on the second side's

    Scenario: A move out of turn hands nobody the full days
      Given 1 day has passed
      When Bob makes his move
      Then Bob is told it is the other player's turn
      And both people see 2 days on the first side's clock and 3 days on the second side's

  Rule: A daily game's clock runs from the start, and missing the first move aborts the daily game

    Scenario: The first side's days run before anybody has moved
      Given Alice has the first side against Bob in a new daily game at 3 days per move
      When 1 day passes
      Then both people see 2 days on the first side's clock and 3 days on the second side's

    Scenario: The first side misses the first move after 1 day at 1 day per move
      Given Alice has the first side against Bob in a new daily game at 1 day per move
      When 1 day passes
      Then both people see the matched game was aborted
      And neither person's daily rating has changed

    Scenario: The first side still has time for the first move after 23 hours at 1 day per move
      Given Alice has the first side against Bob in a new daily game at 1 day per move
      When 23 hours pass
      Then the matched game is still unfinished

    Scenario: The second side misses the first move 3 days after the first side's
      Given Alice made her first move 2 days into her new daily game at 3 days per move with Bob
      When 3 days pass
      Then both people see the matched game was aborted

    Scenario: The second side's days start from the first side's first move
      Given Alice made her first move 2 days into her new daily game at 3 days per move with Bob
      When 2 days pass
      Then the matched game is still unfinished

  Rule: Once both people have moved in a daily game, running out of time loses, even if a move arrives after it

    Background:
      Given Alice has the first side against Bob in a daily game at 1 day per move after their first moves

    Scenario: The first side runs out of time in a daily game and loses
      When 1 day passes
      Then both people see Bob won the matched game on time

    Scenario: The first side still has time an hour before the day is over
      When 23 hours pass
      Then the matched game is still unfinished

    Scenario: A move after the days have run out is refused
      Given 1 day has passed
      When Alice makes her move
      Then Alice is told the matched game is over
      And both people see Bob won the matched game on time
