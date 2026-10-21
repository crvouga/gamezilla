@domain:billing
Feature: What the billing plans offer
  When a person looks at the billing plans, they want to be offered the next
  sensible step, so they never pay twice or lose anything by looking: Plus to
  someone without a live membership, managing it to a Plus member, never a
  second membership on top of a live one. Leaving checkout without paying
  changes nothing.

  Rule: The billing plans offer subscribing or managing the membership according to paid access

    Scenario: A Plus member is offered to manage their membership, not to subscribe again
      Given Alice has subscribed to Plus
      When Alice views the billing plans
      Then Alice is offered to manage their membership
      And Alice is not offered to subscribe

    Scenario: Leaving checkout without paying keeps free access
      Given Alice is signed in with Google
      When Alice leaves checkout without paying
      Then Alice has free access
      And Alice is offered to subscribe

    Scenario: Subscribing on one device gives paid access on the other
      Given Alice is signed in with Google
      And Alice is also signed in on another device
      When Alice subscribes to Plus
      Then Alice's other device has paid access within 30 seconds

    Scenario: Subscribing needs a connection and says so
      Given Alice is signed in with Google
      And Alice is offline
      When Alice views the billing plans
      Then Alice is told subscribing needs a connection

  Rule: Back from paying at checkout, the billing plans say the payment is still being confirmed until the membership shows, and never offer to subscribe again meanwhile

    @regression:billing-checkout-return-shows-no-membership
    Scenario: A person back from checkout before the payment is confirmed is told it is still being confirmed
      Given Alice is signed in with Google
      And the payment provider is slow to confirm payments
      When Alice subscribes to Plus
      Then Alice is told their payment is still being confirmed
      And Alice is not offered to subscribe

    Scenario: A person whose payment is still not confirmed minutes later is told to check again before paying again
      Given the payment provider is slow to confirm payments
      And Alice has subscribed to Plus
      When 5 minutes pass
      Then Alice is told to check again before paying again

    Scenario: Once the payment is confirmed, a person back from checkout has paid access
      Given the payment provider is slow to confirm payments
      And Alice has subscribed to Plus
      When the payment provider confirms Alice's payment
      Then Alice has paid access within 60 seconds
      And Alice is not told their payment is still being confirmed

    Scenario: Leaving checkout without paying is never told a payment is being confirmed
      Given Alice is signed in with Google
      When Alice leaves checkout without paying
      Then Alice is not told their payment is still being confirmed
      And Alice is offered to subscribe
