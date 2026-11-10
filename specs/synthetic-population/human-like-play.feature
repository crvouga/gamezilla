@domain:synthetic-population
Feature: Synthetic Users play like people
  When a person plays against a Synthetic User, they want it to make its moves
  and answer rematches the way a person would, so the game feels like one
  against another player.

  Rule: A Synthetic User's thinking time for each move is at least 2 seconds and at most 20

    Scenario Outline: A Synthetic User makes its <game> move within a human-like thinking time
      Given the Synthetic User "Cedar" has an ongoing "<game>" game against Bob
      And it is "Cedar"'s move
      When "Cedar" continues its current activity
      Then "Cedar" makes a legal move with a thinking time of 2 to 20 seconds

      Examples:
        | game |
        | chess |
        | Connect Four |
        | Battleship |

    Scenario: A Synthetic User never moves the moment its move comes
      Given the Synthetic User "Cedar" has an ongoing "chess" game against Bob
      And it is "Cedar"'s move
      When "Cedar" continues its current activity
      Then "Cedar" still has not moved 1 second later

  Rule: A Synthetic User's thinking time changes from one move to the next
    No counter-example: nothing a person does sets a Synthetic User's thinking time.

    Scenario: A Synthetic User has a different thinking time for its next move
      Given the Synthetic User "Cedar" has an ongoing "chess" game against Bob
      And "Cedar"'s thinking time for its previous move was 6 seconds
      And it is "Cedar"'s move
      When "Cedar" continues its current activity
      Then "Cedar"'s thinking time for this move is not 6 seconds

  Rule: A Synthetic User answers a rematch offer within 20 seconds and plays at most 3 games in a row against the same multiplayer opponent

    Scenario: A Synthetic User answers a rematch offer after its first game against a person
      Given the Synthetic User "Cedar" has a finished "chess" game against Bob
      When Bob offers "Cedar" a rematch
      Then "Cedar" answers the rematch within 20 seconds

    Scenario: A Synthetic User declines a fourth game in a row against the same person
      Given the Synthetic User "Cedar" has played 3 "chess" games in a row against Bob
      When Bob offers "Cedar" a rematch
      Then Bob is told "Cedar" declines the rematch within 20 seconds

    Scenario: A Synthetic User offers no fourth game in a row against the same person
      Given the Synthetic User "Cedar" has played 3 "chess" games in a row against Bob
      When "Cedar" continues its current activity
      Then Bob is not offered a rematch by "Cedar"
