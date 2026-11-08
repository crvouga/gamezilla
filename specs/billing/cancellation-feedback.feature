@domain:billing
Feature: Learn why people cancel Plus
  When a Plus member cancels, they want to share cancellation feedback only
  if they choose, so the team can understand what to improve without making
  canceling harder.

  Rule: Cancellation feedback is optional and never changes a cancellation

    Scenario: A person can cancel without sharing cancellation feedback
      Given Alice has subscribed to Plus
      When Alice cancels the membership in the billing portal
      Then Alice's membership is set to end at the period end
      And Alice has not shared cancellation feedback

    Scenario: A person without a canceled membership is not asked for cancellation feedback
      Given Alice has subscribed to Plus
      When Alice views the billing plans
      Then Alice is not offered to share cancellation feedback

  Rule: A person can share a reason, a comment, or both after canceling
    No counter-example: every part of cancellation feedback is optional.

    Background:
      Given Alice has subscribed to Plus
      And Alice has canceled the membership in the billing portal

    Scenario Outline: Sharing cancellation feedback preserves the cancellation
      When Alice shares cancellation feedback with reason <reason> and comment <comment>
      Then Alice sees their cancellation feedback with reason <reason> and comment <comment>
      And Alice's membership is set to end at the period end

      Examples:
        | reason             | comment                            |
        | "price"            | "Plus is too expensive this month." |
        | "missing features" | ""                                 |
        | ""                 | "Taking a break from games."       |

    Scenario: Cancellation feedback remains available after reopening the app
      Given Alice has shared cancellation feedback with reason "low usage" and comment "Less time to play."
      When Alice closes and reopens the app
      Then Alice sees their cancellation feedback with reason "low usage" and comment "Less time to play."

    Scenario: A person can change their earlier cancellation feedback
      Given Alice has shared cancellation feedback with reason "price" and comment "Plus is too expensive this month."
      When Alice shares cancellation feedback with reason "low usage" and comment "Less time to play."
      Then Alice sees their cancellation feedback with reason "low usage" and comment "Less time to play."
      And Alice's membership is set to end at the period end

    Scenario: Sharing cancellation feedback offline preserves the answer
      Given Alice is offline
      When Alice shares cancellation feedback with reason "other" and comment "Taking a break from games."
      Then Alice sees their cancellation feedback with reason "other" and comment "Taking a break from games."

    @regression:billing-feedback-lost-after-canceled-period
    Scenario: Feedback saved offline is shared even after the canceled membership ends
      Given Alice is offline
      And Alice has shared cancellation feedback with reason "low usage" and comment "Less time to play."
      And Alice's billing period has ended
      When the connection comes back
      Then the team can see Alice's cancellation feedback with reason "low usage" and comment "Less time to play."
      And Alice sees their cancellation feedback with reason "low usage" and comment "Less time to play."

  Rule: Cancellation feedback is private from other people

    Scenario: The team can see cancellation feedback to understand why people cancel
      Given Alice has subscribed to Plus
      And Alice has canceled the membership in the billing portal
      When Alice shares cancellation feedback with reason "difficulty using the app" and comment "The games were hard to find."
      Then the team can see Alice's cancellation feedback with reason "difficulty using the app" and comment "The games were hard to find."

    Scenario: Another person cannot see cancellation feedback
      Given Alice has shared cancellation feedback with reason "switching products" and comment "My friends play elsewhere."
      And Bob is signed in with Google
      When Bob views the billing plans
      Then Bob cannot see Alice's cancellation feedback
      And Bob has free access
