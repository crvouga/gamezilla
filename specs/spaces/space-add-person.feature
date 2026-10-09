@domain:spaces
Feature: Add a person to a space
  When a host wants a person to find their space, they want to add that
  person, so the person can choose to join from their lobby.

  Background:
    Given Alice and Bob are signed in
    And Alice is hosting a space
    And Alice is viewing Bob's profile

  Rule: Only the host can add a person

    Scenario: Adding a person gives them lobby access without joining them
      When Alice adds Bob to the space
      Then Bob's lobby lists Alice's space
      And Bob is not in a space

    Scenario: Someone who joined cannot add another person
      Given Bob has joined the space from the link
      When Bob views the space's presence
      Then Bob cannot add a person because only the host can add people

  Rule: An added person explicitly chooses Join

    Scenario: Adding a removed person again never restores their old participation
      Given Bob has joined the space from the link
      And Alice has removed Bob from the space
      When Alice adds Bob to the space
      Then Bob is not in a space
      And Bob is offered to join

    Scenario: An added person joins from their lobby
      Given Alice has added Bob to the space
      When Bob joins Alice's space from the lobby
      Then Bob is in the space
      And Alice sees 2 people in the space within 20 seconds

    Scenario: Reopening the app does not join an added person
      Given Alice has added Bob to the space
      When Bob closes and reopens the app
      Then Bob is not in a space
      And Bob's lobby lists Alice's space

  Rule: A host can add a known person with or without a connection
    No counter-example: the host's choice is kept locally; lobby access reaches the other person when both connections are available.

    Scenario: An offline host is offered to add a known person
      Given Alice is offline
      When Alice views the space's presence
      Then Alice can add Bob to the space without a connection

    Scenario: An offline host sees their addition accepted
      Given Alice is offline
      When Alice adds Bob to the space
      Then Alice sees that Bob has been added to the space
      And Bob is not in a space

    Scenario: The host's return shares an offline addition without joining the person
      Given Alice is offline
      And Alice has added Bob to the space
      When the connection comes back
      Then Bob's lobby lists Alice's space
      And Bob is not in a space

    Scenario: An added person who was offline gets lobby access on return
      Given Bob is offline
      And Alice has added Bob to the space
      When the connection comes back
      Then Bob's lobby lists Alice's space
      And Bob is not in a space

  Rule: Access alone never admits a person while the host is offline

    Scenario: An added person still cannot join while the host is offline
      Given Alice has added Bob to the space
      And Alice is offline
      When Bob opens Alice's space link
      Then Bob is told the host is offline within 20 seconds
      And Bob is not offered to join

    Scenario: An added person's Join is offered after the host returns
      Given Alice has added Bob to the space
      And Alice is offline
      And Bob has opened Alice's space link
      When the connection comes back
      Then Bob is offered to join

  Rule: Removing unjoined access does not prevent public-link joining

    Scenario: Removing an unjoined person takes the space out of their lobby
      Given Alice has added Bob to the space
      When Alice removes Bob from the space
      Then Bob's lobby stops listing Alice's space within 20 seconds
      And Bob is not in a space

    Scenario: A person whose unjoined access was removed can choose to join the public link
      Given Alice has added Bob to the space
      And Alice has removed Bob from the space
      When Bob joins the space from the link
      Then Bob is in the space
      And Alice sees 2 people in the space within 20 seconds
