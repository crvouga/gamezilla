@domain:billing @goal:guest-free-and-paid:10
Feature: Paid access while offline
  A membership already synced to the device answers access questions without
  the server, including during a failed-payment grace period.

  Scenario: A synced delinquent membership still gives paid access while offline
    Given Alice has subscribed to Plus
    And Alice's payment has failed
    When Alice loses the connection
    Then Alice has paid access
    When the connection comes back
    Then Alice has paid access
    And the server records Alice's membership as delinquent
