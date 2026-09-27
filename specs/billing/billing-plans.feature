@domain:billing @goal:guest-free-and-paid:7 @goal:guest-free-and-paid:8
Feature: What the billing plans offer
  When a person looks at the billing plans, they want to be offered the next
  sensible step, so they never pay twice or lose anything by looking: Plus to
  someone without a live membership, managing it to a Plus member, never a
  second membership on top of a live one. Leaving checkout without paying
  changes nothing.

  Scenario: A Plus member is offered to manage their membership, not to subscribe again
    Given Alice has subscribed to Plus
    When Alice views the billing plans
    Then Alice is offered to manage their membership
    And Alice is not offered to subscribe

  Scenario: Leaving checkout without paying keeps free access
    Given Alice is signed in with Google
    When Alice leaves checkout without paying
    Then Alice has free access
    And Alice is offered to subscribe

  Scenario: Subscribing on one device gives paid access on the other
    Given Alice is signed in with Google
    And Alice is also signed in on another device
    When Alice subscribes to Plus
    Then Alice's other device has paid access within 30 seconds

  Scenario: Subscribing needs a connection and says so
    Given Alice is signed in with Google
    And Alice is offline
    When Alice views the billing plans
    Then Alice is told subscribing needs a connection
