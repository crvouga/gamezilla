@domain:spaces
Feature: What a space's link leads to
  When a person follows a space link, they want to know where it leads: into
  an open space, or plainly to a space that has ended or does not exist, so
  they are never left with a blank or endless wait.

  Rule: A space link says whether its space is open, ended or cannot be found

    Scenario: The link to an open space offers joining
      Given Alice is hosting a space
      When Bob opens Alice's space link
      Then Bob is offered to join

    Scenario: Opening the link to an ended space says it has ended
      Given Alice has hosted a space and ended it
      When Bob opens Alice's space link
      Then Bob sees the space has ended within 15 seconds
      And Bob is not offered to join

    Scenario: An end already shared is still shown while the host is offline
      Given Alice has hosted a space and ended it
      And Alice is offline
      When Bob opens Alice's space link
      Then Bob sees the space has ended within 15 seconds
      And Bob is not offered to join

    Scenario: The link to an ended space says it has ended
      Given Alice and Bob are guests
      And Alice has hosted a space and ended it
      When Bob joins the space from the link
      Then Bob sees the space has ended within 15 seconds
      And Bob is not offered to join

    @regression:space-link-not-found-premature
    Scenario: A link to a space that never existed says so
      Given Bob is a guest
      When Bob opens a link to a space that does not exist
      Then Bob is told the space cannot be found within 15 seconds
      And Bob is offered the way back to Spaces

  Rule: Opening the same space link again shows where it leads
    No counter-example: the space and its host have not changed between openings.

    @regression:space-link-reopen-auto-joined
    Scenario: Opening an open space's link again still offers joining
      Given Alice is hosting a space
      And Bob has opened Alice's space link
      When Bob opens the space link again
      Then Bob is offered to join

    Scenario: Opening an ended space's link again still says it has ended
      Given Alice has hosted a space and ended it
      And Bob has opened Alice's space link
      When Bob opens the space link again
      Then Bob sees the space has ended within 15 seconds
      And Bob is not offered to join

    Scenario: Opening a missing space's link again still says it cannot be found
      Given Bob has opened a link to a space that does not exist
      When Bob opens the space link again
      Then Bob is told the space cannot be found within 15 seconds
      And Bob is offered the way back to Spaces

    Scenario: Opening an offline host's link again still says the host is offline
      Given Alice is hosting a space
      And Alice is offline
      And Bob has opened Alice's space link
      When Bob opens the space link again
      Then Bob is told the host is offline within 20 seconds
      And Bob is not offered to join
