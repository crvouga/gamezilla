@domain:chess
Feature: Running out of time against a king and a knight
  When a person runs out of time in multiplayer chess against an opponent left with only a king and a knight, they want the rules of chess followed, so a side that can still checkmate is never denied its win on time.

  Rule: A king and a knight can still checkmate by some series of legal moves, so running out of time against them loses
    No counter-example: running out of time against a side that cannot win is a draw in every game, and a king and a knight are not such a side.

    Scenario: Running out of time against a king and knight still loses
      Given Bob has only his king and a knight left as Black in his 1+0 multiplayer game with Alice
      And Alice has 1 second left on White's multiplayer clock on her turn
      When 1 seconds pass in multiplayer chess
      Then the multiplayer game is still won by Bob because White ran out of time
