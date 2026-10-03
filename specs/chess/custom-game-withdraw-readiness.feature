@domain:chess
Feature: Withdraw readiness
  When a participant changes their mind before start, they want to withdraw readiness, so the game waits for their agreement.

  Rule: A person may withdraw readiness before start

    Scenario: A ready person withdraws their agreement
      Given Alice has a Custom Game between Alice as White and Bob as Black
      And Alice and Bob are ready for the Custom Game
      When Bob withdraws readiness for the Custom Game
      Then Bob is not ready for the Custom Game
      And The Custom Game cannot start

    Scenario: Readiness cannot be withdrawn after start
      Given Alice has an active Custom Game between Alice as White and Bob as Black
      When Bob withdraws readiness for the Custom Game
      Then Bob is told the Custom Game has already started
