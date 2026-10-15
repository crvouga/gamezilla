@domain:connect-four
Feature: Drop discs and connect four
  When Alice plays Connect Four, she wants fair turns and gravity, so a victory follows the classic rules.

  Rule: Each turn drops one disc into the lowest empty place

    Scenario: An empty column receives its first disc at the bottom
      Given Alice has a new Connect Four game
      When Alice drops into Connect Four column 4
      Then Red occupies the bottom of Connect Four column 4
      And Yellow has the Connect Four turn

    Scenario: A full column refuses another disc
      Given Alice has a Connect Four game with column 4 full
      When Alice drops into Connect Four column 4
      Then Alice is told that Connect Four column is full
      And the Connect Four board and turn are unchanged

  Rule: Only the player with the turn may drop a disc

    Scenario: The next player continues the game
      Given Alice and Bob have a Connect Four game after Red's first drop
      When Bob drops into Connect Four column 3
      Then Red has the Connect Four turn

    Scenario: A player cannot take the opponent's turn
      Given Alice and Bob have a new Connect Four game
      When Bob drops into Connect Four column 3
      Then Bob is told it is the other player's Connect Four turn
      And the Connect Four board and turn are unchanged

    Scenario: A missing connection prevents shared play
      Given Alice and Bob have a new Connect Four game without a connection
      When Alice drops into Connect Four column 4
      Then Alice is told Connect Four needs a connection
      And the Connect Four board and turn are unchanged

  Rule: A winning alignment ends the game immediately

    Scenario Outline: A winning alignment awards the victory
      Given Alice has a Connect Four game one drop before a <direction> winning alignment
      When Alice makes the winning Connect Four drop
      Then Red wins Connect Four
      And the Connect Four winning alignment is identified

      Examples:
        | direction  |
        | horizontal |
        | vertical   |
        | ascending diagonal |
        | descending diagonal |

    Scenario: A completed game refuses another drop
      Given Alice has a completed Connect Four game
      When Alice drops into Connect Four column 7
      Then Alice is told the Connect Four game is finished
      And the Connect Four board and turn are unchanged

  Rule: A full board without a winning alignment is a draw
    No counter-example: an alignment on the last drop is a victory under the preceding rule.

    Scenario: The last available place completes a draw
      Given Alice has a Connect Four game one drop before a full-board draw
      When Alice fills the last Connect Four column
      Then Connect Four ends in a draw
