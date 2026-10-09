@domain:spaces
Feature: Join a space from its link
  When someone shares a space link, anyone who has it wants to join the space,
  even a guest with no account, so nothing stands between them and the
  people there.

  Rule: Anyone with the space link can join an open space while both they and its host are online

    Scenario: A guest with no account joins a space from its link
      Given Alice and Bob are guests
      And Alice is hosting a space
      When Bob joins the space from the link
      Then Bob is in the space
      And Bob sees 2 people in the space within 15 seconds
      And Alice sees 2 people in the space within 15 seconds

    Scenario: A person cannot join a space while its host is offline
      Given Alice is hosting a space that Bob joined from the link
      And Alice is offline
      When Carol opens Alice's space link
      Then Carol is told the host is offline within 20 seconds
      And Carol is not offered to join
