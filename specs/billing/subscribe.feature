@domain:billing
Feature: Subscribe to Plus
  When a signed-in person decides to pay for Plus, they want paid access as
  soon as checkout succeeds, so they can use Plus right away, starting with a
  monthly free trial.

  Rule: A signed-in person without a live membership can subscribe to Plus

    Scenario: A signed-in person starts with free access
      Given Alice is signed in with Google
      When Alice views the billing plans
      Then Alice has free access

    Scenario: Subscribing gives paid access with a monthly trial
      Given Alice is signed in with Google
      When Alice subscribes to Plus
      Then Alice has paid access
      And Alice's membership is trialing on the monthly plan

  Rule: A person is charged for one membership however often they subscribe

    @regression:billing-checkout-left-still-payable
    Scenario: Subscribing after leaving checkout continues the same checkout
      Given Alice is signed in with Google
      And Alice has left checkout without paying
      When Alice subscribes to Plus
      Then Alice has paid access
      And Alice's earlier checkout can no longer take a payment

    @regression:billing-second-checkout-before-webhook
    Scenario: Subscribing again before the payment is confirmed takes no second payment
      Given Alice has paid at checkout and the payment provider has not yet confirmed it
      When Alice tries to subscribe to Plus again
      Then Alice is charged for only one membership
