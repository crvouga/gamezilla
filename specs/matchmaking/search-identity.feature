@domain:matchmaking
Feature: The same wait on every device
  When a person uses more than one device, they want one wait that each
  device understands, so asking twice never gives them two matches.

  Rule: Asking from another device does not replace a wait

    Scenario: Alice's other device sees the wait she already has
      Given Alice is waiting with a rating of 1000, accepting anyone within 200 points
      When Alice opens matchmaking on another device
      Then Alice's other device shows the same wait

    Scenario: Asking on another device cannot replace Alice's details
      Given Alice is waiting with a rating of 1000, accepting anyone within 200 points
      When Alice waits for a match with a rating of 1500 on another device
      Then Alice is told she is already waiting
      And Alice's wait shows her name and a rating of 1000

  Rule: Stopping an earlier wait never stops a later wait

    Scenario: Alice can wait again after stopping
      Given Alice has stopped waiting
      When Alice waits for a match with a rating of 1500
      Then Alice is waiting
      And Alice's wait shows her name and a rating of 1500

    Scenario: Alice's earlier device cannot stop her later wait
      Given Alice has stopped waiting
      And Alice is waiting again on another device
      When Alice stops her earlier wait
      Then Alice is told there was nothing to stop
      And Alice is still waiting

  Rule: Repeating an earlier request keeps its earlier outcome

    Scenario: Repeating a request for a waiting match keeps the same wait
      Given Alice is waiting for a match
      When Alice repeats her earlier request for a match
      Then Alice has the same wait

    Scenario: Repeating a stopped request cannot start it again
      Given Alice has stopped waiting
      When Alice repeats her earlier request for a match
      Then Alice is not waiting for a match
      And Alice is told her earlier wait has ended

    Scenario: Repeating a matched request cannot start another wait
      Given Alice has been matched with Bob
      When Alice repeats her earlier request for a match
      Then Alice is matched with Bob
      And Alice is told her earlier wait has ended

  Rule: Only the person waiting can stop or change that wait

    Scenario: Alice can stop her wait from another device
      Given Alice is waiting for a match
      When Alice stops waiting on another device
      Then Alice sees she stopped waiting
      And Alice is not waiting for a match

    Scenario: Bob cannot stop Alice's wait
      Given Alice is waiting for a match
      When Bob tries to stop Alice's wait
      Then Bob is told there was nothing to stop
      And Alice is still waiting

    Scenario: Bob cannot change Alice's range
      Given Alice is waiting with a rating of 1000, accepting anyone within 5 points
      When Bob tries to widen Alice's range to 200 points
      Then Bob is told his change did not count
      And Alice accepts nobody more than 5 points away
