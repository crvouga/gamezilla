@domain:chess @goal:chess-puzzles:9 @goal:works-offline:4 @goal:always-true:3
Feature: Puzzle outcomes score the same offline
  A clean solve scores 1, a hint or a wrong move scores 0.5, and viewing the
  solution or abandoning scores 0. The score is the same on the device and
  after the offline attempt reaches the server, and it is applied once.

  @regression:puzzle-wrong-move-half-credit
  Scenario Outline: <finish> has the goal's score locally and after reconnect
    Given Alice is signed in
    And Alice is playing puzzles in their space
    When Alice loses the connection
    And Alice finishes the puzzle by "<finish>"
    Then Alice's device holds 1 rated attempt, for that puzzle, <outcome> with a score of <score>
    And the server holds no rated attempts for Alice
    When the connection comes back
    Then the server holds 1 rated attempt for Alice within 30 seconds
    And the server's rated attempts for Alice match the device's
    And the server's puzzle rating for Alice matches the device's
    When Alice loses the connection
    And the connection comes back
    And 2 seconds pass
    Then the server's rated attempts for Alice still match the device's
    And Alice's device still holds only that 1 rated attempt
    And Alice's device still holds the same puzzle rating

    Examples:
      | finish                             | outcome   | score |
      | a clean solve                      | solved    | 1     |
      | a hint, then a solve               | solved    | 0.5   |
      | a wrong move, a retry, then a solve | failed    | 0.5   |
      | showing the solution               | failed    | 0     |
      | a skip                             | abandoned | 0     |
