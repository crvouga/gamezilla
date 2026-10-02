@domain:billing
Feature: Failed payments
  When a Plus member's payment fails, they want to keep paid access while it
  is put right, so a card problem never cuts them off at once: the membership
  is delinquent within grace, a recovered payment makes it active again, and
  the membership ends only once the payment provider gives up on the
  payment.

  Rule: A failed payment keeps paid access within grace until the payment provider gives up

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

    Scenario: A payment the payment provider gives up on ends the membership
      Given Alice's payment has failed
      When the payment provider gives up on Alice's payment
      Then Alice's membership has ended
