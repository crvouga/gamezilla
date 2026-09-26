@domain:billing @goal:guest-free-and-paid:9
Feature: Paid access belongs to one person
  One person's membership never grants paid access to another person, whether
  a guest or someone who signs in with their own account.

  Scenario: A guest is offered the unlock and does not share a member's paid access
    Given Alice has subscribed to Plus
    And Bob is a guest
    When Bob views the billing plans
    Then Bob has free access
    And Bob is offered the unlock

  Scenario: A second signed-in person stays free while the member stays paid
    Given Alice has subscribed to Plus
    And Bob is a guest
    When Bob signs in with Google
    And Bob views the billing plans
    Then Bob has free access
    And Alice has paid access
