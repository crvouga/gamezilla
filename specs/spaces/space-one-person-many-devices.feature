@domain:spaces
Feature: Be in one space from more than one device
  When a person uses one space from more than one device, they want every
  device to be in that same space and to count as one person, so closing
  one device never removes the others.

  Rule: Two devices in one space are one person

    Scenario: The host's other device is in the same space and counts once
      Given Alice is hosting a space that Bob joined from the link
      When Alice returns to their space on another device
      Then Alice's other device is in the space
      And Bob sees 2 people in the space within 20 seconds
      And Bob sees Alice once in the space's presence

    Scenario: A second device cannot host a second space on a free account
      Given Alice is hosting a space
      And Alice is also signed in on another device
      When Alice creates another space on her other device
      Then Alice is told their hosting limit is reached and invited to get Plus
      And Alice hosts 1 space

  Rule: A guest's other device joins the same space and still counts once
    No counter-example: a different person who joins is someone else, and presence already counts each person once.

    Scenario: Bob's other device joins and Bob still counts once
      Given Alice is hosting a space that Bob joined from the link
      And Bob is also signed in on another device
      When Bob's other device joins the space from the link
      Then Alice sees 2 people in the space within 20 seconds
      And Alice sees Bob once in the space's presence

  Rule: Closing the app on one device leaves the person's other device in the space
    No counter-example: closing the app never ends the space; the host leaving does.

    Scenario: Closing the app on the phone leaves the other device in the space
      Given Alice is hosting a space that Bob joined from the link
      And Alice's other device is in the space
      When Alice closes the app on her phone
      Then Alice's other device is in the space
      And the space has not ended

    Scenario: Closing the app does not leave the person idle
      Given Alice is hosting a space that Bob joined from the link
      And Alice has been idle for 2 minutes
      When Alice closes the app on her phone
      Then Bob sees Alice is not idle within 20 seconds
      And the space has not ended

  Rule: A host with another connected device in the space is still there for everyone else
    No counter-example: a host with no other device in the space is already covered when the host loses the connection.

    Scenario: Losing the phone's connection leaves the host present from the other device
      Given Alice is hosting a space that Bob joined from the link
      And Alice's other device is in the space
      When Alice's phone loses the connection
      Then Bob sees 2 people in the space within 20 seconds
      And Alice's phone is in the space
