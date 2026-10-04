@domain:matchmaking
Feature: Accepted waits keep their outcomes
  When people wait for a match and go away for a long time, they want their
  accepted wait or match still there, so time alone never takes it away.

  Rule: Waiting has no time limit

    Scenario: A person still waits after a day without a compatible person
      Given Alice is waiting with a range of 5 points
      When a day passes
      Then Alice is waiting

    Scenario: Time alone does not stop two incompatible waits
      Given Alice and Bob are waiting with ratings 100 points apart
      And both accept nobody more than 5 points away
      When a day passes
      Then Alice and Bob are still waiting

  Rule: A formed matchmaking match keeps the same identity and people
    No counter-example: a formed match is a lasting outcome; nobody can replace its identity or people.

    Scenario: Both people receive one complete matchmaking match
      Given Alice and Bob are waiting within each other's ranges
      When matchmaking pairs people up
      Then one matchmaking match is formed for Alice and Bob

    Scenario: A later request for the match does not replace it
      Given Alice and Bob are matched with each other
      When a day passes
      Then Alice and Bob keep the same match

  Rule: A person who is unavailable cannot start a wait

    Scenario: An available person may start a wait
      Given Alice is available for a match
      When Alice waits for a match with a rating of 1000
      Then Alice is waiting

    Scenario: An unavailable person has no accepted wait
      Given Alice is unavailable for a match
      When Alice waits for a match with a rating of 1000
      Then Alice is told she is unavailable for a match
      And Alice is not waiting
