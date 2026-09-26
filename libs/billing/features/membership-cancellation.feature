@domain:billing @goal:guest-free-and-paid:9
Feature: Cancel, resume, and resubscribe
  Canceling at the period end keeps paid access until then, canceling now ends
  the membership immediately, and an ended membership can be started again.

  Background:
    Given Alice has subscribed to Plus

  Scenario: Canceling at the period end keeps the trial and paid access
    When Alice's membership is set to cancel at the period end
    Then Alice's membership is set to end at the period end
    And Alice's membership is trialing
    And Alice has paid access

  Scenario: A membership canceled at the period end ends then, with paid access through grace
    Given Alice's membership is set to cancel at the period end
    When Alice's billing period ends
    Then Alice's membership has ended
    And Alice has paid access

  Scenario: Resuming before the period end keeps the membership live
    Given Alice's membership is set to cancel at the period end
    When Alice's membership is resumed
    Then Alice's membership is no longer set to end at the period end
    And Alice's membership is trialing
    And Alice has paid access

  Scenario: Canceling now ends the membership immediately
    Given Alice's membership is trialing
    And Alice's current period end is recorded
    When Alice's membership is canceled immediately
    Then Alice's membership has ended
    And Alice's period end is earlier than the recorded one

  Scenario: Resubscribing after the end starts a new live membership
    Given Alice's membership has been canceled immediately
    And Alice's membership has ended
    When Alice checks out Plus again with the provider
    Then Alice has two memberships
    And Alice's newest membership is trialing on the monthly plan
    And Alice has paid access
