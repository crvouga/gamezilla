@domain:billing
Feature: The seven-day free trial
  When a person subscribes to Plus, they want to know when their free trial
  becomes a paid renewal, so they know when their membership is charged.

  Rule: The free trial lasts seven days
    No counter-example: time passing brings the free trial to its period end; a person cannot extend it by going offline.

    Background:
      Given Alice has subscribed to Plus

    Scenario: Six days after subscribing the membership is trialing
      When 6 days pass
      Then Alice's membership is trialing on the monthly plan
      And Alice has paid access

    Scenario: Seven days after subscribing the membership is active
      When 7 days pass
      Then Alice's membership is active on the monthly plan
      And Alice has paid access
