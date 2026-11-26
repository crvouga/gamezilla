@domain:billing
Feature: Open checkout and the billing portal
  When Alice looks at the billing plans, she wants to reach the payment
  provider from the app so she can start or manage her membership.

  Rule: Choosing an offered billing action takes Alice to its page at the payment provider
    No counter-example: the billing plans only offer actions available to Alice.

    Scenario: Starting a free trial opens checkout
      Given Alice is signed in with Google
      And Alice views the billing plans
      When Alice chooses to start the free trial
      Then Alice can enter a payment method at checkout

    Scenario: Managing after leaving checkout opens the billing portal
      Given Alice is signed in with Google
      And Alice has left checkout without paying
      When Alice chooses to manage her membership
      Then Alice can return to the app from the billing portal
