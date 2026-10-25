@domain:sokoban
Feature: Undo and redo Sokoban moves
  When Bob makes a move he regrets, he wants to step back and forward through his moves, so trying an idea never costs him the position or the counts he had.

  Background:
    Given Bob is playing a Sokoban puzzle laid out as:
      |   | A      | B     | C     | D     | E    |
      | 1 | worker | floor | crate | floor | goal |

  Rule: Undo returns to the position before the last move, with that position's moves and pushes

    Scenario: Undoing a push puts the crate back
      Given Bob has moved the worker "right, right"
      When Bob undoes his last move
      Then a crate stands on "C1"
      And Bob sees 1 move and 0 pushes

    Scenario: A puzzle not yet moved has no earlier position to undo
      When Bob undoes his last move
      Then Bob is told there is no earlier puzzle position
      And Bob still sees 0 moves and 0 pushes

  Rule: Redo makes an undone move again, with its moves and pushes, until a new move replaces it

    Scenario: Redoing an undone push pushes the crate again
      Given Bob has moved the worker "right, right" and undone his last move
      When Bob redoes his last move
      Then a crate stands on "D1"
      And Bob sees 2 moves and 1 push

    Scenario: A new move after undo removes the redo choice
      Given Bob has moved the worker "right, right", undone his last move and then moved the worker "left"
      When Bob redoes his last move
      Then Bob is told there is no later puzzle position
      And Bob still sees 2 moves and 0 pushes
