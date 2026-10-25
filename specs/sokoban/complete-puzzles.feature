@domain:sokoban
Feature: Complete and restart Sokoban puzzles
  When Bob pushes crates onto goals, he wants the puzzle complete exactly when every crate stands on a goal, so finishing is clear, counted once and never lost by starting over.

  Rule: A Sokoban puzzle is complete when every crate stands on a goal
    No counter-example: completion is not something a person asks for; the unfinished example shows where it stops.

    Scenario: Pushing the last crate onto a goal completes the puzzle
      Given Bob is playing a Sokoban puzzle laid out as:
        |   | A      | B     | C    | D             |
        | 1 | worker | crate | goal | crate on goal |
      When Bob moves the worker right
      Then the Sokoban puzzle is complete
      And Bob sees 1 move and 1 push

    Scenario: A crate away from a goal keeps the puzzle unfinished
      Given Bob is playing a Sokoban puzzle laid out as:
        |   | A      | B     | C    | D     | E     | F    |
        | 1 | worker | crate | goal | floor | crate | goal |
      When Bob moves the worker right
      Then the Sokoban puzzle is unfinished
      And a crate stands on "C1"

  Rule: A puzzle whose crates all start on goals is complete at once with no moves
    No counter-example: opening a puzzle is never refused; the unfinished example shows where completion stops.

    Scenario: A puzzle whose crates start on goals is complete when opened
      When Bob opens a Sokoban puzzle laid out as:
        |   | A      | B             | C             |
        | 1 | worker | crate on goal | crate on goal |
      Then the Sokoban puzzle is complete
      And Bob sees 0 moves and 0 pushes

    Scenario: One crate starting away from a goal keeps the opened puzzle unfinished
      When Bob opens a Sokoban puzzle laid out as:
        |   | A      | B             | C     | D    |
        | 1 | worker | crate on goal | crate | goal |
      Then the Sokoban puzzle is unfinished
      And Bob sees 0 moves and 0 pushes

  Rule: A puzzle counts as completed only once, however often its crates reach the goals
    No counter-example: completing a puzzle again is never refused; it simply counts once.

    Scenario: Redoing the completing push keeps one completion
      Given Bob is playing "Home" in the published pack "Warehouse" containing "Home, Corner", laid out as:
        |   | A     | B      | C     | D    |
        | 1 | floor | worker | crate | goal |
      And Bob has moved the worker "right" and undone his last move
      When Bob redoes his last move
      Then the Sokoban puzzle is complete
      And Bob sees one completed puzzle out of two in "Warehouse"

    Scenario: Undoing the completing push keeps the completion
      Given Bob is playing "Home" in the published pack "Warehouse" containing "Home, Corner", laid out as:
        |   | A     | B      | C     | D    |
        | 1 | floor | worker | crate | goal |
      And Bob has moved the worker "right"
      When Bob undoes his last move
      Then the Sokoban puzzle is unfinished
      And "Home" remains completed in Bob's progress

  Rule: Restarting returns to the starting position with no moves or pushes and keeps an earlier completion

    Scenario: Restarting returns the worker and crates to where they started
      Given Bob is playing a Sokoban puzzle laid out as:
        |   | A      | B     | C     | D     | E    |
        | 1 | worker | floor | crate | floor | goal |
      And Bob has moved the worker "right, right"
      When Bob restarts the Sokoban puzzle
      Then Bob sees the puzzle's starting position with 0 moves and 0 pushes

    Scenario: Restarting a completed puzzle keeps its completion
      Given Bob is playing "Home" in the published pack "Warehouse" containing "Home, Corner", laid out as:
        |   | A     | B      | C     | D    |
        | 1 | floor | worker | crate | goal |
      And Bob has moved the worker "right"
      When Bob restarts the Sokoban puzzle
      Then Bob sees the puzzle's starting position with 0 moves and 0 pushes
      And "Home" remains completed in Bob's progress

    Scenario: Restarting a puzzle not yet moved changes nothing
      Given Bob is playing a Sokoban puzzle laid out as:
        |   | A      | B     | C    |
        | 1 | worker | crate | goal |
      When Bob restarts the Sokoban puzzle
      Then Bob still sees 0 moves and 0 pushes
      And the worker still stands on "A1"
