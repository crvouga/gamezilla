@domain:billing
Feature: Paid access belongs to one person
  When someone else uses a Plus member's device, as a guest or signed in with
  their own account, the Plus member wants their membership to stay theirs,
  so paid access goes only to the person who paid for it.

  Rule: Paid access follows the person signed in, across their devices

    Scenario: A guest is asked to sign in before subscribing
      Given Bob is a guest
      When Bob views the billing plans
      Then Bob has free access
      And Bob is asked to sign in before subscribing

    @regression:browser-sign-out-success-blocks-sign-in
    Scenario: Alice's membership does not carry over to Bob on her device
      Given Alice has subscribed to Plus
      And Alice has signed out
      When Bob signs in with Google on Alice's device
      Then Bob has free access on Alice's device
