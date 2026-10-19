@domain:games
Feature: Fair sides in matched games
  When two people are paired, they want the first and second side shared out fairly over their matched games, so nobody keeps getting the same side.

  Rule: Of two paired people, the one with the greater side balance gets the second side
    No counter-example: people never choose their side, so nothing a person does can break this.

    Scenario: The person who had the first side last time gets the second side
      Given Alice had the first side and Bob the second side in their only matched games
      And Alice and Bob are seeking an opponent for the game at 5+0
      When they are paired
      Then Alice has the second side against Bob in their new matched game

    Scenario: Seeking an opponent first does not earn the first side
      Given Alice had the first side in her only matched game and Bob has had none
      And Alice began seeking an opponent for the game at 5+0 before Bob did
      When they are paired
      Then Alice has the second side against Bob in their new matched game

  Rule: With equal side balances either person may get the first side
    No counter-example: either side is fair, so neither is refused.

    Scenario: Two people who each had the first side once get opposite sides
      Given Alice and Bob each had the first side in their only matched game
      And Alice and Bob are seeking an opponent for the game at 5+0
      When they are paired
      Then Alice and Bob receive the same new game on opposite sides
      And the first side has the first turn
