@domain:hearts
Feature: Play Hearts with people and bots
  When Alice chooses Hearts in her space, she wants four players, people or clearly shown bots, and a fresh Hearts game after the last, so she can play with other people or practise alone.

  Rule: A Hearts custom game has four players, people and bots alike, and every bot is shown as a bot
    No counter-example: nobody is dealt a card until the Hearts game has all four players, people or bots.

    Scenario: Two people and two bots are dealt their cards
      Given Alice and Bob are ready for a custom game of Hearts as South and West, with bots as North and East
      When Alice starts the custom game
      Then each player holds 13 cards
      And Alice and Bob see North and East shown as bots

  Rule: One person and three bots can play Hearts, the bots passing and playing for themselves
    No counter-example: a bot never needs anyone to pass or play for it.

    Scenario: A person and three bots play a whole deal
      Given Alice is South in a Hearts custom game against three bots
      And Alice has passed and played every card of the first deal but her last
      When Alice plays her last card
      Then every player has played 13 cards and the first deal is scored
      And the second deal is dealt, passing to the right

  Rule: Hearts is played in custom games, and nobody is paired up for it

    Background:
      Given Hearts is the game of Alice's space

    Scenario: Hearts offers custom games
      When Alice opens the game's choices
      Then Alice is offered custom games of Hearts

    Scenario: Hearts does not offer pairing people up
      When Alice opens the game's choices
      Then pairing people up is not offered for Hearts

  Rule: A rematch makes each person the next player clockwise and begins again from 0, passing to the left
    No counter-example: a rematch never carries over a score or the passing direction.

    Background:
      Given Alice, Bob, Carol and Dave are South, West, North and East in a Hearts game that is over

    Scenario: A rematch makes each person the next player clockwise
      When Alice asks for a rematch
      Then the rematch has Dave as South, Alice as West, Bob as North and Carol as East

    Scenario: A rematch begins from 0 with passing to the left
      Given Alice has asked for a rematch and all four people are ready for the custom game
      When Alice starts the custom game
      Then every cumulative score is 0
      And the first deal is awaiting passes to the left
