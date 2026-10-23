@domain:chess
Feature: The custom game board faces the player's side
  When a person plays a custom game, they want their board to face their own side, so they always see the game from where they sit.

  Rule: Each participant's board faces their own side, and everyone else's board faces White
    No counter-example: nobody chooses how a board faces; it follows the side each person has accepted.

    Scenario: Black's board faces Black when the game starts
      Given Alice has a custom game between Alice as White and Bob as Black
      And Alice and Bob are ready for the custom game
      When Alice starts the custom game
      Then Bob's board faces Black
      And Alice's board faces White

    Scenario: A watcher's board faces White
      Given Alice has a custom game between Alice as White and Bob as Black
      And Alice and Bob are ready for the custom game
      And Carol is in Alice's space
      When Alice starts the custom game
      Then Carol's board faces White

  Rule: Swapping sides before start turns each person's board to their new side

    Scenario: Swapping sides turns both people's boards
      Given Alice has a custom game between Alice as White and Bob as Black
      When Alice swaps White and Black in the custom game
      Then Alice's board faces Black
      And Bob's board faces White

    Scenario: A refused swap after start leaves each board facing the same side
      Given Alice has an active custom game between Alice as White and Bob as Black
      When Alice swaps White and Black in the custom game
      Then Alice is told the custom game has already started
      And Bob's board faces Black
