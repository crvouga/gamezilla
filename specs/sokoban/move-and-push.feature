@domain:sokoban
Feature: Move the worker and push crates
  When Bob plays a Sokoban puzzle, he wants every move to follow the same plain rules, so he can plan his pushes and trust the moves and pushes he sees.

  Rule: The worker steps one square up, down, left or right onto an empty floor or goal square

    Background:
      Given Bob is playing a Sokoban puzzle laid out as:
        |   | A       | B     | C     | D    |
        | 1 | outside | wall  | wall  | wall |
        | 2 | worker  | floor | crate | goal |
        | 3 | wall    | wall  | wall  | wall |

    Scenario: The worker steps onto an empty floor square
      When Bob moves the worker right
      Then the worker stands on "B2"
      And Bob sees 1 move and 0 pushes

    Scenario: A wall blocks the worker
      When Bob moves the worker down
      Then Bob is told the worker's way is blocked
      And the worker still stands on "A2"
      And Bob still sees 0 moves and 0 pushes

    Scenario: An outside square blocks the worker
      When Bob moves the worker up
      Then Bob is told the worker's way is blocked
      And the worker still stands on "A2"

    Scenario: The board's edge blocks the worker
      When Bob moves the worker left
      Then Bob is told the worker's way is blocked
      And the worker still stands on "A2"

  Rule: A push moves the one crate in front of the worker one square, onto an empty floor or goal square

    Scenario: A push moves the crate and the worker one square
      Given Bob is playing a Sokoban puzzle laid out as:
        |   | A      | B     | C     | D    |
        | 1 | worker | crate | floor | goal |
      When Bob moves the worker right
      Then the worker stands on "B1"
      And a crate stands on "C1"
      And Bob sees 1 move and 1 push

    Scenario: A wall beyond the crate stops the push
      Given Bob is playing a Sokoban puzzle laid out as:
        |   | A    | B    | C      | D     | E    |
        | 1 | wall | goal | worker | crate | wall |
      When Bob moves the worker right
      Then Bob is told that crate cannot move
      And a crate still stands on "D1"
      And Bob still sees 0 moves and 0 pushes

    Scenario: Two crates in a row cannot be pushed together
      Given Bob is playing a Sokoban puzzle laid out as:
        |   | A      | B     | C     | D     | E    | F    |
        | 1 | worker | crate | crate | floor | goal | goal |
      When Bob moves the worker right
      Then Bob is told that crate cannot move
      And a crate still stands on "C1"
      And the worker still stands on "A1"

    Scenario: Stepping away from a crate never pulls it
      Given Bob is playing a Sokoban puzzle laid out as:
        |   | A    | B     | C      | D     |
        | 1 | goal | floor | worker | crate |
      When Bob moves the worker left
      Then the worker stands on "B1"
      And a crate stands on "D1"
      And Bob sees 1 move and 0 pushes

  Rule: Every move counts one move, and a move that pushes a crate also counts one push

    Scenario: Steps and pushes are counted separately
      Given Bob is playing a Sokoban puzzle laid out as:
        |   | A      | B     | C     | D     | E    |
        | 1 | worker | floor | crate | floor | goal |
      And Bob has moved the worker "right, right"
      When Bob moves the worker right
      Then Bob sees 3 moves and 2 pushes

    Scenario: A refused push adds neither a move nor a push
      Given Bob is playing a Sokoban puzzle laid out as:
        |   | A    | B      | C     | D     | E    |
        | 1 | goal | worker | floor | crate | wall |
      And Bob has moved the worker "right"
      When Bob moves the worker right
      Then Bob is told that crate cannot move
      And Bob still sees 1 move and 0 pushes
