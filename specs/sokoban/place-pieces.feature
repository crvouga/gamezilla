@domain:sokoban
Feature: Place the worker and crates on Sokoban boards
  When Alice sets out a Sokoban board, she wants the worker and crates to go only where they can stand, so every board she builds can be played by the same rules.

  Rule: A board has one worker, so placing it again takes it from its earlier square
    No counter-example: a board never has a second worker; where the worker may stand is the last rule's.

    Background:
      Given Alice is building a Sokoban board laid out as:
        |   | A     | B      | C     | D    |
        | 1 | floor | worker | crate | goal |

    Scenario: Placing the worker again takes it from its earlier square
      When Alice places the worker on "A1"
      Then Alice's board is laid out as:
        |   | A      | B     | C     | D    |
        | 1 | worker | floor | crate | goal |

    Scenario: The worker can be placed on a goal
      When Alice places the worker on "D1"
      Then Alice's board is laid out as:
        |   | A     | B     | C     | D              |
        | 1 | floor | floor | crate | worker on goal |

  Rule: Crates are placed on empty squares and removed from where they stand

    Background:
      Given Alice is building a Sokoban board laid out as:
        |   | A     | B      | C     | D    |
        | 1 | floor | worker | crate | goal |

    Scenario: A crate can be placed on floor
      When Alice places a crate on "A1"
      Then Alice's board is laid out as:
        |   | A     | B      | C     | D    |
        | 1 | crate | worker | crate | goal |

    Scenario: Removing a crate turns its square to floor
      When Alice removes the crate on "C1"
      Then Alice's board is laid out as:
        |   | A     | B      | C     | D    |
        | 1 | floor | worker | floor | goal |

    Scenario: There is no crate to remove from an empty square
      When Alice removes the crate on "A1"
      Then Alice is told there is no crate on that square
      And Alice's board is unchanged

  Rule: The worker and crates stand only on floor or goals, one piece to a square

    Background:
      Given Alice is building a Sokoban board laid out as:
        |   | A       | B    | C      | D     | E    |
        | 1 | outside | wall | worker | crate | goal |

    Scenario: A crate can be placed on a goal
      When Alice places a crate on "E1"
      Then Alice's board is laid out as:
        |   | A       | B    | C      | D     | E             |
        | 1 | outside | wall | worker | crate | crate on goal |

    Scenario: The worker cannot be placed on a wall
      When Alice places the worker on "B1"
      Then Alice is told the worker and crates stand only on floor or goals
      And Alice's board is unchanged

    Scenario: A crate cannot be placed on an outside square
      When Alice places a crate on "A1"
      Then Alice is told the worker and crates stand only on floor or goals
      And Alice's board is unchanged

    Scenario: A crate cannot be placed where the worker stands
      When Alice places a crate on "C1"
      Then Alice is told that square already has a piece
      And Alice's board is unchanged

    Scenario: The worker cannot be placed where a crate stands
      When Alice places the worker on "D1"
      Then Alice is told that square already has a piece
      And Alice's board is unchanged
