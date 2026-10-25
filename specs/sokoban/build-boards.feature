@domain:sokoban
Feature: Build Sokoban boards
  When Alice builds a Sokoban puzzle, she wants to shape its board square by square, so the board she publishes is exactly the one she meant.

  Rule: A board has at most 20 columns and 20 rows

    Background:
      Given Alice is building a Sokoban board laid out as:
        |   | A      | B     | C     |
        | 1 | worker | crate | goal  |
        | 2 | floor  | floor | floor |

    Scenario: A board can grow to 20 columns and 20 rows
      When Alice changes the board size to 20 columns and 20 rows
      Then Alice's board has 20 columns and 20 rows

    Scenario: A board cannot have 21 columns
      When Alice changes the board size to 21 columns and 20 rows
      Then Alice is told a board has at most 20 columns and 20 rows
      And Alice's board still has 3 columns and 2 rows

    Scenario: A board cannot have 21 rows
      When Alice changes the board size to 20 columns and 21 rows
      Then Alice is told a board has at most 20 columns and 20 rows
      And Alice's board still has 3 columns and 2 rows

  Rule: A smaller board removes everything beyond its new edge and tells the author which worker, crates and goals it removed

    Background:
      Given Alice is building a Sokoban board laid out as:
        |   | A      | B     | C     | D     |
        | 1 | worker | crate | goal  | crate |
        | 2 | floor  | floor | floor | goal  |
        | 3 | wall   | wall  | wall  | wall  |

    Scenario: A smaller board removes the crate and goal beyond its new edge
      When Alice changes the board size to 3 columns and 3 rows
      Then Alice is told the smaller board removed:
        | crate | D1 |
        | goal  | D2 |
      And Alice's board has 3 columns and 3 rows

    Scenario: A smaller board keeps everything inside its new edge
      When Alice changes the board size to 4 columns and 2 rows
      Then Alice's board is laid out as:
        |   | A      | B     | C     | D     |
        | 1 | worker | crate | goal  | crate |
        | 2 | floor  | floor | floor | goal  |

  Rule: Painting makes a square a wall, floor, a goal or outside, and a wall or outside square removes the piece on it
    No counter-example: painting is never refused; only a wall or an outside square removes what stands on it.

    Background:
      Given Alice is building a Sokoban board laid out as:
        |   | A     | B      | C     | D    |
        | 1 | floor | worker | crate | goal |

    Scenario: A goal painted under a crate keeps the crate on it
      When Alice paints "C1" as a goal
      Then Alice's board is laid out as:
        |   | A     | B      | C             | D    |
        | 1 | floor | worker | crate on goal | goal |

    Scenario: A wall painted under a crate removes the crate
      When Alice paints "C1" as a wall
      Then Alice's board is laid out as:
        |   | A     | B      | C    | D    |
        | 1 | floor | worker | wall | goal |

    Scenario: An outside square painted under the worker removes the worker
      When Alice paints "B1" as outside
      Then Alice's board is laid out as:
        |   | A     | B       | C     | D    |
        | 1 | floor | outside | crate | goal |

    Scenario: Floor painted over a goal makes it plain floor
      When Alice paints "D1" as floor
      Then Alice's board is laid out as:
        |   | A     | B      | C     | D     |
        | 1 | floor | worker | crate | floor |

  Rule: Erasing a square makes it floor and removes any piece or goal on it
    No counter-example: erasing is never refused; every erased square becomes floor.

    Background:
      Given Alice is building a Sokoban board laid out as:
        |   | A     | B      | C             | D    |
        | 1 | floor | worker | crate on goal | wall |

    Scenario: Erasing a crate on a goal makes plain floor
      When Alice erases "C1"
      Then Alice's board is laid out as:
        |   | A     | B      | C     | D    |
        | 1 | floor | worker | floor | wall |

    Scenario: Erasing a wall makes floor
      When Alice erases "D1"
      Then Alice's board is laid out as:
        |   | A     | B      | C             | D     |
        | 1 | floor | worker | crate on goal | floor |
