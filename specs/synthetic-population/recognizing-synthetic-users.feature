@domain:synthetic-population
Feature: Recognize Synthetic Users in a game
  When people play a game, they want to recognize Synthetic Users,
  so they can distinguish automated opponents from people.

  Rule: A Synthetic User is identified as automated wherever its username appears
    No counter-example: every Synthetic User must be recognizable to people.

    @regression:synthetic-population-classification-before-profile-hydration
    Scenario Outline: A person recognizes the Synthetic User in their <game> game
      Given the Synthetic User "Cedar" has an ongoing "<game>" game
      When Bob opens multiplayer "<game>"
      Then Bob sees "Cedar" identified as a Synthetic User

      Examples:
        | game |
        | chess |
        | Connect Four |
        | Pong |

    Scenario: An offline person still recognizes the Synthetic User in Pong
      Given the Synthetic User "Cedar" has an ongoing "Pong" game
      And Bob is offline
      When Bob opens multiplayer "Pong"
      Then Bob sees "Cedar" identified as a Synthetic User
      And Bob is told the connection is missing within 5 seconds

  Rule: A person's username never identifies them as a Synthetic User
    No counter-example: a person is never classified as an automated opponent.

    Scenario Outline: A person recognizes their own username in the <game> game
      Given the Synthetic User "Cedar" has an ongoing "<game>" game
      When Bob opens multiplayer "<game>"
      Then Bob sees Bob without Synthetic User identification

      Examples:
        | game |
        | chess |
        | Connect Four |
        | Pong |
