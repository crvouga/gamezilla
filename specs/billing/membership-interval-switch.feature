@domain:billing @goal:guest-free-and-paid:9
Feature: Switch billing interval
  Switching from monthly to yearly after the trial starts a paid year right
  away, so the person is on the plan they chose from that day.

  Background:
    Given Alice has subscribed to Plus

  Scenario: Switching to yearly after the trial starts a paid year right away
    Given Alice's free trial has ended
    When Alice switches the membership to the yearly plan in the billing portal
    Then Alice's membership is active on the yearly plan
    And Alice's renewal date moves later
