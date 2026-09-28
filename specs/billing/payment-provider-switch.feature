@domain:billing @goal:guest-free-and-paid:9
Feature: Switch payment provider
  When the team switches payment provider, a Plus member wants their
  membership to carry on where it started, and a person subscribing wants to
  start at the payment provider the team chose, so nobody loses paid access,
  pays twice, or has to look for their billing portal.

  Rule: A live membership stays at the payment provider it started at

    Scenario: A Plus member keeps their membership when the team switches payment provider
      Given Alice has subscribed to Plus
      When the team switches payment provider
      Then Alice has paid access
      And Alice is not offered to subscribe
      And Alice's billing portal is the first payment provider's

  Rule: The first payment provider keeps serving its members after the switch

    Scenario: A renewal at the first payment provider keeps the membership going
      Given Alice has subscribed to Plus
      And the team has switched payment provider
      When Alice's billing period ends
      Then Alice's membership is active
      And Alice has paid access

    Scenario: Canceling immediately at the first payment provider ends the membership
      Given Alice has subscribed to Plus
      And the team has switched payment provider
      When Alice's membership is canceled immediately
      Then Alice's membership has ended

  Rule: New memberships start at the payment provider the team chose

    Scenario: Subscribing after the switch starts at the second payment provider
      Given Alice is signed in with Google
      And the team has switched payment provider
      When Alice subscribes to Plus
      Then Alice has paid access
      And Alice's membership is trialing
      And Alice's billing portal is the second payment provider's

    Scenario: A person whose membership ended subscribes again at the second payment provider
      Given Alice has subscribed to Plus
      And Alice's membership has been canceled immediately
      And the team has switched payment provider
      When Alice subscribes to Plus
      Then Alice's membership is trialing
      And Alice's billing portal is the second payment provider's

    Scenario: After switching back, subscribing again starts at the first payment provider
      Given Alice's memberships have ended at both payment providers
      And the team has switched back to the first payment provider
      When Alice subscribes to Plus
      Then Alice's membership is trialing
      And Alice's billing portal is the first payment provider's
