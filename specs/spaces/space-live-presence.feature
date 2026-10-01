@domain:spaces
Feature: Presence in a space
  When people are in a space together, each wants to see who else is there
  as it changes, so they know who they are with.

  Rule: Presence shows everyone in the space and stops showing someone who leaves

    Scenario: Everyone in a space sees who is there
      Given Alice is hosting a space
      When Bob joins the space from the link
      Then Alice sees 2 people in the space within 20 seconds
      And Bob sees 2 people in the space within 20 seconds

    Scenario: Someone stops showing as there after leaving
      Given Alice is hosting a space that Bob joined from the link
      When Bob leaves the space
      Then Alice sees 1 person in the space within 20 seconds

  Rule: Leaving shows a clear outcome and lets a friend join again
    No counter-example: a space that ended cannot be joined again, as the link scenarios cover.

    @regression:space-leave-navigation-hides-outcome
    Scenario: Someone who leaves can choose to rejoin the open space
      Given Alice is hosting a space that Bob joined from the link
      When Bob leaves the space
      Then Bob is offered to join
      And Alice sees 1 person in the space within 20 seconds
