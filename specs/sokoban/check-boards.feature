@domain:sokoban
Feature: Check, keep and preview Sokoban boards
  When Alice is partway through building a board, she wants to see what still needs fixing and to keep her work in progress, so she can come back to it and playtest only a board that can be played.

  Rule: The builder lists what must be corrected: a missing worker, no crates, or different numbers of crates and goals

    Scenario: A board has nothing to correct once its missing worker is placed
      Given Alice is building a Sokoban board laid out as:
        |   | A     | B     | C    |
        | 1 | floor | crate | goal |
      When Alice places the worker on "A1"
      Then Alice's board has nothing to correct

    Scenario: A board without a worker needs one
      Given Alice is building a Sokoban board laid out as:
        |   | A      | B     | C    |
        | 1 | worker | crate | goal |
      When Alice erases "A1"
      Then Alice is told the board needs a worker

    Scenario: A board without crates needs one and as many crates as goals
      Given Alice is building a Sokoban board laid out as:
        |   | A      | B             |
        | 1 | worker | crate on goal |
      When Alice removes the crate on "B1"
      Then Alice is told the board needs at least one crate
      And Alice is told the board needs as many crates as goals

    Scenario: An extra crate needs another goal
      Given Alice is building a Sokoban board laid out as:
        |   | A      | B     | C    | D     |
        | 1 | worker | crate | goal | floor |
      When Alice places a crate on "D1"
      Then Alice is told the board needs as many crates as goals

  Rule: A board with something to correct is kept as a draft and reopens as it was, with no undo or redo choices
    No counter-example: work in progress is always worth keeping; it is checked, never refused.

    Scenario: A board still needing a worker reopens with what it needs
      Given Alice owns the Sokoban draft "Corner" laid out as:
        |   | A     | B     | C    |
        | 1 | floor | crate | goal |
      When Alice reopens the app
      Then Alice's board is laid out as:
        |   | A     | B     | C    |
        | 1 | floor | crate | goal |
      And Alice is told the board needs a worker

    Scenario: Reopening keeps a board edit with no undo or redo choices
      Given Alice is building a Sokoban board laid out as:
        |   | A      | B     | C    | D     |
        | 1 | worker | crate | goal | floor |
      And Alice has painted "D1" as a wall
      When Alice reopens the app
      Then Alice's board is laid out as:
        |   | A      | B     | C    | D    |
        | 1 | worker | crate | goal | wall |
      And Alice is not offered undo or redo for her draft

  Rule: Only a board with nothing to correct can be playtested

    Scenario: A board with nothing to correct can be playtested
      Given Alice owns the Sokoban draft "Corner" laid out as:
        |   | A      | B     | C    |
        | 1 | worker | crate | goal |
      When Alice playtests her puzzle draft
      Then Alice can play the private draft "Corner"

    Scenario: A board without a worker cannot be playtested
      Given Alice owns the Sokoban draft "Corner" laid out as:
        |   | A     | B     | C    |
        | 1 | floor | crate | goal |
      When Alice playtests her puzzle draft
      Then Alice is told the board needs a worker
      And Alice cannot play the private draft "Corner"

  Rule: Board edits can be undone and redone until a new board edit replaces the redo choice

    Background:
      Given Alice is building a Sokoban board laid out as:
        |   | A    | B      | C     | D     | E    |
        | 1 | wall | worker | crate | floor | goal |

    Scenario: A painted wall can be undone
      Given Alice has painted "D1" as a wall
      When Alice undoes her last draft edit
      Then Alice's board is laid out as:
        |   | A    | B      | C     | D     | E    |
        | 1 | wall | worker | crate | floor | goal |
      And Alice is offered redo but no undo for her draft

    Scenario: An undone wall comes back with redo
      Given Alice has undone painting "D1" as a wall
      When Alice redoes her last draft edit
      Then Alice's board is laid out as:
        |   | A    | B      | C     | D    | E    |
        | 1 | wall | worker | crate | wall | goal |
      And Alice is offered undo but no redo for her draft

    Scenario: A new board edit replaces the redo choice
      Given Alice has undone painting "D1" as a wall
      When Alice places a crate on "D1"
      Then Alice cannot redo the replaced draft edit
      And Alice is offered undo but no redo for her draft

    Scenario: Painting a square as it already is adds nothing to undo
      When Alice paints "A1" as a wall
      Then Alice is not offered undo or redo for her draft

  Rule: The preview shows the board as built
    No counter-example: the preview always follows the board, and a refused board edit changes neither.

    Scenario: The preview shows a newly placed crate
      Given Alice is building a Sokoban board laid out as:
        |   | A      | B     | C    | D     |
        | 1 | worker | crate | goal | floor |
      When Alice places a crate on "D1"
      Then the preview of Alice's board is laid out as:
        |   | A      | B     | C    | D     |
        | 1 | worker | crate | goal | crate |
