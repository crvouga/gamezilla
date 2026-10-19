@domain:games
Feature: A rematch after a matched game
  When a matched game is finished, its two people may want another matched
  game at once, so a rematch starts one between them without seeking an
  opponent again.

  Rule: After a finished matched game either person may offer a rematch while neither has another unfinished matched game

    Scenario: Bob offers Alice a rematch after their matched game is finished
      Given Alice's 5+0 matched game with Bob is finished
      When Bob offers a rematch
      Then Alice is offered a rematch

    Scenario: An aborted matched game has no rematch
      Given Alice's 5+0 matched game with Bob was aborted
      When Bob offers a rematch
      Then Bob is told an aborted matched game has no rematch

    Scenario: A rematch cannot be offered while the matched game is unfinished
      Given Alice has an unfinished matched game with Bob
      When Bob offers a rematch
      Then Bob is told the matched game is not over yet

    Scenario: A rematch is refused once the other person has another unfinished matched game
      Given Alice's 5+0 matched game with Bob is finished
      And Alice has since been paired with Carol in an unfinished matched game
      When Bob offers a rematch
      Then Bob is told Alice already has another unfinished matched game

    Scenario: A person seeking an opponent cannot offer a rematch
      Given Alice's 5+0 matched game with Bob is finished
      And Bob is seeking an opponent for the game at 5+0
      When Bob offers a rematch
      Then Bob is told he is already seeking an opponent

    Scenario: A rematch is refused once the other person is seeking an opponent
      Given Alice's 5+0 matched game with Bob is finished
      And Alice is seeking an opponent for the game at 5+0
      When Bob offers a rematch
      Then Bob is told Alice is already seeking an opponent

  Rule: Accepting the rematch starts a new matched game at the same clock choice with the sides swapped

    Scenario: Accepting the rematch swaps the sides and keeps 5+0
      Given Alice had the first side against Bob in their finished 5+0 matched game
      And Bob has offered Alice a rematch
      When Alice accepts the rematch
      Then Alice has the second side against Bob in their new matched game
      And both people see their matched game is played at 5+0

    Scenario: Offering a rematch back accepts the rematch
      Given Alice had the first side against Bob in their finished 5+0 matched game
      And Bob has offered Alice a rematch
      When Alice offers a rematch
      Then Alice has the second side against Bob in their new matched game

    Scenario: Bob cannot accept his own rematch offer
      Given Alice's 5+0 matched game with Bob is finished
      And Bob has offered Alice a rematch
      When Bob accepts the rematch
      Then Bob is told only Alice may accept or decline his rematch offer

  Rule: A rematch offer ends when either person declines the rematch or finds a new opponent

    Background:
      Given Alice's 5+0 matched game with Bob is finished

    Scenario: Alice declines Bob's rematch offer
      Given Bob has offered Alice a rematch
      When Alice declines the rematch
      Then neither person is offered a rematch

    Scenario: Bob cannot decline his own rematch offer
      Given Bob has offered Alice a rematch
      When Bob declines the rematch
      Then Bob is told only Alice may accept or decline his rematch offer
      And Alice is offered a rematch

    Scenario: Finding a new opponent ends a rematch offer
      Given Bob has offered Alice a rematch
      When Bob finds a new opponent
      Then neither person is offered a rematch
      And Bob is waiting for an opponent at 5+0

    Scenario: Nobody can accept the rematch once its rematch offer has ended
      Given Bob's rematch offer ended when he found a new opponent
      When Alice accepts the rematch
      Then Alice is told the rematch offer has ended
