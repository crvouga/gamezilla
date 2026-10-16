@domain:connect-four
Feature: Review Connect Four games
  When Alice finishes Connect Four, she wants its history and replay, so every drop and result stays understandable.

  Rule: Replay shows played positions without changing the game

    Scenario: A played drop can be reviewed
      Given Alice has a completed Connect Four game
      When Alice reviews the third Connect Four drop
      Then Alice sees the Connect Four board after three drops
      And the completed Connect Four history is unchanged

    Scenario: An unplayed drop cannot be reviewed
      Given Alice has a completed Connect Four game
      When Alice reviews an unplayed Connect Four drop
      Then Alice is told that Connect Four drop was not played

  Rule: Connect Four statistics keep other games separate
    No counter-example: a Connect Four result never changes chess statistics.

    Scenario: A completed victory contributes to Connect Four statistics
      Given Alice has won a Connect Four game
      When Alice opens her Connect Four history
      Then Alice sees her Connect Four victory and its participants
