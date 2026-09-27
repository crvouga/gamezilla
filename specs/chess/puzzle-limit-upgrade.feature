@domain:chess @goal:guest-free-and-paid:6
Feature: The daily puzzle limit is an invitation
  Hitting a limit is a clear invitation to upgrade, never an error. Twenty
  puzzles completed earlier do not interrupt the puzzle already on the board.

  Scenario: A guest with twenty completed puzzles keeps the puzzle on the board
    Given Alice is a guest
    And Alice is playing puzzles in their space
    When twenty earlier completed puzzles are added to Alice's history
    Then Alice's history shows 20 completed puzzles
    And Alice is not shown the puzzle limit
