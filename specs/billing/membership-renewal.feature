@domain:billing @goal:guest-free-and-paid:9
Feature: Trial and renewal
  A Plus trial turns into an active membership at the period end, and each
  renewal moves the renewal date on without interrupting paid access.

  Background:
    Given Alice has subscribed to Plus

  Scenario: The trial becomes active at the period end
    When Alice's billing period ends
    Then Alice's membership is active on the monthly plan
    And Alice has paid access

  Scenario: A monthly renewal moves the renewal date on and stays paid
    Given Alice's free trial has ended
    When Alice's billing period ends
    Then Alice's renewal date moves later
    And Alice has paid access
