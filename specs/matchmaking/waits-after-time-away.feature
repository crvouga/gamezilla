@domain:matchmaking
Feature: Waiting with a connection and returning later
  When a person's device loses its connection, they want to know what can
  happen to their wait and find its outcome when they return, so being
  away never silently starts or stops a wait.

  Rule: Losing a connection keeps the device's last known wait
    No counter-example: losing a connection changes what the device can do, never an accepted wait.

    Scenario: A waiting phone keeps its last known wait when it goes offline
      Given Alice is waiting with a range of 5 points
      When Alice's phone goes offline
      Then Alice's phone shows her last known wait
      And Alice's phone shows her last known range

  Rule: Waiting, stopping and changing a range need a connection

    Scenario: Alice can wait once her phone is back online
      Given Alice's phone is offline
      When Alice's phone comes back online
      Then Alice can wait for a match

    Scenario: Asking while offline does not start a wait later
      Given Alice's phone is offline
      When Alice waits for a match with a rating of 1500
      Then Alice is told matchmaking needs a connection
      And Alice is not waiting for a match

    Scenario: Stopping while offline does not claim the wait has stopped
      Given Alice is waiting for a match
      And Alice's phone is offline
      When Alice stops waiting
      Then Alice is told matchmaking needs a connection
      And Alice's phone shows her last known wait

    Scenario: Changing a range while offline does not claim the change counted
      Given Alice is waiting with a rating of 1000, accepting anyone within 5 points
      And Alice's phone is offline
      When Alice widens her range to 200 points
      Then Alice is told matchmaking needs a connection
      And Alice's phone shows her last known range

  Rule: Losing a connection does not stop an accepted wait
    No counter-example: losing a connection is not the person's choice to stop waiting.

    Scenario: Alice finds her unchanged wait when her phone returns
      Given Alice is waiting for a match
      And Alice's phone is offline
      When Alice's phone comes back online
      Then Alice has the same wait

    Scenario: Alice can be matched while her phone is offline
      Given Alice is waiting with a rating of 1000, accepting anyone within 200 points
      And Bob is waiting with a rating of 1050, accepting anyone within 200 points
      And Alice's phone is offline
      When matchmaking pairs people up
      Then Bob is matched with Alice
      And Alice's phone shows her last known wait

  Rule: Returning shows the accepted outcome of the wait
    No counter-example: returning changes what the device sees, never the outcome already accepted.

    Scenario: Alice's phone finds the match made while she was away
      Given Alice's phone was offline when she was matched with Bob
      When Alice's phone comes back online
      Then Alice and Bob are matched with each other

    Scenario: Alice's phone finds the stop made on another device
      Given Alice's phone was offline when she stopped waiting on another device
      When Alice's phone comes back online
      Then Alice is not waiting for a match

    Scenario: An offline request does not begin a wait on return
      Given Alice asked for a match while her phone was offline
      When Alice's phone comes back online
      Then Alice is not waiting for a match

    Scenario: An offline stop does not stop an accepted wait on return
      Given Alice asked to stop waiting while her phone was offline
      When Alice's phone comes back online
      Then Alice has the same wait
