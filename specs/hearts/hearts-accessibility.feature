@domain:hearts
Feature: Follow and play Hearts with the keyboard, by listening and without colour
  When Alice plays Hearts on her device, she wants to choose and play cards with the keyboard alone or by listening, and to follow the board without relying on colour, so she can play however she uses the app.

  Rule: The keyboard alone can pass three cards and play a card, within the same rules

    Background:
      Given Alice, Bob, Carol and Dave are playing Hearts as South, West, North and East

    Scenario: Three cards are passed with the keyboard
      Given the first deal is awaiting passes
      When Bob passes the ace, king and queen of hearts with the keyboard
      Then Bob sees he has passed the ace, king and queen of hearts

    Scenario: A card is played with the keyboard
      Given South has led the two of clubs to the first trick
      And West holds the nine of clubs
      When Bob plays the nine of clubs with the keyboard
      Then the nine of clubs is in the current trick
      And it is North's turn

    Scenario: A card that does not follow suit is refused with the keyboard too
      Given South has led the two of clubs to the first trick
      And West holds the nine of clubs and the ace of diamonds
      When Bob plays the ace of diamonds with the keyboard
      Then Bob is told he must follow suit with a club
      And Bob still holds the ace of diamonds

  Rule: The board shows whose turn it is, the current trick, who took the last trick, who has passed and every score, also to someone listening
    No counter-example: how the board is shown or told never changes the Hearts game.

    Background:
      Given Alice, Bob, Carol and Dave are playing Hearts as South, West, North and East

    Scenario: The board shows who took the trick and who leads next
      Given West has led the ten of diamonds to the fourth trick
      And North has played the king of diamonds and East the ace of spades
      And Alice is listening to the app
      When Alice plays the jack of diamonds
      Then the board shows North took the last trick, that it is North's turn and every cumulative score
      And Alice hears North took the trick with the king of diamonds and leads next

    Scenario: The board shows who has passed during passing
      Given the first deal is awaiting passes
      And Alice is listening to the app
      When Bob passes the ace, king and queen of hearts
      Then the board shows West has passed and South, North and East have not
      And Alice hears West has passed

  Rule: Suits, players and the turn are told apart without colour alone
    No counter-example: colour may add to a difference but never shows it on its own.

    Scenario: Cards, players and the turn are shown by name and symbol, not colour alone
      Given Alice, Bob, Carol and Dave are ready for a custom game of Hearts as South, West, North and East
      When Alice starts the custom game
      Then every card in Alice's hand shows its rank and suit by symbol and name, not by colour alone
      And the board names each player and whose turn it is, not by colour alone
