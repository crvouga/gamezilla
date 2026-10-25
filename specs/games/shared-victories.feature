@domain:games
Feature: Share a victory
  When a game's own rules give several sides the best result together, each of them wants to be shown as a winner and have it counted, so a tie for the best result is never shown as one person's victory or as a draw. It holds for every game whose rules allow a shared victory.

  Rule: Every side sharing the best result is shown as a winner
    No counter-example: the game's own rules alone decide who shares the best result; a side behind it is shown as no winner below.

    Background:
      Given Alice, Bob, Carol and Dave have a four-player custom game under way

    Scenario: Two sides tied for the best result share the victory
      Given the custom game is one move from a victory Alice and Carol share
      When Dave makes his move
      Then Alice, Bob, Carol and Dave see Alice and Carol share the victory
      And Bob and Dave are not shown as winners

    Scenario: A side alone with the best result wins alone
      Given the custom game is one move from Carol's victory alone
      When Dave makes his move
      Then Alice, Bob, Carol and Dave see Carol as the only winner

  Rule: Each person on a winning side counts a shared victory once in their history and statistics

    Background:
      Given Alice and Carol have shared the victory in a four-player custom game with Bob and Dave

    Scenario: A person who shared the victory counts it as their victory
      When Carol opens the game's history
      Then Carol sees her victory and its participants

    Scenario: A person on a side that did not share the victory counts no victory
      When Bob opens the game's history
      Then Bob sees no victories

    Scenario: A shared victory cannot be replaced by a later move
      When Bob makes a move
      Then Bob is told the game is finished
      And Alice and Carol still share the victory
