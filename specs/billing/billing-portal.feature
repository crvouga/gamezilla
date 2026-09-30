@domain:billing
Feature: Manage a membership in the billing portal
  When a Plus member wants to change their membership, they want to do it
  themselves in the billing portal, so each change reaches their devices
  with nobody else involved.

  Background:
    Given Alice has subscribed to Plus

  Scenario: Canceling in the billing portal keeps paid access until the period end
    When Alice cancels the membership in the billing portal
    Then Alice's membership is set to end at the period end
    And Alice has paid access

  Scenario: Renewing in the portal after canceling keeps the trial going
    Given Alice has canceled the membership in the billing portal
    When Alice renews the membership in the billing portal
    Then Alice's membership is no longer set to end at the period end
    And Alice's membership is trialing

  Scenario: Switching to yearly in the portal during the trial keeps the trial
    When Alice switches the membership to the yearly plan in the billing portal
    Then Alice's membership is on the yearly plan
    And Alice's membership is trialing
