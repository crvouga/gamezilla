@domain:billing @goal:guest-free-and-paid:7
Feature: Subscribe to Plus
  A signed-in person can subscribe and has paid access as soon as checkout
  succeeds, starting with a monthly trial.

  Scenario: A signed-in person starts on the free plan
    Given Alice is signed in with Google
    When Alice views the billing plans
    Then Alice has free access

  Scenario: Subscribing gives paid access with a monthly trial
    Given Alice is signed in with Google
    When Alice subscribes to Plus
    Then Alice has paid access
    And Alice's membership is trialing on the monthly plan
    And Alice's membership has a current period end
    And the server's copy of Alice's membership matches Alice's device
