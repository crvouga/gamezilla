@domain:billing
Feature: Refunds
  When a Plus member is refunded, they want a refund that ends the membership
  with the money back, so paid access goes at once, with no grace, and they
  can subscribe again later.

  Background:
    Given Alice has subscribed to Plus
    And Alice's free trial has ended

  Rule: A refund ends the membership at once, and the person can subscribe again
    No counter-example: a refund is the payment coming back, not a request the product can turn down.

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
