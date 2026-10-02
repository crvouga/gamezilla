@domain:billing
Feature: Paid access while offline
  When a Plus member loses their connection, even while a failed payment is
  still being put right, they want to keep paid access, so going offline
  never takes away what they paid for.

  Rule: Losing the connection keeps paid access while grace lasts

    Scenario: A Plus member whose payment failed keeps paid access while offline
      Given Alice has subscribed to Plus
      And Alice's payment has failed
      When Alice loses the connection
      Then Alice has paid access
