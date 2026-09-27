@domain:billing @goal:guest-free-and-paid:9
Feature: Failed payments
  When a Plus member's payment fails, they want to keep paid access while it
  is put right, so a card problem never cuts them off at once: the membership
  is delinquent within grace, a recovered payment makes it active again, and
  the membership ends only after the last retry.

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
