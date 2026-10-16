@domain:connect-four
Feature: Accessible Connect Four play
  When Alice uses Connect Four on her device, she wants clear controls and disc identities, so she can follow the game and choose a column comfortably.

  Rule: A playable column offers a preview and a full column offers no drop

    @regression:connect-four-fixture-before-space-join
    @regression:native-conformance-command-not-clickable
    Scenario: Choosing a column shows its landing place
      Given Alice has a new Connect Four game
      When Alice chooses Connect Four column 4 with the keyboard
      Then the Connect Four preview marks the bottom of column 4
      And the Connect Four board has no played discs

    Scenario: A full column offers no drop
      Given Alice has a Connect Four game with column 4 full
      When Alice follows the Connect Four board
      Then Connect Four column 4 is identified as full and unavailable

  Rule: Disc identities and results remain understandable without color or motion
    No counter-example: reduced motion changes presentation alone.

    Scenario: Reduced motion keeps keyboard play available
      Given Alice has a new Connect Four game with reduced motion
      When Alice drops into Connect Four column 4 using the keyboard
      Then the Connect Four board identifies Red's disc and Yellow's turn
