@domain:synthetic-population
Feature: Synthetic Users play Pong
  When a person has a Synthetic User as a multiplayer opponent, they want it
  to keep playing Pong, so their game can reach a multiplayer result.

  Rule: An ongoing Pong game can reach a multiplayer result while the connection is available

    Scenario: A Synthetic User reaches its Pong multiplayer result
      Given the Synthetic User "Cedar" has an ongoing "Pong" game
      When "Cedar" continues its current activity
      Then "Cedar" has a multiplayer result
      And the Synthetic User "Cedar" keeps its account and username

    Scenario: An offline Synthetic User keeps its ongoing Pong game
      Given the Synthetic User "Cedar" has an ongoing "Pong" game
      And Cedar is offline
      When "Cedar" continues its current activity
      Then Cedar is told the connection is missing within 5 seconds
      And the Synthetic User "Cedar" continues its same multiplayer game

  Rule: A returning connection lets the same Pong game continue
    No counter-example: a missing connection is the first rule's refusal.

    Scenario: A Synthetic User reaches the multiplayer result of the Pong game it kept while offline
      Given the Synthetic User "Cedar" has an ongoing "Pong" game
      And Cedar is offline
      And the connection has come back
      When "Cedar" continues its current activity
      Then "Cedar" has a multiplayer result
      And the Synthetic User "Cedar" keeps its account and username
