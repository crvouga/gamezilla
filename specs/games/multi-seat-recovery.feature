@domain:games
Feature: Keep four-player games through a lost connection
  When Alice plays a four-player game, she wants its board and turns kept through a lost connection, so returning never changes who may play or a finished result.

  Rule: A returning participant sees the same game with every move made meanwhile
    No counter-example: an interruption never replaces the game's accepted moves.

    Scenario: The third player returns to the moves made while her phone was offline
      Given Alice, Bob, Carol and Dave have a four-player custom game
      And Carol's phone was offline while Alice and Bob made their first moves
      When the connection comes back
      Then Carol sees the same four-player custom game with both moves
      And Carol has the custom game turn

  Rule: The host may keep playing alone with three bots while offline
    No counter-example: every bot follows the same rules before and after an interruption.

    Scenario: Three bots reply to the host's offline move
      Given Alice has a four-player custom game against three bots
      And Alice is offline
      When Alice makes her first move
      Then Alice sees three legal bot replies and her next turn

    Scenario: Returning keeps the finished offline game's board and result
      Given Alice has a finished four-player custom game against three bots while offline
      When the connection comes back
      Then the four-player custom game's board and finished result are unchanged
