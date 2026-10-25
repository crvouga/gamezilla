@domain:word-tiles
Feature: Solve one-move challenges
  When Alice tries a one-move challenge, she wants one placement from its rack to reach the target, so the challenge tests a single move.

  Rule: A one-move challenge is solved when one placement reaches its target

    Scenario: Reaching the target solves the challenge
      Given Alice is trying the one-move challenge with a rack of Z, O, O, K, E, A and R and a target of 60 points on an empty board
      When Alice places ZOO from f8 to h8
      Then the challenge is solved with 64 points

    Scenario: A placement short of the target does not solve the challenge
      Given Alice is trying the one-move challenge with a rack of Z, O, O, K, E, A and R and a target of 60 points on an empty board
      When Alice places OAK from g8 to i8
      Then Alice scores 14 points
      And the challenge is still unsolved

  Rule: A one-move challenge can be published only with a placement that reaches its target

    Scenario: A challenge with a placement reaching its target can be published
      Given Alice has made a one-move challenge with a rack of R, E, T, A, I, N and S and a target of 70 points on an empty board
      When Alice publishes the challenge with her placement of RETAINS from d8 to j8
      Then the challenge is published

    Scenario: A challenge whose placement falls short cannot be published
      Given Alice has made a one-move challenge with a rack of R, E, T, A, I, N and S and a target of 70 points on an empty board
      When Alice publishes the challenge with her placement of RAT from h7 to h9
      Then Alice is told her placement does not reach the target
      And the challenge is still not published
