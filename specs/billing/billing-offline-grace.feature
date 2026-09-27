@domain:billing @goal:guest-free-and-paid:10
Feature: Paid access while offline
  A member who loses their connection keeps paid access, even while a failed
  payment is being retried, so going offline never takes away what they paid
  for.

  Scenario: A member whose payment failed keeps paid access while offline
    Given Alice has subscribed to Plus
    And Alice's payment has failed
    When Alice loses the connection
    Then Alice has paid access
