@domain:billing @goal:guest-free-and-paid:9
Feature: Trial and renewal
  When a billing period ends, a Plus member wants their membership to carry
  on by itself, so paid access is never interrupted: a free trial turns into
  an active membership, and each renewal moves the renewal date later.

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
