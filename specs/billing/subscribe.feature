@domain:billing @goal:guest-free-and-paid:7
Feature: Subscribe to Plus
  When a signed-in person decides to pay for Plus, they want paid access as
  soon as checkout succeeds, so they can use Plus right away, starting with a
  monthly free trial.

  Scenario: A signed-in person starts with free access
    Given Alice is signed in with Google
    When Alice views the billing plans
    Then Alice has free access

  Scenario: Subscribing gives paid access with a monthly trial
    Given Alice is signed in with Google
    When Alice subscribes to Plus
    Then Alice has paid access
    And Alice's membership is trialing on the monthly plan
