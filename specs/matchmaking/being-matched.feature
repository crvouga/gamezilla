@domain:matchmaking
Feature: Being matched
  People waiting want to be paired with someone close to their rating whom
  they accept, and never pushed on someone who does not accept them back, so
  every match is one both people wanted.

  Rule: Two people are matched when each accepts the other

    Scenario: Two people who accept each other are matched
      Given Alice is waiting with a rating of 1000, accepting anyone within 200 points
      And Bob is waiting with a rating of 1050, accepting anyone within 200 points
      When a matching round runs
      Then Alice and Bob are matched with each other

  Rule: One wide reach alone does not make a match

    Scenario: Bob's wide reach does not match him with Alice, who does not accept him
      Given Alice is waiting with a rating of 1000, accepting anyone within 5 points
      And Bob is waiting with a rating of 1050, accepting anyone within 200 points
      When a matching round runs
      Then Alice is waiting
      And Bob is waiting
