@domain:friends @goal:social:5
Feature: Another person's profile
  When a person looks someone up or opens their friend request, they want to
  see that person's profile and decide on them right there, with the same
  choices people search offers, so they never have to go elsewhere to ask,
  accept or decline.

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
      And Bob is offered to accept Alice's request

  Rule: A profile offers the same choices as search

    Scenario: Asking from a profile gives the asker a request to cancel
      Given Alice is viewing Bob's profile
      When Alice sends Bob a friend request from Bob's profile
      Then Alice can cancel the request to Bob

    Scenario: The person asked can accept from the asker's profile
      Given Alice has sent Bob a friend request
      When Bob looks up Alice
      Then Bob is offered to accept Alice's request within 15 seconds

    Scenario: Accepting from a profile makes them friends and both counts say so
      Given Alice has sent Bob a friend request
      And Bob is viewing Alice's profile
      When Bob accepts Alice's request from Alice's profile
      Then Bob sees Alice as a friend
      And Alice's friends list shows Bob within 15 seconds
      And Alice's friend count is 1
      And Bob's friend count is 1

    Scenario: Declining from the asker's profile ends the request
      Given Alice has sent Bob a friend request
      And Bob has opened Alice's profile from their request
      When Bob declines Alice's request from Alice's profile
      Then Bob can ask Alice again within 5 seconds
      And Bob's inbox does not show a friend request from Alice
