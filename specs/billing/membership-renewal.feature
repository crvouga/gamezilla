@domain:billing @goal:guest-free-and-paid:9
Feature: Trial and renewal
  A Plus trial turns into an active membership at the period end, and each
  renewal moves the period end forward without interrupting paid access.

  Background:
    Given Alice has subscribed to Plus

  Scenario: The trial becomes active at the period end
    When Alice's billing period ends
    Then Alice's membership is active on the monthly plan
    And Alice has paid access

  Scenario: A renewal moves the period end forward and stays paid
    Given Alice's membership is trialing
    And Alice's current period end is recorded
    When Alice's billing period ends
    Then Alice's membership is active
    And Alice's period end is later than the recorded one
    And Alice has paid access
