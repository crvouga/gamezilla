@domain:billing @goal:guest-free-and-paid:9
Feature: Cancel and subscribe again
  A canceled membership ends at the period end and keeps paid access through
  grace, canceling now ends it at once, and a person whose membership ended can
  start again right away.

  Background:
    Given Alice has subscribed to Plus

  Scenario: A canceled membership ends at the period end
    Given Alice has canceled the membership in the billing portal
    When Alice's billing period ends
    Then Alice's membership has ended

  Scenario: An ended membership keeps paid access through grace
    Given Alice has canceled the membership in the billing portal
    And Alice's free trial has ended
    When Alice views the billing plans
    Then Alice has paid access

  Scenario: A membership canceled immediately ends right away
    When Alice's membership is canceled immediately
    Then Alice's membership has ended

  Scenario: A person whose membership ended can subscribe again
    Given Alice's membership has been canceled immediately
    When Alice subscribes to Plus
    Then Alice's membership is trialing on the monthly plan
    And Alice has paid access
