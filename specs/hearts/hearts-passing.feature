@domain:hearts
Feature: Pass three cards
  When a deal has passing, each player wants to choose three cards to pass in secret and receive three in return, so every player can improve their hand without anyone learning what was passed until it arrives.

  Background:
    Given Alice, Bob, Carol and Dave are playing Hearts as South, West, North and East

  Rule: Passes go to the left, to the right, across, then there is no passing, repeating by deal

    Scenario Outline: Each deal's passes go in its own passing direction
      Given the <deal> deal is awaiting passes
      And South has passed the ace, king and queen of spades, and West and North have passed
      When Dave passes the two, three and four of diamonds
      Then <player> receives the ace, king and queen of spades

      Examples:
        | deal   | player |
        | first  | West   |
        | second | East   |
        | third  | North  |
        | fifth  | West   |

    Scenario: The fourth deal goes straight to the first trick
      Given only the last card of the third deal is still to be played and every cumulative score is below 50
      When Dave plays his last card
      Then the fourth deal is dealt with no passing
      And the player who holds the two of clubs has the turn

    Scenario: A pass in the fourth deal is refused
      Given it is the fourth deal
      When Alice passes the ace, king and queen of spades
      Then Alice is told there is no passing in this deal
      And Alice still holds the ace, king and queen of spades

  Rule: A player passes exactly three different cards from their own hand, once each deal

    Background:
      Given the first deal is awaiting passes

    Scenario: Three cards from the player's own hand are passed
      When Bob passes the ace, king and queen of hearts
      Then Bob sees he has passed the ace, king and queen of hearts
      And Alice, Carol and Dave see West has passed

    Scenario: A pass of two cards is refused
      When Bob passes only the ace and king of hearts
      Then Bob is told a pass is exactly three different cards
      And West has not passed

    Scenario: A pass of a card the player does not hold is refused
      Given West does not hold the queen of spades
      When Bob passes the queen of spades and the ace and king of hearts
      Then Bob is told he does not hold the queen of spades
      And West has not passed

    Scenario: A second pass in the same deal is refused
      Given Bob has passed the ace, king and queen of hearts
      When Bob passes the two, three and four of clubs
      Then Bob is told he has already passed in this deal
      And Bob's pass is still the ace, king and queen of hearts

  Rule: Passed cards change hands all at once, only after all four players have passed

    Background:
      Given the first deal is awaiting passes
      And South, West and North have passed

    Scenario: The fourth pass makes every passed card change hands together
      When Dave passes the two, three and four of diamonds
      Then every player receives the three cards passed to them at the same time
      And South receives the two, three and four of diamonds

    Scenario: No card can be played while a player has not passed
      When Alice plays the two of clubs
      Then Alice is told the first trick begins once every player has passed
      And no passed card has changed hands
