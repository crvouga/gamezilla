@domain:games
Feature: Offer a draw in a matched game
  When neither person is clearly winning a matched game, one of them wants to
  offer a draw, so the game is drawn by agreement only if the other person
  accepts the draw.

  Rule: Either person may offer a draw in an unfinished matched game

    Scenario: The first side offers the second side a draw
      Given Alice has the first side against Bob in a new matched game
      When Alice offers a draw
      Then Bob is offered a draw

    Scenario: Offering a draw twice keeps one draw offer
      Given Alice has offered Bob a draw in their matched game
      When Alice offers a draw
      Then Bob is offered a draw
      And the matched game is still unfinished

    Scenario: No draw offer is taken once the matched game is over
      Given Bob has resigned the matched game after their first moves
      When Alice offers a draw
      Then Alice is told the matched game is over

  Rule: Only the person offered a draw may accept the draw, and the matched game is then drawn by agreement

    Scenario: The second side accepts the first side's draw offer
      Given Alice has offered Bob a draw in their matched game
      When Bob accepts the draw
      Then both people see the matched game is drawn by agreement

    Scenario: Offering a draw back accepts the draw
      Given Alice has offered Bob a draw in their matched game
      When Bob offers a draw
      Then both people see the matched game is drawn by agreement

    Scenario: The first side cannot accept her own draw offer
      Given Alice has offered Bob a draw in their matched game
      When Alice accepts the draw
      Then Alice is told only Bob may accept or decline her draw offer
      And the matched game is still unfinished

    Scenario: Nobody can accept the draw without a draw offer
      Given Alice has the first side against Bob in a new matched game
      When Bob accepts the draw
      Then Bob is told there is no draw offer
      And the matched game is still unfinished

  Rule: The person offered a draw may decline the draw, and the matched game goes on

    Scenario: The second side declines the first side's draw offer
      Given Alice has offered Bob a draw in their matched game
      When Bob declines the draw
      Then neither person is offered a draw
      And the matched game is still unfinished

    Scenario: The first side cannot decline her own draw offer
      Given Alice has offered Bob a draw in their matched game
      When Alice declines the draw
      Then Alice is told only Bob may accept or decline her draw offer
      And Bob is offered a draw

    Scenario: Nobody can decline the draw without a draw offer
      Given Alice has the first side against Bob in a new matched game
      When Bob declines the draw
      Then Bob is told there is no draw offer

  Rule: A move by the person offered a draw declines the draw, and a move by the person who made the draw offer keeps it

    Scenario: The second side's move declines the first side's draw offer
      Given Alice has made her first move in a new matched game against Bob
      And Alice has offered Bob a draw in their matched game
      When Bob makes his first move
      Then neither person is offered a draw

    Scenario: The first side's own move keeps her draw offer
      Given Alice has the first side against Bob in a new matched game
      And Alice has offered Bob a draw in their matched game
      When Alice makes her first move
      Then Bob is still offered a draw
