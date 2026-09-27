@domain:billing @goal:guest-free-and-paid:9 @goal:guest-free-and-paid:10 @goal:always-true:4 @goal:always-true:5
Feature: When paid access runs out
  Nobody keeps paid access beyond what they paid for plus the 7-day grace,
  and nobody who paid loses it early, online or offline.

  Rule: A canceled membership keeps paid access for 7 days, and no longer

    Scenario: Six days after a canceled membership ends, access is still paid
      Given Alice has subscribed to Plus
      And Alice has canceled the membership in the billing portal
      And Alice's billing period has ended
      When 6 days pass
      Then Alice has paid access

    Scenario: Eight days after a canceled membership ends, access is free
      Given Alice has subscribed to Plus
      And Alice has canceled the membership in the billing portal
      And Alice's billing period has ended
      When 8 days pass
      Then Alice has free access

  Rule: A member offline keeps paid access for 7 days

    Scenario: A member offline for six days keeps paid access
      Given Alice has subscribed to Plus
      And Alice is offline
      When 6 days pass
      Then Alice has paid access

    Scenario: A member offline for eight days falls back to free access
      Given Alice has subscribed to Plus
      And Alice is offline
      When 8 days pass
      Then Alice has free access

    Scenario: A member back online after a long time away has paid access again
      Given Alice has subscribed to Plus
      And Alice has been offline for 8 days
      When the connection comes back
      Then Alice has paid access within 30 seconds
