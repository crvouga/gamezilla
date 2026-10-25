@domain:hearts
Feature: Hands only their own player sees
  When Alice plays Hearts, she wants her own cards to herself and everyone else to see only what play shows, so no player or watcher ever learns a hand they should not.

  Rule: Every deal gives each player 13 cards that only they see
    No counter-example: only the game deals, and nobody can choose or see the cards another player is dealt.

    Scenario: Starting a Hearts game deals each player their own 13 cards
      Given Alice, Bob, Carol and Dave are ready for a custom game of Hearts as South, West, North and East
      When Alice starts the custom game
      Then each player holds 13 cards and every card of the deck is in exactly one hand
      And Alice sees her own 13 cards and how many cards West, North and East hold, but none of their cards

  Rule: A watcher, whenever they arrive, sees only the board every player sees

    Background:
      Given Alice, Bob, Carol and Dave are playing Hearts as South, West, North and East

    Scenario: A watcher sees each card played and how many cards each hand holds
      Given Eve is watching the custom game
      And South has led the two of clubs to the first trick
      When Bob plays the nine of clubs
      Then Eve sees the two of clubs and the nine of clubs in the current trick
      And Eve sees how many cards each hand holds, but none of their cards

    Scenario: A watcher sees who has passed but cannot see the cards passed
      Given Eve is watching the custom game
      And the first deal is awaiting passes
      When Bob passes the ace, king and queen of hearts
      Then Eve sees West has passed
      And Eve cannot see which cards West passed

    Scenario: A watcher who arrives during a deal cannot see any hand
      Given Eve is in Alice's space
      And the first trick of the second deal has been played
      When Eve watches the custom game
      Then Eve sees the board with every cumulative score
      And Eve cannot see any player's hand or the cards anyone passed

  Rule: A player coming back sees their own current hand and the board, and no other hand

    Background:
      Given Alice, Bob, Carol and Dave are playing Hearts as South, West, North and East

    Scenario: A player coming back during passing sees their own pass and who else has passed
      Given the first deal is awaiting passes
      And Bob passed the ace, king and queen of hearts before his phone went offline
      And Carol has passed since then
      When the connection comes back
      Then Bob sees his own hand and that he passed the ace, king and queen of hearts
      And Bob sees North has passed but cannot see which cards North passed

    Scenario: A player coming back during a trick sees their current hand, every score and whose turn it is
      Given West has led the second trick of the first deal
      And Bob's phone was offline while North and East played their cards
      When the connection comes back
      Then Bob sees his own current hand, every cumulative score and that it is South's turn
      And Bob sees no other player's hand
