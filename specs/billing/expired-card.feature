@domain:billing
Feature: An expired card
  When a Plus member's card expires, they want it treated like any other
  failed payment, so they keep paid access while it is put right: the
  membership is delinquent until a working card pays, then active again.

  Background:
    Given Alice has subscribed to Plus
    And Alice's free trial has ended
    And Alice's card has expired

  Scenario: A renewal on an expired card makes the membership delinquent but still paid
    When Alice's billing period ends
    Then Alice's membership is delinquent
    And Alice has paid access

  Scenario: A new card after an expired one makes the membership active again
    Given Alice's renewal on the expired card has failed
    When Alice pays with a new card in the billing portal
    Then Alice's membership is active
    And Alice has paid access
