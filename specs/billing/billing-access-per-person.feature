@domain:billing @goal:guest-free-and-paid:9
Feature: Paid access belongs to one person
  One person's membership never grants paid access to anyone else, whether a
  guest or someone who signs in with their own account on the same device.

  Scenario: A guest is asked to sign in before subscribing
    Given Bob is a guest
    When Bob views the billing plans
    Then Bob has free access
    And Bob is asked to sign in before subscribing

  Scenario: Alice's membership does not carry over to Bob on her device
    Given Alice has subscribed to Plus
    And Alice has signed out
    When Bob signs in with Google on Alice's device
    Then Bob has free access on Alice's device
