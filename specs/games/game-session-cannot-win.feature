@domain:games
Feature: A victory needs a side that can still win
  When a participant runs out of time, resigns or stays away, the other participant wants the result to follow what the board still allows, so a side that cannot win is never given a victory.

  Rule: Running out of time is a draw when the other side cannot win
    No counter-example: the board decides the result, and nobody can choose a victory it cannot give.

    Scenario: Running out against a side that cannot win is a draw
      Given Alice and Bob have a game session played at 1+0 where the second side cannot win
      And the first side has one second left
      When 1 second passes
      Then the game session is finished as a draw

    Scenario: The side that can win still wins on time
      Given Alice and Bob have a game session played at 1+0 where the second side cannot win
      And the second side has one second left
      When 1 second passes
      Then Alice wins the game session on time

  Rule: Resigning is a draw when the other side cannot win
    No counter-example: the board decides the result, and nobody can choose a victory it cannot give.

    Scenario: Resigning to a side that cannot win is a draw
      Given Alice and Bob have a game session under way where the second side cannot win
      When Alice resigns the game session
      Then the game session is finished as a draw

    Scenario: Resigning to the side that can win gives it the victory
      Given Alice and Bob have a game session under way where the second side cannot win
      When Bob resigns the game session
      Then Alice wins the game session by resignation

  Rule: Claiming the win is a draw when the claimant cannot win
    No counter-example: the board decides the result, and nobody can choose a victory it cannot give.

    Scenario: The claim of a side that cannot win is a draw
      Given Bob hosts a game session under way with Alice on the first side where the second side cannot win
      And Alice has been away from the game session for 60 seconds
      When Bob claims the win
      Then the game session is finished as a draw

    Scenario: The claim of the side that can win gives it the victory
      Given Alice and Bob have a game session under way where the second side cannot win
      And Bob has been away from the game session for 60 seconds
      When Alice claims the win
      Then Alice wins the game session because Bob stayed away
