@domain:spaces
Feature: See who is idle in a space
  When people are together in a space, they want quiet to show as idle,
  so nobody mistakes it for leaving or for losing the connection.

  Rule: Two minutes with nothing done shows a person as idle, and they stay in the space

    Scenario: Two quiet minutes show the host as idle and still in the space
      Given Alice is hosting a space that Bob joined from the link
      When Alice stays idle for 2 minutes
      Then Bob sees Alice is idle within 20 seconds
      And Alice is in the space
      And Bob is in the space

    Scenario: One quiet minute does not show the host as idle
      Given Alice is hosting a space that Bob joined from the link
      When Alice stays idle for 1 minute
      Then Bob sees Alice is not idle within 20 seconds
      And Alice is in the space

    Scenario: Losing the connection is not being idle
      Given Alice is hosting a space that Bob joined from the link
      When Alice loses the connection
      Then Alice is told the connection is missing within 15 seconds
      And Alice is not idle
      And Alice is in the space

  Rule: Doing anything in the space shows the person as not idle
    No counter-example: staying quiet is the previous rule.

    Scenario: Viewing presence shows an idle host as not idle
      Given Alice is hosting a space that Bob joined from the link
      And Alice has been idle for 2 minutes
      When Alice views the space's presence
      Then Bob sees Alice is not idle within 20 seconds
      And Alice is in the space

  Rule: A person is idle only when every device they have in the space is idle
    No counter-example: one device still doing something keeps the person not idle, which is the first scenario.

    Scenario: One quiet device does not make the person idle
      Given Alice is hosting a space that Bob joined from the link
      And Alice's phone and her other device are in the space
      When Alice's phone stays idle for 2 minutes
      Then Bob sees Alice is not idle within 20 seconds
      And Bob sees Alice once in the space's presence

    Scenario: Every quiet device shows the person idle once
      Given Alice is hosting a space that Bob joined from the link and her phone has been idle for 2 minutes
      And Alice's other device is in the space
      When Alice's other device stays idle for 2 minutes
      Then Bob sees Alice is idle within 20 seconds
      And Bob sees Alice once in the space's presence
