@domain:billing @goal:guest-free-and-paid:9
Feature: Failed payments
  A failed payment makes the membership delinquent without taking paid access
  away during grace; recovery restores it, and exhausted retries end it.

  Background:
    Given Alice has subscribed to Plus

  Scenario: A failed payment is delinquent but stays paid inside grace
    When Alice's payment fails
    Then Alice's membership is delinquent
    And Alice has paid access

  Scenario: A recovered payment makes the membership active again
    Given Alice's payment has failed
    When Alice's payment recovers
    Then Alice's membership is active
    And Alice has paid access

  Scenario: A renewal that keeps failing ends after the last retry
    Given Alice's payment has failed
    When the provider gives up retrying Alice's payment
    Then Alice's membership has ended
