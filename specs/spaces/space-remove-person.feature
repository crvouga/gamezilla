@domain:spaces
Feature: Remove a person from a space
  When a host wants to end another person's participation, they want to
  remove that person, so they can manage their space without ending it.

  Background:
    Given Alice is hosting a space that Bob joined from the link

  Rule: Only the host can remove another person from their space

    @regression:space-removal-keeps-live-seat
    Scenario: The host removes a person without ending the space
      When Alice removes Bob from the space
      Then Bob is not in a space
      And Alice sees only Alice in the space within 20 seconds

    Scenario: A joined person cannot remove the host
      When Bob views the space's presence
      Then Bob cannot remove Alice from the space because only the host can remove a person

    Scenario: The host uses Leave instead of removing themselves
      When Alice views the space's presence
      Then Alice cannot remove themselves from the space because leaving ends their space

  Rule: A host can remove a person with or without a connection
    No counter-example: removal is the host's choice; the other person learns it once both connections are back.

    @regression:space-removal-success-disappears
    Scenario: An offline host sees their removal accepted
      Given Alice is offline
      When Alice removes Bob from the space
      Then Alice sees that Bob has been removed from the space

    Scenario: The host removes a person who is offline
      Given Bob is offline
      When Alice removes Bob from the space
      Then Alice sees that Bob has been removed from the space
      And Alice sees only Alice in the space within 20 seconds

    Scenario: A returning person stays out after being removed while offline
      Given Bob is offline
      And Alice has removed Bob from the space
      When the connection comes back
      Then Bob is not in a space
      And Alice sees only Alice in the space within 20 seconds

    Scenario: The host's return keeps an offline removal
      Given Alice is offline
      And Alice has removed Bob from the space
      When the connection comes back
      Then Bob is not in a space
      And Alice sees only Alice in the space within 20 seconds

  Rule: A removed person chooses whether to join again through the public space link

    @regression:space-removed-person-rejoins-with-stale-grants
    Scenario: A removed person joins the open space again
      Given Alice has removed Bob from the space
      When Bob joins the space from the link
      Then Bob is in the space
      And Alice sees 2 people in the space within 20 seconds

    Scenario: An ended space cannot admit a removed person again
      Given Alice has removed Bob from the space
      And Alice has ended the space
      When Bob joins the space from the link
      Then Bob sees the space has ended within 20 seconds
      And Bob is not offered to join

    Scenario: Reopening the app never joins a removed person automatically
      Given Alice has removed Bob from the space
      And Bob has closed and reopened the app
      When Bob opens Alice's space link
      Then Bob is not in a space
      And Bob is offered to join

    Scenario: A removed person's preview stays outside participation while the host is offline
      Given Alice has removed Bob from the space
      And Bob has opened Alice's space link
      And Alice is offline
      When Bob opens Alice's space link
      Then Bob is not in a space
      And Bob is told the host is offline within 20 seconds
      And Bob is not offered to join
