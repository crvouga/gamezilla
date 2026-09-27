@domain:billing @goal:guest-free-and-paid:9
Feature: Switch billing interval
  Switching from monthly to yearly keeps a running trial, and after the trial
  starts a paid year right away.

  Background:
    Given Alice has subscribed to Plus

  Scenario: Switching the interval during the trial keeps the trial
    When Alice's membership switches to the yearly plan
    Then Alice's membership is on the yearly plan
    And Alice's membership is trialing
    And Alice has paid access

  Scenario: Switching the interval after the trial starts a paid year now
    Given Alice's billing period has ended
    And Alice's membership is active
    And Alice's current period end is recorded
    When Alice's membership switches to the yearly plan
    Then Alice's membership is on the yearly plan
    And Alice's membership is active
    And Alice's period end is later than the recorded one
