@domain:games
Feature: Abort or resign a matched game without turns
  When a matched game plays without turns, its people want to stop playing fairly, so stopping before it is under way has no result and giving up afterwards gives the opponent the victory.

  Background:
    Given the game plays without turns

  Rule: Either person may abort before the matched game is under way, and neither may abort afterwards

    Scenario Outline: Either side can abort before play begins without turns
      Given Alice has the first side against Bob in a new matched game
      When <person> aborts the matched game
      Then both people see the matched game was aborted

      Examples:
        | person |
        | Alice  |
        | Bob    |

    Scenario: Beginning play without turns offers resignation in place of aborting
      Given Alice has the first side against Bob in a new matched game
      When the matched game gets under way
      Then both people are offered resigning the matched game
      And neither person is offered aborting the matched game because it is under way

    Scenario Outline: Aborting after play begins without turns is refused
      Given Alice has the first side against Bob in a matched game under way without turns
      When <person> aborts the matched game
      Then <person> is told the matched game can no longer be aborted
      And the matched game is still unfinished

      Examples:
        | person |
        | Alice  |
        | Bob    |

  Rule: Either person may resign once the matched game is under way, and before that they are told to abort instead

    Scenario Outline: Either side can resign after play begins without turns
      Given Alice has the first side against Bob in a matched game under way without turns
      When <person> resigns the matched game
      Then both people see <winner> won the matched game

      Examples:
        | person | winner |
        | Alice  | Bob    |
        | Bob    | Alice  |

    Scenario Outline: Resigning before play begins without turns is refused
      Given Alice has the first side against Bob in a new matched game
      When <person> resigns the matched game
      Then <person> is told to abort the matched game instead
      And the matched game is still unfinished

      Examples:
        | person |
        | Alice  |
        | Bob    |

  Rule: A matched game that is over keeps its result and offers neither aborting nor resigning

    Scenario Outline: Aborting an aborted game without turns again changes nothing
      Given Alice's matched game with Bob was aborted before it was under way
      When <person> aborts the matched game
      Then both people see the matched game was aborted

      Examples:
        | person |
        | Alice  |
        | Bob    |

    Scenario Outline: An aborted game without turns cannot be resigned
      Given Alice's matched game with Bob was aborted before it was under way
      When <person> resigns the matched game
      Then <person> is told the matched game is over
      And both people see the matched game was aborted

      Examples:
        | person |
        | Alice  |
        | Bob    |

    Scenario Outline: Aborting a won game without turns keeps the winner
      Given Alice's matched game with Bob was won by <winner> after <opponent> resigned
      When <person> aborts the matched game
      Then <person> is told the matched game is over
      And both people still see <winner> won the matched game

      Examples:
        | winner | opponent | person |
        | Alice  | Bob      | Alice  |
        | Alice  | Bob      | Bob    |
        | Bob    | Alice    | Alice  |
        | Bob    | Alice    | Bob    |

    Scenario Outline: Resigning a won game without turns again keeps the winner
      Given Alice's matched game with Bob was won by <winner> after <opponent> resigned
      When <person> resigns the matched game
      Then both people still see <winner> won the matched game

      Examples:
        | winner | opponent | person |
        | Alice  | Bob      | Alice  |
        | Alice  | Bob      | Bob    |
        | Bob    | Alice    | Alice  |
        | Bob    | Alice    | Bob    |

    Scenario Outline: A game without turns that is over offers no further ending choice
      Given Alice's matched game with Bob was <ending>
      When <person> opens finding an opponent
      Then <person> cannot resign, abort or offer a draw

      Examples:
        | ending                              | person |
        | aborted before it was under way     | Alice  |
        | aborted before it was under way     | Bob    |
        | won by Alice after Bob resigned     | Alice  |
        | won by Alice after Bob resigned     | Bob    |
        | won by Bob after Alice resigned     | Alice  |
        | won by Bob after Alice resigned     | Bob    |

  Rule: An offline person keeps the last known matched game and cannot end it until the connection returns

    Scenario: Losing a connection leaves the game without turns unfinished
      Given Alice has the first side against Bob in a matched game under way without turns
      When Alice loses the connection
      Then the matched game is still unfinished
      And Bob keeps his matched game with Alice

    Scenario Outline: An offline person cannot abort before play begins without turns
      Given Alice has the first side against Bob in a new matched game
      And <person>'s phone is offline
      When <person> aborts the matched game
      Then <person> is told the game needs a connection
      And the matched game is still unfinished

      Examples:
        | person |
        | Alice  |
        | Bob    |

    Scenario Outline: An offline person cannot resign a game under way without turns
      Given Alice has the first side against Bob in a matched game under way without turns
      And <person>'s phone is offline
      When <person> resigns the matched game
      Then <person> is told the game needs a connection
      And the matched game is still unfinished

      Examples:
        | person |
        | Alice  |
        | Bob    |

    Scenario Outline: Returning to a game without turns shows the opponent's accepted resignation
      Given <person>'s phone was offline when <opponent> resigned the matched game after it was under way
      When the connection comes back
      Then both people see <person> won the matched game

      Examples:
        | person | opponent |
        | Alice  | Bob      |
        | Bob    | Alice    |

    Scenario Outline: An offline person keeps the unfinished game after the opponent resigns without turns
      Given <person>'s phone was offline when <opponent> resigned the matched game after it was under way
      When <person> opens finding an opponent
      Then <person> still sees the last known unfinished matched game

      Examples:
        | person | opponent |
        | Alice  | Bob      |
        | Bob    | Alice    |
