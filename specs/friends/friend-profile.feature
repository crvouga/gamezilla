@domain:friends @goal:social:5
Feature: Another person's profile
  Another person's profile is where you decide about them: it opens from a search
  result or from their request, says who they are, and offers the same choices as search.

  Background:
    Given Alice and Bob are signed in

  Rule: A profile says who someone is

    Scenario: Looking someone up opens their profile
      When Alice looks up Bob
      Then Alice is shown Bob's profile

    Scenario: A request opens the asker's profile
      Given Alice has sent Bob a friend request
      When Bob views Alice's request
      Then Bob is shown Alice's profile
      And Bob is offered to confirm Alice's request

  Rule: A profile offers the same choices as search

    Scenario: Asking from a profile leaves a request to withdraw
      Given Alice is viewing Bob's profile
      When Alice sends Bob a friend request from Bob's profile
      Then Alice can withdraw the request to Bob

    Scenario: The person asked can confirm from the asker's profile
      Given Alice has sent Bob a friend request
      When Bob looks up Alice
      Then Bob is offered to confirm Alice's request within 15 seconds

    Scenario: Confirming from a profile makes them friends and both counts say so
      Given Alice has sent Bob a friend request
      And Bob is viewing Alice's profile
      When Bob confirms Alice's request from Alice's profile
      Then Bob sees Alice as a friend
      And Alice's friends list shows Bob within 15 seconds
      And Alice's friend count is 1
      And Bob's friend count is 1

    Scenario: Declining from the asker's profile turns the request down
      Given Alice has sent Bob a friend request
      And Bob has opened Alice's profile from their request
      When Bob declines Alice's request from Alice's profile
      Then Bob can ask Alice again within 5 seconds
      And Bob's inbox does not show a friend request from Alice
