@domain:matchmaking
Feature: Rating ranges as a wait grows older
  When a person has waited without a match, they want their chosen range
  to apply exactly and grow only as agreed, so a longer wait opens the
  promised opportunities without accepting someone too far away.

  Rule: The edge of each person's range is accepted

    Scenario: People exactly 50 points apart accept each other within 50 points
      Given Alice is waiting with a rating of 1000, accepting anyone within 50 points
      And Bob is waiting with a rating of 1050, accepting anyone within 50 points
      When matchmaking pairs people up
      Then Alice and Bob are matched with each other

    Scenario: One point outside either person's range prevents a match
      Given Alice is waiting with a rating of 1000, accepting anyone within 50 points
      And Bob is waiting with a rating of 1051, accepting anyone within 200 points
      When matchmaking pairs people up
      Then Alice is still waiting
      And Bob is still waiting

  Rule: A growing range starts at 50 points, grows 10 points each second and stops at 400 points

    Scenario: Two waits accept a 60 point difference after one second
      Given Alice and Bob have growing ranges and ratings 60 points apart
      When 1 second passes
      Then Alice and Bob accept each other

    Scenario: A new wait does not accept a 60 point difference
      Given Alice and Bob have growing ranges and ratings 60 points apart
      When matchmaking pairs people up
      Then Alice is still waiting
      And Bob is still waiting

    Scenario: Growing ranges accept exactly 400 points after 35 seconds
      Given Alice and Bob have growing ranges and ratings 400 points apart
      When 35 seconds pass
      Then Alice and Bob accept each other

    Scenario: Growing ranges never accept 401 points even after a long wait
      Given Alice and Bob have growing ranges and ratings 401 points apart
      And both have been waiting for 60 seconds
      When matchmaking pairs people up
      Then Alice is still waiting
      And Bob is still waiting

  Rule: A new wait starts its range from the beginning

    Scenario: Alice's later growing range starts at 50 points
      Given Alice stopped a growing wait after 35 seconds
      When Alice waits with a growing range again
      Then Alice accepts nobody more than 50 points away

    Scenario: Stopping does not carry a wide range into Alice's next wait
      Given Alice stopped a growing wait after 35 seconds
      And Alice has a new growing wait
      And Bob is waiting with a rating 400 points above Alice
      When matchmaking pairs people up
      Then Alice is still waiting
      And Bob is still waiting
