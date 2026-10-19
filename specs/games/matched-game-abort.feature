@domain:games
Feature: Abort a matched game before it begins
  When a matched game has not really begun, people want to abort it with no
  result, so nobody loses a game that never began.

  Rule: Either person may abort the matched game until both people have made their first move

    Scenario: The second side aborts before either first move
      Given Alice has the first side against Bob in a new matched game
      When Bob aborts the matched game
      Then both people see the matched game was aborted

    Scenario: The first side aborts after her first move but before the second side's
      Given Alice has made her first move in a new matched game against Bob
      When Alice aborts the matched game
      Then both people see the matched game was aborted

    Scenario: Aborting is refused after both first moves
      Given Alice has the first side against Bob in a 5+0 matched game after their first moves
      When Alice aborts the matched game
      Then Alice is told the matched game can no longer be aborted
      And the matched game is still unfinished

    Scenario: A matched game that is over cannot be aborted
      Given Bob has resigned the matched game after their first moves
      When Alice aborts the matched game
      Then Alice is told the matched game is over
      And both people see Alice won the matched game

  Rule: Resigning is refused until both people have made their first move, and the person is told to abort instead

    Scenario: The second side cannot resign before either first move
      Given Alice has the first side against Bob in a new matched game
      When Bob resigns the matched game
      Then Bob is told to abort the matched game instead
      And the matched game is still unfinished

    Scenario: The second side cannot resign after only the first side's first move
      Given Alice has made her first move in a new matched game against Bob
      When Bob resigns the matched game
      Then Bob is told to abort the matched game instead
      And the matched game is still unfinished

    Scenario: The second side may resign after both first moves
      Given Alice has the first side against Bob in a 5+0 matched game after their first moves
      When Bob resigns the matched game
      Then both people see Alice won the matched game

  Rule: Missing the first move aborts the matched game

    Scenario: The first side misses the first move after 30 seconds
      Given Alice has the first side against Bob in a new matched game
      When 30 seconds pass
      Then both people see the matched game was aborted

    Scenario: The second side misses the first move 30 seconds after the first side's
      Given Alice has made her first move in a new matched game against Bob
      When 30 seconds pass
      Then both people see the matched game was aborted

    Scenario: The first side still has time for the first move after 29 seconds
      Given Alice has the first side against Bob in a new matched game
      When 29 seconds pass
      Then the matched game is still unfinished

    Scenario: The second side's 30 seconds count from the first side's first move
      Given Alice made her first move 25 seconds into her new matched game with Bob
      When 29 seconds pass
      Then the matched game is still unfinished

  Rule: An aborted matched game has no result, changes no rating and frees both people to seek an opponent

    Scenario: A person paired while their phone was offline does not lose the matched game
      Given Alice has the first side against Bob in a new 5+0 matched game and her phone has been offline since they were paired
      When 30 seconds pass
      Then both people see the matched game was aborted
      And neither person's blitz rating has changed

    Scenario: After an aborted matched game a person may seek an opponent again
      Given Alice's 5+0 matched game with Bob was aborted
      When Alice seeks an opponent for the game at 5+0
      Then Alice is waiting for an opponent at 5+0

    Scenario: Aborting an aborted matched game again changes nothing
      Given Alice's 5+0 matched game with Bob was aborted
      When Alice aborts the matched game
      Then both people see the matched game was aborted

    Scenario: An aborted matched game cannot be resigned
      Given Alice's 5+0 matched game with Bob was aborted
      When Bob resigns the matched game
      Then Bob is told the matched game is over
      And both people see the matched game was aborted
