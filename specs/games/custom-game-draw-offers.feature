@domain:games
Feature: Offer a draw in a custom game
  When neither participant is clearly winning a custom game under way, one of them wants to offer a draw, so ending it by agreement remains the other person's choice.

  Rule: A draw offer comes from a participant in a custom game between two people

    Scenario: The first side offers the second side a draw
      Given Alice and Bob have a custom game under way
      When Alice offers a draw
      Then Bob is offered a draw

    Scenario: A draw cannot be offered to a bot
      Given Alice has a custom game under way against a bot
      When Alice offers a draw
      Then Alice is told a draw needs two people

  Rule: Only the participant offered a draw may accept it, which finishes the custom game as a draw

    Scenario: Accepting a draw finishes the custom game without a victory
      Given Alice and Bob have a custom game under way
      And Alice has offered Bob a draw in their custom game
      When Bob accepts the draw
      Then the custom game is finished as a draw

    Scenario: A watcher cannot accept a draw
      Given Alice and Bob have a custom game under way watched by Carol
      And Alice has offered Bob a draw in their custom game
      When Carol accepts the draw
      Then Carol is told only the other participant may accept the draw

  Rule: Declining a draw keeps the custom game under way

    Scenario: The second side declines the first side's draw offer
      Given Alice and Bob have a custom game under way
      And Alice has offered Bob a draw in their custom game
      When Bob declines the draw
      Then the custom game remains under way
      And neither person is offered a draw

    Scenario: The first side cannot decline her own draw offer
      Given Alice and Bob have a custom game under way
      And Alice has offered Bob a draw in their custom game
      When Alice declines the draw
      Then Alice is told only Bob may accept or decline her draw offer

  Rule: After a declined draw offer, the person who offered may offer again only after their next move

    Scenario: Offering again before moving is refused
      Given Alice and Bob have a custom game under way
      And Bob has declined Alice's draw offer
      When Alice offers a draw
      Then Alice is told she may offer a draw again after her next move
      And neither person is offered a draw

    Scenario: Offering again after moving reaches the other participant
      Given Alice and Bob have a custom game under way
      And Bob has declined Alice's draw offer
      And Alice has since made her move
      When Alice offers a draw
      Then Bob is offered a draw

  Rule: A move clears a waiting draw offer, and a refused move does not

    Scenario: The second side's move clears the first side's draw offer
      Given Alice and Bob have a custom game after Alice's first move
      And Alice has offered Bob a draw in their custom game
      When Bob makes his move
      Then neither person is offered a draw

    Scenario: A move out of turn cannot clear a draw offer
      Given Alice and Bob have a custom game under way
      And Alice has offered Bob a draw in their custom game
      When Bob makes a move
      Then Bob is told it is the other player's turn
      And Bob is offered a draw
