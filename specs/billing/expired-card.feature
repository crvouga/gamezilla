@domain:billing @goal:guest-free-and-paid:9
Feature: An expired card
  A card that has expired cannot pay a renewal. The member is treated like
  any other failed payment: delinquent but still paid while the provider
  retries, and back to active once a working card pays.

  Background:
    Given Alice has subscribed to Plus
    And Alice's free trial has ended
    And Alice's card has expired

  Scenario: A renewal on an expired card leaves the membership delinquent but paid
    When Alice's billing period ends
    Then Alice's membership is delinquent
    And Alice has paid access

  Scenario: A new card after an expired one makes the membership active again
    Given Alice's renewal on the expired card has failed
    When Alice pays with a new card in the billing portal
    Then Alice's membership is active
    And Alice has paid access
