@domain:billing @goal:guest-free-and-paid:9 @goal:always-true:5
Feature: Refunds
  A refunded person has their money back, so their membership ends at once
  and paid access goes with it, with no grace.

  Background:
    Given Alice has subscribed to Plus
    And Alice's free trial has ended

  Scenario: A refund ends the membership at once
    When Alice's payment is refunded
    Then Alice's membership has ended

  Scenario: A refund takes paid access away at once
    When Alice's payment is refunded
    Then Alice has free access

  Scenario: A refunded person can subscribe again
    Given Alice's payment has been refunded
    When Alice subscribes to Plus
    Then Alice has paid access
