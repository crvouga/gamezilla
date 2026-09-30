@domain:billing
Feature: Plus credit from switching plans
  When a Plus member switches from the yearly plan to the monthly plan, they
  want the unused part of the yearly plan kept as Plus credit, so a later
  renewal is paid from it before their card is charged.

  Background:
    Given Alice has subscribed to Plus
    And Alice's free trial has ended
    And Alice has switched the membership to the yearly plan in the billing portal

  Rule: Plus credit from the yearly plan pays a renewal before the card does

    Scenario: Switching from yearly to monthly keeps Plus credit
      When Alice switches the membership to the monthly plan in the billing portal
      Then Alice's membership is active on the monthly plan
      And Alice has Plus credit from the yearly plan

    Scenario: A renewal Plus credit covers stays active when the card is declined
      Given Alice has Plus credit from the yearly plan
      And Alice's card has expired
      When Alice's billing period ends
      Then Alice's membership is active
      And Alice is not told a payment failed

    Scenario: A renewal Plus credit does not cover is a failed payment
      Given Alice's Plus credit no longer covers a renewal
      And Alice's card has expired
      When Alice's billing period ends
      Then Alice's membership is delinquent
      And Alice is told their payment failed
