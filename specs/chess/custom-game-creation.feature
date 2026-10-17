@domain:chess
Feature: A Custom Game leaves the puzzle rating alone
  When people play a Custom Game in a space, each of them wants their puzzle rating untouched, so a friendly game never costs them puzzle progress.

  Rule: A Custom Game never changes a puzzle rating
    No counter-example: nothing played in a Custom Game reaches a puzzle rating.

    Scenario: A Custom Game cannot change the puzzle rating
      Given Alice has an active Custom Game between Alice as White and Bob as Black
      When Alice resigns the Custom Game
      Then Bob wins the Custom Game by resignation
      And Alice's puzzle rating is 1500
