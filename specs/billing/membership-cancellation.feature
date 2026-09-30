@domain:billing
Feature: Cancel and subscribe again
  When a Plus member no longer wants Plus, they want to choose when their
  membership ends and to come back whenever they like, so canceling never
  costs them what they already paid for: a canceled membership ends at the
  period end and keeps paid access through grace, canceling immediately
  ends the membership at once, and a person whose membership ended can subscribe again right
  away.

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
