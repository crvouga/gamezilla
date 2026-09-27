@domain:rooms
Feature: Shared counter
  A room keeps one count that several people change together. Each person
  sees their own change at once and ends up agreeing with the room, however
  their connection comes and goes and even when an app or the room itself
  crashes, so no change is ever lost or counted twice.

  Rule: A change shows in the room and on its author's device

    Scenario: One person's change shows in the room and on their device
      Given Alice is in a shared counter room
      When Alice increments the count
      Then the room's count is 1
      And Alice's device shows a count of 1

  Rule: Changes from several people all count

    Scenario: Changes two people make in turn all count
      Given Alice and Bob are in a shared counter room
      When Alice increments the count
      And Bob increments the count
      And Alice increments the count
      Then everyone agrees on a count of 3
      And the room shows Alice and Bob present

  Rule: An offline change shows at once only on its author's device

    Scenario: An offline change shows only on its author's device
      Given Alice and Bob are in a shared counter room
      And Alice's device is offline
      When Alice increments the count
      And 100 ms pass
      Then Alice's device shows a count of 1
      And Bob's device shows a count of 0

  Rule: An offline change reaches everyone when its author reconnects

    Scenario: An offline change reaches everyone when its author reconnects
      Given Alice and Bob are in a shared counter room
      And Alice has incremented the count while offline
      When Alice reconnects
      Then everyone agrees on a count of 1

  Rule: A person whose network stalls sees no new changes

    Scenario: A person whose network stalls sees nothing new
      Given Alice and Bob are in a shared counter room
      And Bob's network has stalled
      When Alice increments the count
      And 200 ms pass
      Then Bob's device shows a count of 0
      And nothing on Bob's device has changed

  Rule: A person whose network recovers catches up

    Scenario: A person catches up when their network recovers
      Given Alice and Bob are in a shared counter room
      And Bob's network has stalled
      And Alice has incremented the count
      When 200 ms pass
      And Bob's network recovers
      Then everyone agrees on a count of 1

  Rule: A change waiting on a device survives the app crashing

    Scenario: A waiting change reaches everyone after the app restarts
      Given Alice and Bob are in a shared counter room
      And Alice has incremented the count while offline
      And Alice's app has crashed
      When Bob increments the count
      And Alice's app restarts
      Then everyone agrees on a count of 2

  Rule: A room that crashes is down until it restarts

    Scenario: A crashed room is down
      Given Alice and Bob are in a shared counter room
      When the room crashes
      Then the room is down

  Rule: A restarted room comes back with the count it had

    Scenario: A restarted room comes back with the count it had
      Given Alice and Bob are in a shared counter room
      And Alice has incremented the count 2 times
      And the room has crashed
      When the room restarts
      Then the room is up
      And everyone agrees on a count of 2

  Rule: A device whose app crashes after a confirmed change recovers

    Scenario: An app that crashes right after its change is confirmed recovers
      Given Alice and Bob are in a shared counter room
      And Alice's app will crash right after the room confirms her next change
      When Alice increments the count
      And Alice's app restarts
      Then everyone agrees on a count of 1
