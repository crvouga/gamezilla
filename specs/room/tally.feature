@domain:room
Feature: The shared tally
  When people keep a tally together in a room, each wants their own change
  to show at once and everyone to come to see the same tally, so no change
  anyone makes is ever lost or counted twice.

  Background:
    Given Alice and Bob are in the room

  Rule: Every change anyone in the room makes shows for everyone
    No counter-example: anyone in the room can change the tally; turning someone away is a rule of owning the room.

    Scenario: Adding one shows for everyone
      When Alice adds one to the tally
      Then everyone sees a tally of 1

    Scenario: Taking one off shows for everyone
      Given Alice has added one to the tally 2 times
      When Bob takes one off the tally
      Then everyone sees a tally of 1

    Scenario: Changes Alice and Bob make in turn all count
      Given Alice has added one to the tally
      And Bob has added one to the tally
      When Alice adds one to the tally
      Then everyone sees a tally of 3

  Rule: A change made offline shows at once for its maker and reaches everyone once they are back online

    Scenario: A change made offline shows at once only for its maker
      Given Alice's phone is offline
      When Alice adds one to the tally
      Then Alice sees a tally of 1
      And Bob still sees a tally of 0

    Scenario: A change made offline reaches everyone once its maker is back online
      Given Alice has added one to the tally while offline
      When Alice's phone comes back online
      Then everyone sees a tally of 1

  Rule: A change waiting on a phone is kept when the app closes unexpectedly
    No counter-example: nothing a person does loses a change waiting on their phone.

    Scenario: A waiting change reaches everyone once its maker reopens the app
      Given Alice has added one to the tally while offline
      And Alice's app has closed unexpectedly
      When Alice reopens the app
      Then everyone sees a tally of 1

  Rule: An interrupted change counts once when the room is available again
    No counter-example: interruption cannot turn one chosen change into two or lose it.

    Scenario: A change whose maker did not hear back counts once
      Given Alice has added one while the room became unavailable
      When the room is available again
      Then everyone sees a tally of 1

    Scenario: A later change keeps an interrupted earlier change
      Given Alice has added one while the room became unavailable
      And the room is available again
      When Bob adds one to the tally
      Then everyone sees a tally of 2
