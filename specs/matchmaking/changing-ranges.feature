@domain:matchmaking
Feature: Range changes affect only their intended wait
  When people change who they accept, they want the latest accepted choice
  to count, so an earlier change never overwrites a later choice or wait.

  Rule: A narrower range counts before the next pairing

    Scenario: Alice may narrow a waiting range
      Given Alice is waiting with a rating of 1000, accepting anyone within 200 points
      When Alice narrows her range to 5 points
      Then Alice sees her change counted
      And Alice accepts nobody more than 5 points away

    Scenario: Narrowing before pairing prevents the wider match
      Given Alice and Bob are waiting with ratings 50 points apart
      And Alice narrowed her range to 5 points
      When matchmaking pairs people up
      Then Alice and Bob are still waiting

  Rule: Repeating an earlier range change keeps the latest accepted choice

    Scenario: Repeating the latest change keeps the same range
      Given Alice widened her waiting range to 200 points
      When Alice repeats that range change
      Then Alice accepts anyone within 200 points

    Scenario: An earlier wide change cannot overwrite a later narrow choice
      Given Alice widened her waiting range to 200 points
      And Alice then narrowed the same wait to 5 points
      When Alice repeats her earlier wide range change
      Then Alice is told that earlier change already counted
      And Alice accepts nobody more than 5 points away

  Rule: A change for an earlier wait never changes the new wait

    Scenario: A person may change their current wait
      Given Alice is waiting with a range of 5 points
      When Alice widens her range to 200 points
      Then Alice sees her change counted

    Scenario: A delayed change for a stopped wait cannot widen a later wait
      Given Alice stopped her earlier wait
      And Alice is waiting again with a range of 5 points
      When Alice widens the range of her earlier wait to 200 points
      Then Alice is told her earlier wait has ended
      And Alice accepts nobody more than 5 points away

  Rule: Choosing a growing range again keeps the age of the same wait

    Scenario: A growing range chosen for an older wait includes its waiting age
      Given Alice is waiting with a range of 5 points and has waited 35 seconds
      When Alice changes her range to a growing range
      Then Alice accepts anyone within 400 points

    Scenario: Choosing a growing range does not accept beyond its maximum
      Given Alice is waiting with a range of 5 points and has waited 60 seconds
      When Alice changes her range to a growing range
      Then Alice cannot be matched with someone 401 points away
